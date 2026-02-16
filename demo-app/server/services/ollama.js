/**
 * Ollama LLM service with tool calling and session-aware context.
 */

import ignition from './ignition.js';
import { searchDocs } from './rag.js';
import { getAssetHealth } from './insights.js';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

const MAX_ITERATIONS = 5;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_CONTEXT_CHARS = 8000;
const MAX_SESSION_INTENTS = 6;

const sessionState = new Map();

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'browse_tags',
      description: 'Browse Ignition tags at a path. Returns children with type info.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Tag path e.g. [default], [default]MyFolder', default: '[default]' },
          recursive: { type: 'boolean', description: 'Browse recursively', default: false },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_tags',
      description: 'Read current values of one or more Ignition tags.',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Tag paths to read' },
        },
        required: ['paths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'write_tag',
      description: 'Write a value to an Ignition tag.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Full tag path' },
          value: { description: 'Value to write' },
        },
        required: ['path', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tags',
      description: 'Search for tags by name pattern. Use *pattern* for contains, pattern* for starts-with.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern e.g. *Temp*', default: '*' },
          root: { type: 'string', description: 'Root path to search under', default: '[default]' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_history',
      description: 'Query historical data for tags. Returns time series data for charting.',
      parameters: {
        type: 'object',
        properties: {
          paths: { type: 'array', items: { type: 'string' }, description: 'Tag paths' },
          startTime: { type: 'string', description: 'Start time: -1h, -30m, -2d, or ISO', default: '-1h' },
          endTime: { type: 'string', description: 'End time: empty=now, or ISO/relative', default: '' },
          returnSize: { type: 'integer', description: 'Max data points', default: 500 },
        },
        required: ['paths'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_active_alarms',
      description: 'Get currently active alarms with optional filters.',
      parameters: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'Filter by source path', default: '' },
          priority: { type: 'string', description: 'Filter by priority: Critical, High, Medium, Low', default: '' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_alarm_journal',
      description: 'Query alarm journal events over a time window.',
      parameters: {
        type: 'object',
        properties: {
          startTime: { type: 'string', description: 'Start time like -24h, -8h, or ISO', default: '-24h' },
          max: { type: 'integer', description: 'Max events to return', default: 200 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_system_info',
      description: 'Get Ignition Gateway system information - version, uptime, performance, tag providers.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_asset_health',
      description: 'Compute asset health score and recommendations from common process metrics.',
      parameters: {
        type: 'object',
        properties: {
          assetPath: { type: 'string', description: 'Asset base path like [default]/DemoPlant/MotorM12' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_tag',
      description: 'Create a new tag in Ignition.',
      parameters: {
        type: 'object',
        properties: {
          basePath: { type: 'string', description: 'Parent folder path e.g. [default]MyFolder' },
          name: { type: 'string', description: 'New tag name' },
          dataType: { type: 'string', description: 'Float8, Float4, Int4, Boolean, String', default: 'Float8' },
          value: { description: 'Initial value', default: 0 },
        },
        required: ['basePath', 'name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_tag_config',
      description: 'Get configuration and properties of a tag.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Full tag path' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_docs',
      description: 'Search Ignition documentation and manuals for information about features, scripting, and configuration.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'What to search for in the docs' },
        },
        required: ['query'],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Ignition Copilot, an assistant for Inductive Automation Ignition.

You can:
- Browse, read, write, search, create, and configure tags
- Query historical tag data for trends
- Check active alarms and alarm history
- Get gateway system information
- Estimate asset health with operator-style recommendations
- Search Ignition documentation

Rules:
1) For live values, always call tools instead of guessing.
2) For trends/charts, call query_history.
3) For product usage or configuration questions, call search_docs.
4) For maintenance or reliability questions, call get_asset_health.
5) Use full tag paths (example: [default]Folder/Tag).
6) If tag structure is unknown, call browse_tags first.
7) Be concise and operationally useful.`;

async function executeTool(name, args = {}) {
  try {
    switch (name) {
      case 'browse_tags':
        return await ignition.browseTags(args.path, args.recursive);
      case 'read_tags':
        return await ignition.readTags(args.paths);
      case 'write_tag':
        return await ignition.writeTags([{ path: args.path, value: args.value }]);
      case 'search_tags':
        return await ignition.searchTags(args.pattern, args.root);
      case 'query_history':
        return await ignition.queryHistory(args.paths, args.startTime, args.endTime, args.returnSize);
      case 'get_active_alarms':
        return await ignition.getActiveAlarms(args.source, args.priority);
      case 'query_alarm_journal':
        return await ignition.queryAlarmJournal(args.startTime, args.max);
      case 'get_system_info':
        return await ignition.getSystemInfo();
      case 'get_asset_health':
        return await getAssetHealth(args.assetPath || '[default]/DemoPlant/MotorM12');
      case 'create_tag':
        return await ignition.createTag(args.basePath, args.name, 'AtomicTag', args.dataType || 'Float8', args.value ?? 0);
      case 'get_tag_config':
        return await ignition.getTagConfig(args.path);
      case 'search_docs':
        return await searchDocs(args.query, 5);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

function normalizeIncomingMessages(messages) {
  return (messages || [])
    .filter(m => m && typeof m.content === 'string')
    .map(m => ({
      role: m.role || 'user',
      content: String(m.content || ''),
    }));
}

function compactMessages(messages) {
  const normalized = normalizeIncomingMessages(messages);
  const compact = [];
  let charCount = 0;

  for (let i = normalized.length - 1; i >= 0; i--) {
    const msg = normalized[i];
    const nextChars = msg.content.length + 32;
    if (compact.length >= MAX_CONTEXT_MESSAGES) break;
    if (charCount + nextChars > MAX_CONTEXT_CHARS) break;
    compact.push(msg);
    charCount += nextChars;
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
  if (!text) return false;
  return /(how|configure|setup|best practice|alarm|history|gateway|tag|ignition|perspective|vision|script)/i.test(text);
}

function toShortLine(text, maxLen = 180) {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}...` : oneLine;
}

function getSessionContextMessage(sessionId) {
  const state = sessionState.get(sessionId);
  if (!state) return null;
  if (!Array.isArray(state.intents) || state.intents.length === 0) return null;
  const intents = state.intents.map((x, i) => `${i + 1}. ${x}`).join('\n');
  return `Session context from earlier turns:\n${intents}`;
}

function updateSessionState(sessionId, latestUserMessage) {
  if (!sessionId || !latestUserMessage) return;
  const existing = sessionState.get(sessionId) || { intents: [], updatedAt: 0 };
  const intent = toShortLine(latestUserMessage, 220);
  if (!existing.intents.includes(intent)) {
    existing.intents.push(intent);
  }
  if (existing.intents.length > MAX_SESSION_INTENTS) {
    existing.intents = existing.intents.slice(-MAX_SESSION_INTENTS);
  }
  existing.updatedAt = Date.now();
  sessionState.set(sessionId, existing);
}

async function buildRagContextMessage(query) {
  try {
    const docs = await searchDocs(query, 3, { minScore: 0.35, maxChars: 500 });
    if (!docs.results || docs.results.length === 0) return null;
    const lines = docs.results
      .slice(0, 3)
      .map((r, idx) => `${idx + 1}. [${r.source}] score=${r.score}: ${toShortLine(r.text, 280)}`)
      .join('\n');
    return `Relevant Ignition documentation snippets:\n${lines}`;
  } catch {
    return null;
  }
}

function getToolArgs(tc) {
  const args = tc?.function?.arguments;
  if (!args) return {};
  if (typeof args === 'string') {
    try {
      return JSON.parse(args);
    } catch {
      return {};
    }
  }
  return args;
}

export async function chat(messages, options = {}) {
  let sessionId = 'default';
  let onToolCall = null;

  if (typeof options === 'function') {
    onToolCall = options;
  } else {
    sessionId = options.sessionId || 'default';
    onToolCall = options.onToolCall || null;
  }

  const compact = compactMessages(messages);
  const latestUserMessage = getLastUserMessage(compact);
  const sessionContext = getSessionContextMessage(sessionId);
  const ragContext = shouldInjectDocs(latestUserMessage) ? await buildRagContextMessage(latestUserMessage) : null;

  const baseMessages = [{ role: 'system', content: SYSTEM_PROMPT }];
  if (sessionContext) baseMessages.push({ role: 'system', content: sessionContext });
  if (ragContext) baseMessages.push({ role: 'system', content: ragContext });

  const toolCallLog = [];
  let currentMessages = [...baseMessages, ...compact];
  let iterations = 0;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: currentMessages,
        tools: TOOLS,
        stream: false,
        options: { temperature: 0.2, num_predict: 1200 },
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const assistantMsg = data.message || { role: 'assistant', content: '' };

    if (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) {
      updateSessionState(sessionId, latestUserMessage);
      return {
        content: assistantMsg.content,
        toolCalls: toolCallLog,
        model: MODEL,
      };
    }

    currentMessages.push(assistantMsg);

    for (const tc of assistantMsg.tool_calls) {
      const toolName = tc.function.name;
      const toolArgs = getToolArgs(tc);

      if (onToolCall) onToolCall(toolName, toolArgs);

      const result = await executeTool(toolName, toolArgs);
      toolCallLog.push({ tool: toolName, args: toolArgs, result });

      currentMessages.push({
        role: 'tool',
        content: JSON.stringify(result, null, 2),
      });
    }
  }

  updateSessionState(sessionId, latestUserMessage);
  return {
    content: 'I executed multiple tool calls but reached the iteration limit.',
    toolCalls: toolCallLog,
    model: MODEL,
    maxIterationsReached: true,
  };
}

export async function listModels() {
  const resp = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!resp.ok) throw new Error(`Ollama models error: ${resp.status}`);
  const data = await resp.json();
  return data.models || [];
}

export { TOOLS, SYSTEM_PROMPT };
