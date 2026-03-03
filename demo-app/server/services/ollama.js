/**
 * Unified LLM service with tool calling, runtime config, and latency instrumentation.
 *
 * Supports two providers (set LLM_PROVIDER env var):
 *   "ollama"         — local Ollama instance (default, backward-compatible)
 *   "github_models"  — GitHub Models API (needs GITHUB_TOKEN)
 */

import ignition from './ignition.js';
import { searchDocs } from './rag.js';
import { getAssetHealth } from './insights.js';
import * as ghModels from './github-models.js';

const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'ollama').toLowerCase();
const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = LLM_PROVIDER === 'github_models'
  ? (process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini')
  : (process.env.OLLAMA_MODEL || 'llama3.2:3b');

const HARD_LIMITS = {
  maxIterations: 6,
  maxNumPredict: 2048,
  minNumPredict: 64,
};

const runtimeConfig = {
  provider: LLM_PROVIDER,
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
6) Keep responses concise, actionable, and operator-safe.
7) When asked to create pages/views, use create_view or generate_dashboard tools.
8) When creating views, use real tag paths from browse_tags/search_tags results.
9) Build beautiful, functional dashboards with cards, gauges, and sparklines.`;

// Tag context cache — refreshed every 5 minutes
let _tagContextCache = null;
let _tagContextAge = 0;
const TAG_CONTEXT_TTL = 300_000;

async function buildTagContext() {
  if (_tagContextCache && Date.now() - _tagContextAge < TAG_CONTEXT_TTL) return _tagContextCache;
  try {
    const result = await ignition.browseTags('[default]', true);
    const tags = result.tags || result || [];
    if (!tags.length) return null;
    const lines = tags.slice(0, 50).map(t => {
      const parts = [t.fullPath || t.path];
      if (t.dataType) parts.push(t.dataType);
      if (t.tagType) parts.push(t.tagType);
      return parts.join(' | ');
    });
    _tagContextCache = `Available tags:\n${lines.join('\n')}`;
    _tagContextAge = Date.now();
    return _tagContextCache;
  } catch {
    return null;
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mergeRuntimeOptions(options = {}) {
  const out = {
    provider: options.provider || runtimeConfig.provider,
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

// ---------------------------------------------------------------------------
//  Provider abstraction: call either Ollama or GitHub Models
// ---------------------------------------------------------------------------

/** Convert Ollama-style tool_calls to OpenAI format and vice-versa */
function normalizeToolCalls(calls, provider) {
  if (!calls?.length) return [];
  return calls.map(tc => {
    // OpenAI format: { id, type, function: { name, arguments } }
    // Ollama format: { function: { name, arguments } }
    const fn = tc.function || {};
    return {
      id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'function',
      function: {
        name: fn.name,
        arguments: typeof fn.arguments === 'string' ? fn.arguments : JSON.stringify(fn.arguments || {}),
      },
    };
  });
}

async function llmChat(currentMessages, tools, opts) {
  if (opts.provider === 'github_models') {
    // --- GitHub Models (OpenAI-compatible) ---
    const openaiTools = tools.map(t => ({
      type: 'function',
      function: { name: t.function.name, description: t.function.description, parameters: t.function.parameters },
    }));
    const { message } = await ghModels.chatCompletion(currentMessages, openaiTools, {
      model: opts.model,
      temperature: opts.temperature,
      maxTokens: opts.numPredict,
    });
    const rawCalls = message.tool_calls || [];
    return {
      content: message.content || '',
      tool_calls: rawCalls.length ? normalizeToolCalls(rawCalls, 'github_models') : [],
    };
  }

  // --- Ollama (default) ---
  const response = await fetch(`${opts.ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      messages: currentMessages,
      tools,
      stream: false,
      options: { temperature: opts.temperature, num_predict: opts.numPredict },
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Ollama error ${response.status}: ${errText}`);
  }
  const data = await response.json();
  const assistant = data.message || { role: 'assistant', content: '' };
  return {
    content: assistant.content || '',
    tool_calls: assistant.tool_calls || [],
  };
}

// ---------------------------------------------------------------------------

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
  // Inject tag context so AI knows what tags are available
  const tagCtx = await buildTagContext();
  if (tagCtx) baseMessages.push({ role: 'system', content: tagCtx });

  const toolCallLog = [];
  const llmLatencies = [];
  let currentMessages = [...baseMessages, ...compact];

  for (let iteration = 0; iteration < opts.maxIterations; iteration++) {
    const llmStarted = Date.now();
    const result = await llmChat(currentMessages, TOOLS, opts);
    llmLatencies.push(Date.now() - llmStarted);

    const calls = result.tool_calls || [];
    if (calls.length === 0) {
      updateSessionState(sessionId, latestUser);
      return {
        content: result.content,
        toolCalls: toolCallLog,
        model: opts.model,
        provider: opts.provider,
        perf: {
          totalMs: Date.now() - startedAt,
          llmMs: llmLatencies.reduce((a, b) => a + b, 0),
          ragMs,
          llmCalls: llmLatencies.length,
          toolCalls: toolCallLog.length,
        },
      };
    }

    // Push assistant message with tool_calls
    currentMessages.push({ role: 'assistant', content: result.content || '', tool_calls: calls });
    for (const call of calls) {
      const toolName = call.function?.name || call.function;
      const toolArgs = parseToolArgs(call);
      const toolResult = await executeTool(toolName, toolArgs);
      toolCallLog.push({ tool: toolName, args: toolArgs, result: toolResult });
      // For OpenAI-compatible providers, tool results need tool_call_id
      currentMessages.push({
        role: 'tool',
        tool_call_id: call.id || undefined,
        content: JSON.stringify(toolResult, null, 2),
      });
    }
  }

  updateSessionState(sessionId, latestUser);
  return {
    content: 'Reached tool-calling iteration limit. Try narrowing your request.',
    toolCalls: toolCallLog,
    model: opts.model,
    provider: opts.provider,
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
  if (patch.provider) runtimeConfig.provider = patch.provider;
  runtimeConfig.ollamaUrl = next.ollamaUrl;
  runtimeConfig.defaultModel = next.model;
  runtimeConfig.temperature = next.temperature;
  runtimeConfig.numPredict = next.numPredict;
  runtimeConfig.maxIterations = next.maxIterations;
  runtimeConfig.enableRagContext = next.enableRagContext;
  return getChatConfig();
}

export async function listModels(urlOverride = null) {
  if (runtimeConfig.provider === 'github_models') {
    try {
      return await ghModels.listModels();
    } catch (err) {
      return [{ name: runtimeConfig.defaultModel, id: runtimeConfig.defaultModel, note: 'default' }];
    }
  }
  const base = urlOverride || runtimeConfig.ollamaUrl;
  const resp = await fetch(`${base}/api/tags`);
  if (!resp.ok) throw new Error(`Ollama models error: ${resp.status}`);
  const data = await resp.json();
  return data.models || [];
}

/**
 * Streaming chat — yields SSE-style event objects.
 * Supports both Ollama and GitHub Models providers.
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
  const tagCtx = await buildTagContext();
  if (tagCtx) baseMessages.push({ role: 'system', content: tagCtx });

  const toolCallLog = [];
  const llmLatencies = [];
  let currentMessages = [...baseMessages, ...compact];
  let fullContent = '';

  for (let iteration = 0; iteration < opts.maxIterations; iteration++) {
    const llmStarted = Date.now();

    let iterationContent = '';
    let detectedToolCalls = null;

    try {
      if (opts.provider === 'github_models') {
        // --- GitHub Models streaming ---
        const openaiTools = TOOLS.map(t => ({
          type: 'function',
          function: { name: t.function.name, description: t.function.description, parameters: t.function.parameters },
        }));
        const toolCallAccum = {}; // accumulate streamed tool call deltas
        for await (const chunk of ghModels.chatCompletionStream(currentMessages, openaiTools, {
          model: opts.model, temperature: opts.temperature, maxTokens: opts.numPredict,
        })) {
          const delta = chunk.delta || {};
          if (delta.content) {
            iterationContent += delta.content;
            yield { type: 'token', data: delta.content };
          }
          // Accumulate tool call deltas (OpenAI streams them in pieces)
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: '', function: { name: '', arguments: '' } };
              if (tc.id) toolCallAccum[idx].id = tc.id;
              if (tc.function?.name) toolCallAccum[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCallAccum[idx].function.arguments += tc.function.arguments;
            }
          }
        }
        const accumulated = Object.values(toolCallAccum);
        if (accumulated.length) detectedToolCalls = normalizeToolCalls(accumulated, 'github_models');
      } else {
        // --- Ollama streaming ---
        const streamResp = await fetch(`${opts.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: opts.model,
            messages: currentMessages,
            tools: TOOLS,
            stream: true,
            options: { temperature: opts.temperature, num_predict: opts.numPredict },
          }),
        });

        if (!streamResp.ok) {
          const errText = await streamResp.text().catch(() => '');
          yield { type: 'error', data: { message: `Ollama error ${streamResp.status}: ${errText}` } };
          return;
        }

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
                iterationContent += token;
                yield { type: 'token', data: token };
              }
              if (chunk.message?.tool_calls?.length) {
                detectedToolCalls = chunk.message.tool_calls;
              }
            } catch {
              // skip malformed JSON line
            }
          }
        }

        if (buffer.trim()) {
          try {
            const chunk = JSON.parse(buffer);
            const token = chunk.message?.content || '';
            if (token) {
              iterationContent += token;
              yield { type: 'token', data: token };
            }
            if (chunk.message?.tool_calls?.length) {
              detectedToolCalls = chunk.message.tool_calls;
            }
          } catch {}
        }
      }
    } catch (err) {
      yield { type: 'error', data: { message: err.message } };
      return;
    }

    llmLatencies.push(Date.now() - llmStarted);

    if (detectedToolCalls?.length) {
      const normalizedCalls = detectedToolCalls;
      const assistantMsg = { role: 'assistant', content: iterationContent || '', tool_calls: normalizedCalls };
      currentMessages.push(assistantMsg);

      for (const call of normalizedCalls) {
        const toolName = call.function?.name || call.function;
        const toolArgs = parseToolArgs(call);
        yield { type: 'tool_start', data: { tool: toolName, args: toolArgs } };
        const result = await executeTool(toolName, toolArgs);
        toolCallLog.push({ tool: toolName, args: toolArgs, result });
        yield { type: 'tool_result', data: { tool: toolName, args: toolArgs, result } };
        currentMessages.push({ role: 'tool', tool_call_id: call.id || undefined, content: JSON.stringify(result, null, 2) });
      }
      fullContent = '';
      continue;
    }

    fullContent = iterationContent;
    break;
  }

  updateSessionState(sessionId, latestUser);

  yield {
    type: 'done',
    data: {
      content: fullContent,
      toolCalls: toolCallLog,
      model: opts.model,
      provider: opts.provider,
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
