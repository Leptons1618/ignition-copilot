/**
 * Ollama LLM service with tool calling, runtime config, and latency instrumentation.
 */

import ignition from './ignition.js';
import { searchDocs } from './rag.js';
import { getAssetHealth } from './insights.js';

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

const HARD_LIMITS = {
  maxIterations: 6,
  maxNumPredict: 2048,
  minNumPredict: 64,
};

const runtimeConfig = {
  ollamaUrl: DEFAULT_OLLAMA_URL,
  defaultModel: DEFAULT_MODEL,
  temperature: 0.2,
  numPredict: 900,
  maxIterations: 4,
  enableRagContext: true,
};

const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 8000;
const MAX_SESSION_INTENTS = 6;
const sessionState = new Map();

const TOOLS = [
  { type: 'function', function: { name: 'browse_tags', description: 'Browse Ignition tags at a path.', parameters: { type: 'object', properties: { path: { type: 'string', default: '[default]' }, recursive: { type: 'boolean', default: false } } } } },
  { type: 'function', function: { name: 'read_tags', description: 'Read current values of tags.', parameters: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } } }, required: ['paths'] } } },
  { type: 'function', function: { name: 'write_tag', description: 'Write a value to a tag.', parameters: { type: 'object', properties: { path: { type: 'string' }, value: {} }, required: ['path', 'value'] } } },
  { type: 'function', function: { name: 'search_tags', description: 'Search tags by pattern.', parameters: { type: 'object', properties: { pattern: { type: 'string', default: '*' }, root: { type: 'string', default: '[default]' } } } } },
  { type: 'function', function: { name: 'query_history', description: 'Query tag history for charting.', parameters: { type: 'object', properties: { paths: { type: 'array', items: { type: 'string' } }, startTime: { type: 'string', default: '-1h' }, endTime: { type: 'string', default: '' }, returnSize: { type: 'integer', default: 500 } }, required: ['paths'] } } },
  { type: 'function', function: { name: 'get_active_alarms', description: 'Get active alarms.', parameters: { type: 'object', properties: { source: { type: 'string', default: '' }, priority: { type: 'string', default: '' } } } } },
  { type: 'function', function: { name: 'query_alarm_journal', description: 'Query alarm journal.', parameters: { type: 'object', properties: { startTime: { type: 'string', default: '-24h' }, max: { type: 'integer', default: 200 } } } } },
  { type: 'function', function: { name: 'get_system_info', description: 'Get gateway system information.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_asset_health', description: 'Compute asset health score and recommendations.', parameters: { type: 'object', properties: { assetPath: { type: 'string' } } } } },
  { type: 'function', function: { name: 'create_tag', description: 'Create a new tag.', parameters: { type: 'object', properties: { basePath: { type: 'string' }, name: { type: 'string' }, dataType: { type: 'string', default: 'Float8' }, value: { default: 0 } }, required: ['basePath', 'name'] } } },
  { type: 'function', function: { name: 'get_tag_config', description: 'Get tag configuration.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } } },
  { type: 'function', function: { name: 'search_docs', description: 'Search Ignition documentation.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } } },
];

const SYSTEM_PROMPT = `You are Ignition Copilot, an assistant for Ignition SCADA operations.
Rules:
1) For live values, call tools instead of guessing.
2) For trends/charts, call query_history.
3) For setup/config/how-to, call search_docs.
4) For reliability/maintenance, call get_asset_health.
5) Use full tag paths like [default]Folder/Tag.
6) Keep responses concise, actionable, and operator-safe.`;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mergeRuntimeOptions(options = {}) {
  const out = {
    model: options.model || runtimeConfig.defaultModel,
    ollamaUrl: options.ollamaUrl || runtimeConfig.ollamaUrl,
    temperature: typeof options.temperature === 'number' ? options.temperature : runtimeConfig.temperature,
    numPredict: typeof options.numPredict === 'number' ? options.numPredict : runtimeConfig.numPredict,
    maxIterations: typeof options.maxIterations === 'number' ? options.maxIterations : runtimeConfig.maxIterations,
    enableRagContext: typeof options.enableRagContext === 'boolean' ? options.enableRagContext : runtimeConfig.enableRagContext,
  };
  out.temperature = clamp(out.temperature, 0, 1);
  out.numPredict = clamp(Math.round(out.numPredict), HARD_LIMITS.minNumPredict, HARD_LIMITS.maxNumPredict);
  out.maxIterations = clamp(Math.round(out.maxIterations), 1, HARD_LIMITS.maxIterations);
  return out;
}

function normalizeIncomingMessages(messages) {
  return (messages || []).filter(m => m && typeof m.content === 'string').map(m => ({ role: m.role || 'user', content: String(m.content || '') }));
}

function compactMessages(messages) {
  const normalized = normalizeIncomingMessages(messages);
  const compact = [];
  let charCount = 0;
  for (let i = normalized.length - 1; i >= 0; i--) {
    const msg = normalized[i];
    const next = msg.content.length + 32;
    if (compact.length >= MAX_CONTEXT_MESSAGES || charCount + next > MAX_CONTEXT_CHARS) break;
    compact.push(msg);
    charCount += next;
  }
  return compact.reverse();
}

function getLastUserMessage(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content;
  }
  return '';
}

function shouldInjectDocs(text) {
  return /(how|configure|setup|best practice|alarm|history|gateway|tag|ignition|script|perspective|vision)/i.test(text || '');
}

function shortLine(text, maxLen = 220) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? `${s.slice(0, maxLen)}...` : s;
}

function getSessionContextMessage(sessionId) {
  const state = sessionState.get(sessionId);
  if (!state?.intents?.length) return null;
  const intents = state.intents.map((v, i) => `${i + 1}. ${v}`).join('\n');
  return `Session context:\n${intents}`;
}

function updateSessionState(sessionId, latestUserMessage) {
  if (!sessionId || !latestUserMessage) return;
  const state = sessionState.get(sessionId) || { intents: [], updatedAt: 0 };
  const intent = shortLine(latestUserMessage);
  if (!state.intents.includes(intent)) state.intents.push(intent);
  if (state.intents.length > MAX_SESSION_INTENTS) state.intents = state.intents.slice(-MAX_SESSION_INTENTS);
  state.updatedAt = Date.now();
  sessionState.set(sessionId, state);
}

async function buildRagContextMessage(query) {
  try {
    const docs = await searchDocs(query, 2, { minScore: 0.35, maxChars: 320 });
    if (!docs.results?.length) return null;
    const lines = docs.results.map((d, i) => `${i + 1}. [${d.source}] ${shortLine(d.text, 220)}`).join('\n');
    return `Relevant docs:\n${lines}`;
  } catch {
    return null;
  }
}

function parseToolArgs(tc) {
  const args = tc?.function?.arguments;
  if (!args) return {};
  if (typeof args === 'string') {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args;
}

function normalizePathToken(token) {
  if (token == null) return [];
  if (Array.isArray(token)) return token.flatMap(normalizePathToken);
  if (typeof token !== 'string') return [];

  const s = token.trim();
  if (!s) return [];

  // Remove accidental outer quotes around serialized arrays or paths.
  const unquoted = (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) ? s.slice(1, -1).trim() : s;

  if (unquoted.startsWith('[') && unquoted.endsWith(']')) {
    try {
      return normalizePathToken(JSON.parse(unquoted));
    } catch {
      // Keep parsing fallbacks below when LLM JSON is malformed.
    }
  }

  const explicitPaths = unquoted.match(/\[default\][^,"\]\s]*/g);
  if (explicitPaths?.length) return explicitPaths;

  if (unquoted.includes(',')) {
    return unquoted.split(',').map(v => v.trim()).filter(Boolean);
  }
  return [unquoted];
}

function normalizePaths(input) {
  const out = normalizePathToken(input);
  return [...new Set(out)];
}

async function executeTool(name, args = {}) {
  try {
    switch (name) {
      case 'browse_tags': return await ignition.browseTags(args.path, args.recursive);
      case 'read_tags': return await ignition.readTags(normalizePaths(args.paths));
      case 'write_tag': return await ignition.writeTags([{ path: args.path, value: args.value }]);
      case 'search_tags': return await ignition.searchTags(args.pattern, args.root);
      case 'query_history': return await ignition.queryHistory(normalizePaths(args.paths), args.startTime, args.endTime, args.returnSize);
      case 'get_active_alarms': return await ignition.getActiveAlarms(args.source, args.priority);
      case 'query_alarm_journal': return await ignition.queryAlarmJournal(args.startTime, args.max);
      case 'get_system_info': return await ignition.getSystemInfo();
      case 'get_asset_health': return await getAssetHealth(args.assetPath || '[default]/DemoPlant/MotorM12');
      case 'create_tag': return await ignition.createTag(args.basePath, args.name, 'AtomicTag', args.dataType || 'Float8', args.value ?? 0);
      case 'get_tag_config': return await ignition.getTagConfig(args.path);
      case 'search_docs': return await searchDocs(args.query, 5);
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

export async function chat(messages, options = {}) {
  const startedAt = Date.now();
  const opts = mergeRuntimeOptions(options);
  const sessionId = options.sessionId || 'default';

  const compact = compactMessages(messages);
  const latestUser = getLastUserMessage(compact);
  const sessionMsg = getSessionContextMessage(sessionId);

  const ragStarted = Date.now();
  const ragMsg = (opts.enableRagContext && shouldInjectDocs(latestUser)) ? await buildRagContextMessage(latestUser) : null;
  const ragMs = Date.now() - ragStarted;

  const baseMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (sessionMsg) baseMessages.push({ role: 'system', content: sessionMsg });
  if (ragMsg) baseMessages.push({ role: 'system', content: ragMsg });

  const toolCallLog = [];
  const llmLatencies = [];
  let currentMessages = [...baseMessages, ...compact];

  for (let iteration = 0; iteration < opts.maxIterations; iteration++) {
    const llmStarted = Date.now();
    const response = await fetch(`${opts.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: currentMessages,
        tools: TOOLS,
        stream: false,
        options: { temperature: opts.temperature, num_predict: opts.numPredict },
      }),
    });
    llmLatencies.push(Date.now() - llmStarted);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const assistant = data.message || { role: 'assistant', content: '' };
    const calls = assistant.tool_calls || [];
    if (calls.length === 0) {
      updateSessionState(sessionId, latestUser);
      return {
        content: assistant.content,
        toolCalls: toolCallLog,
        model: opts.model,
        perf: {
          totalMs: Date.now() - startedAt,
          llmMs: llmLatencies.reduce((a, b) => a + b, 0),
          ragMs,
          llmCalls: llmLatencies.length,
          toolCalls: toolCallLog.length,
        },
      };
    }

    currentMessages.push(assistant);
    for (const call of calls) {
      const toolName = call.function.name;
      const toolArgs = parseToolArgs(call);
      const result = await executeTool(toolName, toolArgs);
      toolCallLog.push({ tool: toolName, args: toolArgs, result });
      currentMessages.push({ role: 'tool', content: JSON.stringify(result, null, 2) });
    }
  }

  updateSessionState(sessionId, latestUser);
  return {
    content: 'Reached tool-calling iteration limit. Try narrowing your request.',
    toolCalls: toolCallLog,
    model: opts.model,
    perf: {
      totalMs: Date.now() - startedAt,
      llmMs: llmLatencies.reduce((a, b) => a + b, 0),
      ragMs,
      llmCalls: llmLatencies.length,
      toolCalls: toolCallLog.length,
    },
    maxIterationsReached: true,
  };
}

export function getChatConfig() {
  return { ...runtimeConfig };
}

export function updateChatConfig(patch = {}) {
  const next = mergeRuntimeOptions(patch);
  runtimeConfig.ollamaUrl = next.ollamaUrl;
  runtimeConfig.defaultModel = next.model;
  runtimeConfig.temperature = next.temperature;
  runtimeConfig.numPredict = next.numPredict;
  runtimeConfig.maxIterations = next.maxIterations;
  runtimeConfig.enableRagContext = next.enableRagContext;
  return getChatConfig();
}

export async function listModels(urlOverride = null) {
  const base = urlOverride || runtimeConfig.ollamaUrl;
  const resp = await fetch(`${base}/api/tags`);
  if (!resp.ok) throw new Error(`Ollama models error: ${resp.status}`);
  const data = await resp.json();
  return data.models || [];
}

/**
 * Streaming chat — yields SSE-style event objects.
 * Events: { type: 'token', data: string }
 *         { type: 'tool_start', data: { tool, args } }
 *         { type: 'tool_result', data: { tool, args, result, error } }
 *         { type: 'done', data: { content, toolCalls, model, perf } }
 *         { type: 'error', data: { message } }
 */
export async function* chatStream(messages, options = {}) {
  const startedAt = Date.now();
  const opts = mergeRuntimeOptions(options);
  const sessionId = options.sessionId || 'default';

  const compact = compactMessages(messages);
  const latestUser = getLastUserMessage(compact);
  const sessionMsg = getSessionContextMessage(sessionId);

  const ragStarted = Date.now();
  const ragMsg = (opts.enableRagContext && shouldInjectDocs(latestUser))
    ? await buildRagContextMessage(latestUser) : null;
  const ragMs = Date.now() - ragStarted;

  const baseMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (sessionMsg) baseMessages.push({ role: 'system', content: sessionMsg });
  if (ragMsg) baseMessages.push({ role: 'system', content: ragMsg });

  const toolCallLog = [];
  const llmLatencies = [];
  let currentMessages = [...baseMessages, ...compact];
  let fullContent = '';

  for (let iteration = 0; iteration < opts.maxIterations; iteration++) {
    const llmStarted = Date.now();

    // First try with tools to detect tool calls (non-streaming)
    const probeResp = await fetch(`${opts.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: currentMessages,
        tools: TOOLS,
        stream: false,
        options: { temperature: opts.temperature, num_predict: opts.numPredict },
      }),
    });

    if (!probeResp.ok) {
      const errText = await probeResp.text().catch(() => '');
      yield { type: 'error', data: { message: `Ollama error ${probeResp.status}: ${errText}` } };
      return;
    }

    const probeData = await probeResp.json();
    const assistant = probeData.message || { role: 'assistant', content: '' };
    const calls = assistant.tool_calls || [];
    llmLatencies.push(Date.now() - llmStarted);

    if (calls.length > 0) {
      // Execute tools
      currentMessages.push(assistant);
      for (const call of calls) {
        const toolName = call.function.name;
        const toolArgs = parseToolArgs(call);
        yield { type: 'tool_start', data: { tool: toolName, args: toolArgs } };
        const result = await executeTool(toolName, toolArgs);
        toolCallLog.push({ tool: toolName, args: toolArgs, result });
        yield { type: 'tool_result', data: { tool: toolName, args: toolArgs, result } };
        currentMessages.push({ role: 'tool', content: JSON.stringify(result, null, 2) });
      }
      continue; // Next iteration for final summary
    }

    // No tool calls — stream the final text response
    const llmStreamStarted = Date.now();
    const streamResp = await fetch(`${opts.ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: opts.model,
        messages: currentMessages,
        stream: true,
        options: { temperature: opts.temperature, num_predict: opts.numPredict },
      }),
    });

    if (!streamResp.ok) {
      yield { type: 'token', data: assistant.content || '' };
      fullContent = assistant.content || '';
    } else {
      const reader = streamResp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            const token = chunk.message?.content || '';
            if (token) {
              fullContent += token;
              yield { type: 'token', data: token };
            }
          } catch {
            // skip malformed JSON line
          }
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer);
          const token = chunk.message?.content || '';
          if (token) {
            fullContent += token;
            yield { type: 'token', data: token };
          }
        } catch {}
      }
    }

    llmLatencies.push(Date.now() - llmStreamStarted);
    break;
  }

  updateSessionState(sessionId, latestUser);

  yield {
    type: 'done',
    data: {
      content: fullContent,
      toolCalls: toolCallLog,
      model: opts.model,
      perf: {
        totalMs: Date.now() - startedAt,
        llmMs: llmLatencies.reduce((a, b) => a + b, 0),
        ragMs,
        llmCalls: llmLatencies.length,
        toolCalls: toolCallLog.length,
      },
    },
  };
}

export { TOOLS, SYSTEM_PROMPT };
