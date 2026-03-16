/**
 * Ollama LLM service with tool calling, runtime config, and latency instrumentation.
 */

import ignition from './ignition.js';
import { searchDocs } from './rag.js';
import { getAssetHealth } from './insights.js';

const DEFAULT_OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const DEFAULT_PROVIDER = process.env.LLM_PROVIDER || 'none';
const DEFAULT_BASE_URL = process.env.LLM_BASE_URL || '';
const DEFAULT_API_KEY = process.env.LLM_API_KEY || '';

const PROVIDERS = {
  NONE: 'none',
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  OPENAI_COMPATIBLE: 'openai-compatible',
  GOOGLE: 'google',
  ANTHROPIC: 'anthropic',
};

const HARD_LIMITS = {
  maxIterations: 6,
  maxNumPredict: 2048,
  minNumPredict: 64,
};

const runtimeConfig = {
  provider: DEFAULT_PROVIDER,
  baseUrl: DEFAULT_BASE_URL,
  apiKey: DEFAULT_API_KEY,
  ollamaUrl: process.env.OLLAMA_URL || '',
  defaultModel: process.env.LLM_MODEL || '',
  temperature: 0.2,
  numPredict: 900,
  maxIterations: 4,
  enableRagContext: true,
};
const INTERNAL_API_BASE = process.env.INTERNAL_API_BASE || `http://localhost:${process.env.PORT || 3001}`;

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
  { type: 'function', function: { name: 'plan_project_changes', description: 'Create an AI proposal for project/view/script/query/tag updates. Returns a planId and preview; requires confirmation before applying.', parameters: { type: 'object', properties: { project: { type: 'string' }, instruction: { type: 'string' }, operations: { type: 'array', items: { type: 'object' } } }, required: ['project'] } } },
  { type: 'function', function: { name: 'apply_project_changes', description: 'Apply a previously planned project change set after explicit user confirmation.', parameters: { type: 'object', properties: { planId: { type: 'string' } }, required: ['planId'] } } },
  { type: 'function', function: { name: 'revert_project_changes', description: 'Revert a previously applied project change set using revisionId.', parameters: { type: 'object', properties: { revisionId: { type: 'string' } }, required: ['revisionId'] } } },
];

const SYSTEM_PROMPT = `You are Ignition Copilot, an assistant for Ignition SCADA operations.
Rules:
1) For live values, call tools instead of guessing.
2) For trends/charts, call query_history.
3) For setup/config/how-to, call search_docs.
4) For reliability/maintenance, call get_asset_health.
5) Use full tag paths like [default]Folder/Tag.
6) For project edits, call plan_project_changes first, show the plan, and only call apply_project_changes after explicit user confirmation.
7) Keep responses concise, actionable, and operator-safe.`;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function mergeRuntimeOptions(options = {}) {
  const provider = normalizeProvider(options.provider || runtimeConfig.provider);
  const baseUrl = String(options.baseUrl || runtimeConfig.baseUrl || runtimeConfig.ollamaUrl || '').trim();
  const ollamaUrl = String(options.ollamaUrl || runtimeConfig.ollamaUrl || baseUrl || DEFAULT_OLLAMA_URL).trim();
  const out = {
    provider,
    baseUrl,
    apiKey: options.apiKey !== undefined ? String(options.apiKey || '') : runtimeConfig.apiKey,
    model: options.model || runtimeConfig.defaultModel || '',
    ollamaUrl,
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

function normalizeProvider(provider) {
  const p = String(provider || '').trim().toLowerCase();
  if (p === PROVIDERS.NONE || p === PROVIDERS.OPENAI || p === PROVIDERS.OLLAMA || p === PROVIDERS.GOOGLE || p === PROVIDERS.ANTHROPIC || p === PROVIDERS.OPENAI_COMPATIBLE) {
    return p;
  }
  return PROVIDERS.NONE;
}

function supportsToolCalling(provider) {
  const p = normalizeProvider(provider);
  return p === PROVIDERS.OLLAMA || p === PROVIDERS.OPENAI || p === PROVIDERS.OPENAI_COMPATIBLE;
}

function normalizeBaseUrl(provider, baseUrl, ollamaUrl = runtimeConfig.ollamaUrl) {
  const p = normalizeProvider(provider);
  if (p === PROVIDERS.NONE) return '';
  if (p === PROVIDERS.OLLAMA) return (ollamaUrl || baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
  if (p === PROVIDERS.OPENAI) return (baseUrl || 'https://api.openai.com').replace(/\/$/, '');
  if (p === PROVIDERS.GOOGLE) return (baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  if (p === PROVIDERS.ANTHROPIC) return (baseUrl || 'https://api.anthropic.com').replace(/\/$/, '');
  return (baseUrl || '').replace(/\/$/, '');
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === 'string' ? part : part?.text || ''))
      .filter(Boolean)
      .join('\n');
  }
  return String(content || '');
}

function toOpenAiMessages(messages) {
  return (messages || []).map((m) => {
    const out = { role: m.role, content: normalizeMessageContent(m.content) };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) out.tool_calls = m.tool_calls;
    if (m.role === 'tool' && m.tool_call_id) out.tool_call_id = m.tool_call_id;
    return out;
  });
}

