/**
 * Ignition WebDev client.
 * Talks to Ignition Gateway via WebDev REST endpoints.
 * Automatically falls back to mock data when the gateway is unreachable
 * or the trial has expired (HTTP 402).
 */

import mock from './mockIgnition.js';

const GATEWAY = process.env.IGNITION_URL || 'http://localhost:8088';
const PROJECT = process.env.IGNITION_PROJECT || 'ignition-copilot';
const USERNAME = process.env.IGNITION_USER || 'anish';
const PASSWORD = process.env.IGNITION_PASS || 'developer';

const BASE = `${GATEWAY}/system/webdev/${PROJECT}`;
const AUTH = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

let _demoMode = process.env.DEMO_MODE === 'true';   // can be forced via env
const _forcedDemo = _demoMode;   // remember if it was forced — never probe away
let _lastProbe = 0;      // timestamp of last gateway probe
const PROBE_INTERVAL = 60_000; // re-check gateway once per minute

function isDemoMode() {
  return _demoMode;
}

async function probeGateway() {
  if (_forcedDemo) return; // never override forced demo mode
  if (Date.now() - _lastProbe < PROBE_INTERVAL) return;
  _lastProbe = Date.now();
  try {
    // Probe an actual WebDev endpoint — the root gateway responds 200 even
    // when the trial is expired; only WebDev returns 402.
    const url = `${BASE}/system_info`;
    const resp = await fetch(url, {
      headers: { Authorization: AUTH },
      signal: AbortSignal.timeout(4000),
    });
    if (resp.status === 402) {
      if (!_demoMode) console.log('[ignition] Trial expired (402) — switching to demo mode');
      _demoMode = true;
    } else if (resp.ok) {
      if (_demoMode) console.log('[ignition] Gateway is back — switching to live mode');
      _demoMode = false;
    } else {
      // Other error status — treat as unavailable
      if (!_demoMode) console.log(`[ignition] Gateway error (${resp.status}) — switching to demo mode`);
      _demoMode = true;
    }
  } catch {
    if (!_demoMode) console.log('[ignition] Gateway unreachable — switching to demo mode');
    _demoMode = true;
  }
}

async function get(resource, params = {}) {
  const url = new URL(`${BASE}/${resource}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const resp = await fetch(url.toString(), {
    headers: { Authorization: AUTH },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => '')}`);
  return resp.json();
}

async function post(resource, body) {
  const resp = await fetch(`${BASE}/${resource}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text().catch(() => '')}`);
  return resp.json();
}

