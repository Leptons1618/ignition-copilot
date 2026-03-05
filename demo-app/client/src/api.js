const API = '/api';

export async function sendChat(messages, sessionId = 'default', options = {}) {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, sessionId, options }),
  });
  if (!res.ok) throw new Error(`Chat error: ${res.status}`);
  return res.json();
}

/**
 * Stream chat via SSE. Calls onEvent({ type, data }) for each event.
 * Returns an abort function.
 * Event types: 'token', 'tool_start', 'tool_result', 'done', 'error'
 *
 * Uses the non-streaming /api/chat endpoint and simulates streaming events
 * for compatibility with the Chat UI.
 */
export function streamChat(messages, sessionId = 'default', options = {}, onEvent) {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, sessionId, options }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        onEvent({ type: 'error', data: { message: `Server error ${res.status}: ${errBody || 'Unknown error'}` } });
        return;
      }

      const result = await res.json();

      // Emit tool events for each tool call
      for (const tc of (result.toolCalls || [])) {
        onEvent({ type: 'tool_start', data: { tool: tc.tool, args: tc.args } });
        onEvent({ type: 'tool_result', data: { tool: tc.tool, args: tc.args, result: tc.result } });
      }

      // Emit done event
      onEvent({
        type: 'done',
        data: {
          content: result.content,
          toolCalls: result.toolCalls,
          chartData: result.chartData,
          model: result.model,
          perf: result.perf,
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        onEvent({ type: 'error', data: { message: err.message } });
      }
    }
  })();

  return () => { controller.abort(); };
}

export async function getIgnitionStatus() {
  const res = await fetch(`${API}/ignition/status`);
  return res.json();
}

export async function browseTags(path = '[default]', recursive = false) {
  const res = await fetch(`${API}/ignition/browse?path=${encodeURIComponent(path)}&recursive=${recursive}`);
  return res.json();
}

export async function readTags(paths) {
  const res = await fetch(`${API}/ignition/read?paths=${encodeURIComponent(paths)}`);
  return res.json();
}

export async function writeTags(writes) {
  const res = await fetch(`${API}/ignition/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  return res.json();
}

export async function getTimeSeries(paths, startTime = '-1h', endTime = '', returnSize = 500) {
  const res = await fetch(`${API}/charts/timeseries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths, startTime, endTime, returnSize }),
  });
  return res.json();
}

export async function searchTags(pattern, root = '[default]') {
  const res = await fetch(`${API}/ignition/search?pattern=${encodeURIComponent(pattern)}&root=${encodeURIComponent(root)}`);
  return res.json();
}

export async function getScenarios() {
  const res = await fetch(`${API}/scenarios`);
  return res.json();
}

export async function runScenario(id) {
  const res = await fetch(`${API}/scenarios/run/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Scenario error: ${res.status}`);
  return res.json();
}

export async function searchDocs(query) {
  const res = await fetch(`${API}/rag/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function getChatTools() {
  const res = await fetch(`${API}/chat/tools`);
  return res.json();
}

export async function getChatModels() {
  const res = await fetch(`${API}/chat/models`);
  return res.json();
}

export async function getChatModelsByUrl(url) {
  const res = await fetch(`${API}/chat/models?url=${encodeURIComponent(url)}`);
  return res.json();
}

export async function getChatConfig() {
  const res = await fetch(`${API}/chat/config`);
  return res.json();
}

export async function setChatConfig(config) {
  const res = await fetch(`${API}/chat/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getRAGStats() {
  const res = await fetch(`${API}/rag/stats`);
  return res.json();
}

export async function generateDashboard(prompt, root = '[default]', timeRange = '-1h') {
  const res = await fetch(`${API}/dashboard/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, root, timeRange }),
  });
  if (!res.ok) throw new Error(`Dashboard error: ${res.status}`);
  return res.json();
}

export async function getAssetHealth(assetPath = '[default]/DemoPlant/MotorM12') {
  const res = await fetch(`${API}/insights/asset-health?assetPath=${encodeURIComponent(assetPath)}`);
  return res.json();
}

export async function getAlarmSummary(startTime = '-24h', priority = '') {
  const res = await fetch(`${API}/insights/alarm-summary?startTime=${encodeURIComponent(startTime)}&priority=${encodeURIComponent(priority)}`);
  return res.json();
}

export async function createTag(basePath, name, tagType = 'AtomicTag', dataType = 'Float8', value = 0) {
  const res = await fetch(`${API}/ignition/create-tag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basePath, name, tagType, dataType, value }),
  });
  return res.json();
}

export async function updateTagConfig(path, config = {}) {
  const res = await fetch(`${API}/ignition/update-tag`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, config }),
  });
  return res.json();
}

export async function deleteTags(paths) {
  const res = await fetch(`${API}/ignition/delete-tag`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paths }),
  });
  return res.json();
}

export async function getTagConfig(path) {
  const res = await fetch(`${API}/ignition/tag-config?path=${encodeURIComponent(path)}`);
  return res.json();
}

export async function listDashboardPresets() {
  const res = await fetch(`${API}/dashboard/presets`);
  if (!res.ok) throw new Error(`Preset list error: ${res.status}`);
  return res.json();
}

export async function saveDashboardPreset(preset) {
  const res = await fetch(`${API}/dashboard/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error(`Preset save error: ${res.status}`);
  return res.json();
}

export async function updateDashboardPreset(id, preset) {
  const res = await fetch(`${API}/dashboard/presets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preset),
  });
  if (!res.ok) throw new Error(`Preset update error: ${res.status}`);
  return res.json();
}

export async function deleteDashboardPreset(id) {
  const res = await fetch(`${API}/dashboard/presets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Preset delete error: ${res.status}`);
  return res.json();
}

export async function loadDashboardPreset(id) {
  const res = await fetch(`${API}/dashboard/presets/${encodeURIComponent(id)}/load`, { method: 'POST' });
  if (!res.ok) throw new Error(`Preset load error: ${res.status}`);
  return res.json();
}

export async function getServiceConfig() {
  const res = await fetch(`${API}/config/services`);
  return res.json();
}

export async function updateServiceConfig(config) {
  const res = await fetch(`${API}/config/services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function testServiceConnections() {
  const res = await fetch(`${API}/config/services/test`, { method: 'POST' });
  return res.json();
}