function toGeminiContents(messages) {
  return (messages || [])
    .filter(m => m.role !== 'tool')
    .map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const prefix = m.role === 'system' ? '[System]\n' : '';
      return { role, parts: [{ text: `${prefix}${normalizeMessageContent(m.content)}`.trim() }] };
    })
    .filter(m => m.parts[0].text);
}

async function resolveAvailableModel(requestedModel, opts = {}) {
  const provider = normalizeProvider(opts.provider || runtimeConfig.provider);
  const requested = String(requestedModel || '').trim();

  if (provider === PROVIDERS.NONE) {
    return '';
  }

  if (provider === PROVIDERS.GOOGLE || provider === PROVIDERS.ANTHROPIC) {
    return requested || runtimeConfig.defaultModel;
  }

  try {
    const models = await listModels(opts.baseUrl || runtimeConfig.baseUrl, provider, opts.apiKey || runtimeConfig.apiKey);
    const names = (models || [])
      .map(m => (typeof m === 'string' ? m : m?.name))
      .filter(Boolean);

    if (names.length === 0) return requested || runtimeConfig.defaultModel;
    if (requested && names.includes(requested)) return requested;

    const fallback = names[0];
    runtimeConfig.defaultModel = fallback;
    return fallback;
  } catch {
    return requested || runtimeConfig.defaultModel;
  }
}

async function requestAssistantMessage(messages, opts) {
  const provider = normalizeProvider(opts.provider);
  const model = opts.model;
  const base = normalizeBaseUrl(provider, opts.baseUrl, opts.ollamaUrl);

  if (provider === PROVIDERS.NONE) {
    throw new Error('LLM provider is not configured. Open Settings and select Local LLM or API provider first.');
  }
  if (!base) {
    throw new Error('LLM base URL is missing. Configure provider URL in Settings.');
  }
  if (!model) {
    throw new Error('Default model is missing. Set a model in Settings before chatting.');
  }

  if (provider === PROVIDERS.OLLAMA) {
    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOLS,
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
    return { assistant, calls: assistant.tool_calls || [] };
  }

  if (provider === PROVIDERS.OPENAI || provider === PROVIDERS.OPENAI_COMPATIBLE) {
    const response = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey || ''}`,
      },
      body: JSON.stringify({
        model,
        messages: toOpenAiMessages(messages),
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: opts.temperature,
        max_tokens: opts.numPredict,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const assistant = data?.choices?.[0]?.message || { role: 'assistant', content: '' };
    return { assistant, calls: assistant.tool_calls || [] };
  }

  if (provider === PROVIDERS.GOOGLE) {
    const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(opts.apiKey || '')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        generationConfig: {
          temperature: opts.temperature,
          maxOutputTokens: opts.numPredict,
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Google LLM error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p?.text || '').join('') || '';
    return { assistant: { role: 'assistant', content: text }, calls: [] };
  }

  if (provider === PROVIDERS.ANTHROPIC) {
    const systemMessages = (messages || []).filter(m => m.role === 'system').map(m => normalizeMessageContent(m.content)).join('\n\n');
    const convo = (messages || [])
      .filter(m => m.role !== 'system' && m.role !== 'tool')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: normalizeMessageContent(m.content) }));

    const response = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessages || undefined,
        messages: convo,
        temperature: opts.temperature,
        max_tokens: opts.numPredict,
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Anthropic error ${response.status}: ${errText}`);
    }
    const data = await response.json();
    const text = (data?.content || []).map(part => part?.text || '').join('');
    return { assistant: { role: 'assistant', content: text }, calls: [] };
  }

  throw new Error(`Unsupported provider: ${provider}`);
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