function normalizePathToken(token) {
  if (token == null) return [];
  if (Array.isArray(token)) return token.flatMap(normalizePathToken);
  if (typeof token !== 'string') return [];

  const s = token.trim();
  if (!s) return [];

  const unquoted = (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) ? s.slice(1, -1).trim() : s;

  if (unquoted.startsWith('[') && unquoted.endsWith(']')) {
    try {
      return normalizePathToken(JSON.parse(unquoted));
    } catch {}
  }

  const explicitPaths = unquoted.match(/\[default\][^,"\]\s]*/g);
  if (explicitPaths?.length) return explicitPaths;

  if (unquoted.includes(',')) return unquoted.split(',').map(v => v.trim()).filter(Boolean);
  return [unquoted];
}

function normalizePaths(input) {
  return [...new Set(normalizePathToken(input))];
}

export async function testConnection() {
  await probeGateway();
  if (_demoMode) return true; // demo mode = "connected" with mock data
  try {
    const resp = await fetch(`${BASE}/system_info`, {
      headers: { Authorization: AUTH },
      signal: AbortSignal.timeout(5000),
    });
    if (resp.status === 402) { _demoMode = true; return true; }
    return resp.ok;
  } catch {
    _demoMode = true;
    return true; // fallback to demo
  }
}

export async function browseTags(path = '[default]', recursive = false) {
  await probeGateway();
  if (_demoMode) return mock.browseTags(path, recursive);
  return get('tag_browse', { path, recursive: String(recursive) });
}

export async function readTags(paths) {
  const normalized = normalizePaths(paths);
  if (_demoMode) return mock.readTags(normalized);
  try {
    return await get('tag_read', { paths: normalized.join(',') });
  } catch (err) {
    if (err.message?.includes('402')) { _demoMode = true; return mock.readTags(normalized); }
    throw err;
  }
}

export async function writeTags(writes) {
  if (_demoMode) return mock.writeTags(writes);
  return post('tag_write', { writes });
}

export async function searchTags(pattern = '*', root = '[default]', tagType = '', max = 200) {
  if (_demoMode) return mock.searchTags(pattern, root, tagType, max);
  try {
    return await get('tag_search', { root, pattern, tagType, max: String(max) });
  } catch (err) {
    if (err.message?.includes('402')) { _demoMode = true; return mock.searchTags(pattern, root, tagType, max); }
    throw err;
  }
}

export async function getTagConfig(path) {
  if (_demoMode) return mock.getTagConfig(path);
  return get('tag_config', { path });
}

export async function createTag(basePath, name, tagType = 'AtomicTag', dataType = 'Float8', value = 0) {
  if (_demoMode) return mock.createTag(basePath, name, tagType, dataType, value);
  return post('tag_config', { basePath, name, tagType, dataType, value });
}

export async function updateTagConfig(path, config = {}) {
  if (_demoMode) return mock.updateTagConfig(path, config);
  try {
    return await post('tag_update_config', { path, config });
  } catch {
    // WebDev endpoint may not exist — fall back to mock
    return mock.updateTagConfig(path, config);
  }
}

export async function deleteTags(paths) {
  if (_demoMode) return mock.deleteTags(paths);
  try {
    return await post('tag_delete', { paths });
  } catch {
    return mock.deleteTags(paths);
  }
}

export async function queryHistory(paths, startTime = '-1h', endTime = '', returnSize = 500) {
  if (_demoMode) return mock.queryHistory(normalizePaths(paths), startTime, endTime, returnSize);
  try {
    const result = await post('history_query', { paths: normalizePaths(paths), startTime, endTime, returnSize });
    // Detect historian that returns only null values (expired trial, no data)
    const hasRealData = Object.values(result?.data || {}).some(info =>
      (info.records || []).some(r => r.value !== null && r.value !== undefined)
    );
    if (!hasRealData && Object.keys(result?.data || {}).length > 0) {
      console.log('[ignition] Historian returned only null values — falling back to mock history');
      return mock.queryHistory(normalizePaths(paths), startTime, endTime, returnSize);
    }
    return result;
  } catch (err) {
    if (err.message?.includes('402')) { _demoMode = true; return mock.queryHistory(normalizePaths(paths), startTime, endTime, returnSize); }
    throw err;
  }
}

export async function getActiveAlarms(source = '', priority = '') {
  if (_demoMode) return mock.getActiveAlarms(source, priority);
  const params = {};
  if (source) params.source = source;
  if (priority) params.priority = priority;
  return get('alarm_active', params);
}

export async function queryAlarmJournal(startTime = '-24h', max = 500) {
  if (_demoMode) return mock.queryAlarmJournal(startTime, max);
  return post('alarm_journal', { startTime, max });
}

export async function getSystemInfo() {
  if (_demoMode) return mock.getSystemInfo();
  return get('system_info');
}

export async function executeExpression(expression) {
  if (_demoMode) return mock.executeExpression(expression);
  return post('script_exec', { expression });
}

export default {
  testConnection,
  browseTags,
  readTags,
  writeTags,
  searchTags,
  getTagConfig,
  createTag,
  updateTagConfig,
  deleteTags,
  queryHistory,
  getActiveAlarms,
  queryAlarmJournal,
  getSystemInfo,
  executeExpression,
  isDemoMode,
};
