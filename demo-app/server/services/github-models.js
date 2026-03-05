/**
 * GitHub Models LLM service — drop-in alternative to Ollama.
 *
 * Uses the GitHub Models inference API (OpenAI-compatible) at
 * https://models.inference.ai.azure.com with a GitHub PAT for auth.
 *
 * Supports: chat completions, tool calling, streaming, model listing.
 *
 * Environment:
 *   GITHUB_TOKEN        — GitHub Personal Access Token (needs models:read scope)
 *   GITHUB_MODELS_MODEL — default model id (default: openai/gpt-4.1-mini)
 */

const GITHUB_MODELS_URL = 'https://models.inference.ai.azure.com';
const DEFAULT_MODEL = process.env.GITHUB_MODELS_MODEL || 'openai/gpt-4.1-mini';

function getToken() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN env var is required for GitHub Models provider');
  return token;
}

/**
 * Non-streaming chat completion with tool calling.
 * @param {object[]} messages - OpenAI-format messages
 * @param {object[]} tools - tool definitions
 * @param {object} opts - { model, temperature, maxTokens }
 * @returns {{ message: object, usage: object }}
 */
export async function chatCompletion(messages, tools = [], opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
    stream: false,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const resp = await fetch(`${GITHUB_MODELS_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`GitHub Models error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  return {
    message: data.choices?.[0]?.message || { role: 'assistant', content: '' },
    usage: data.usage || {},
  };
}

/**
 * Streaming chat completion — yields line-by-line SSE chunks.
 * @param {object[]} messages
 * @param {object[]} tools
 * @param {object} opts
 * @yields {{ delta: object, finish_reason: string|null }}
 */
export async function* chatCompletionStream(messages, tools = [], opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const body = {
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1024,
    stream: true,
  };
  if (tools.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const resp = await fetch(`${GITHUB_MODELS_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    throw new Error(`GitHub Models stream error ${resp.status}: ${errText}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const payload = trimmed.slice(6);
      if (payload === '[DONE]') return;
      try {
        const chunk = JSON.parse(payload);
        const choice = chunk.choices?.[0];
        if (choice) {
          yield { delta: choice.delta || {}, finish_reason: choice.finish_reason };
        }
      } catch {
        // skip malformed SSE line
      }
    }
  }
}

/**
 * List available models from GitHub Models catalog.
 * @returns {object[]}
 */
export async function listModels() {
  const resp = await fetch(`${GITHUB_MODELS_URL}/models`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!resp.ok) throw new Error(`GitHub Models list error: ${resp.status}`);
  const data = await resp.json();
  return (data.data || data || []).map(m => ({
    id: m.id,
    name: m.id,
    owned_by: m.owned_by || '',
  }));
}

export { DEFAULT_MODEL, GITHUB_MODELS_URL };