async function callProjectApi(path, body = {}, method = 'POST') {
  const resp = await fetch(`${INTERNAL_API_BASE}/api/projects${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    throw new Error(data.error || `Project API error: ${resp.status}`);
  }
  return data;
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
      case 'plan_project_changes': return await callProjectApi('/ai/plan', {
        project: args.project,
        instruction: args.instruction || '',
        operations: Array.isArray(args.operations) ? args.operations : undefined,
      });
      case 'apply_project_changes': return await callProjectApi('/ai/apply', { planId: args.planId });
      case 'revert_project_changes': return await callProjectApi('/ai/revert', { revisionId: args.revisionId });
      default: return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

export async function chat(messages, options = {}) {
  const startedAt = Date.now();
  const opts = mergeRuntimeOptions(options);
  opts.model = await resolveAvailableModel(opts.model, opts);
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
  const canUseTools = supportsToolCalling(opts.provider);
  const iterationLimit = canUseTools ? opts.maxIterations : 1;

  for (let iteration = 0; iteration < iterationLimit; iteration++) {
    const llmStarted = Date.now();
    const { assistant, calls } = await requestAssistantMessage(currentMessages, opts);
    llmLatencies.push(Date.now() - llmStarted);

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
      currentMessages.push({
        role: 'tool',
        content: JSON.stringify(result, null, 2),
        tool_call_id: call.id || undefined,
      });
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
  return {
    ...runtimeConfig,
    provider: normalizeProvider(runtimeConfig.provider),
  };
}

export function updateChatConfig(patch = {}) {
  const next = mergeRuntimeOptions(patch);
  runtimeConfig.provider = next.provider;
  runtimeConfig.baseUrl = normalizeBaseUrl(next.provider, next.baseUrl, next.ollamaUrl);
  runtimeConfig.apiKey = next.apiKey;
  runtimeConfig.ollamaUrl = next.ollamaUrl;
  runtimeConfig.defaultModel = next.model;
  runtimeConfig.temperature = next.temperature;
  runtimeConfig.numPredict = next.numPredict;
  runtimeConfig.maxIterations = next.maxIterations;
  runtimeConfig.enableRagContext = next.enableRagContext;
  return getChatConfig();
}

export async function listModels(urlOverride = null, providerOverride = null, apiKeyOverride = null) {
  const provider = normalizeProvider(providerOverride || runtimeConfig.provider);
  const base = normalizeBaseUrl(provider, urlOverride || runtimeConfig.baseUrl, runtimeConfig.ollamaUrl);
  const apiKey = apiKeyOverride ?? runtimeConfig.apiKey;

  if (provider === PROVIDERS.NONE) {
    return [];
  }

  if (provider === PROVIDERS.OLLAMA) {
    const resp = await fetch(`${base}/api/tags`);
    if (!resp.ok) throw new Error(`Ollama models error: ${resp.status}`);
    const data = await resp.json();
    return data.models || [];
  }

  if (provider === PROVIDERS.OPENAI || provider === PROVIDERS.OPENAI_COMPATIBLE) {
    const resp = await fetch(`${base}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey || ''}` },
    });
    if (!resp.ok) throw new Error(`LLM models error: ${resp.status}`);
    const data = await resp.json();
    return (data.data || []).map(m => ({ name: m.id }));
  }

  if (provider === PROVIDERS.GOOGLE) {
    const resp = await fetch(`${base}/v1beta/models?key=${encodeURIComponent(apiKey || '')}`);
    if (!resp.ok) throw new Error(`Google models error: ${resp.status}`);
    const data = await resp.json();
    return (data.models || [])
      .map(m => m?.name || '')
      .filter(Boolean)
      .map(name => ({ name: name.replace(/^models\//, '') }));
  }

  if (provider === PROVIDERS.ANTHROPIC) {
    const resp = await fetch(`${base}/v1/models`, {
      headers: {
        'x-api-key': apiKey || '',
        'anthropic-version': '2023-06-01',
      },
    });
    if (!resp.ok) throw new Error(`Anthropic models error: ${resp.status}`);
    const data = await resp.json();
    return (data.data || []).map(m => ({ name: m.id }));
  }

  return [];
}

/**
 * Streaming chat endpoint compatibility wrapper.
 * Uses the stable non-streaming chat engine and emits SSE-style events.
 */
export async function* chatStream(messages, options = {}) {
  try {
    const result = await chat(messages, options);
    for (const tc of result.toolCalls || []) {
      yield { type: 'tool_start', data: { tool: tc.tool, args: tc.args || {} } };
      yield { type: 'tool_result', data: { tool: tc.tool, args: tc.args || {}, result: tc.result } };
    }
    if (result.content) yield { type: 'token', data: result.content };
    yield {
      type: 'done',
      data: {
        content: result.content || '',
        toolCalls: result.toolCalls || [],
        model: result.model,
        perf: result.perf,
      },
    };
  } catch (err) {
    yield { type: 'error', data: { message: err.message || String(err) } };
  }
}

export { TOOLS, SYSTEM_PROMPT };
