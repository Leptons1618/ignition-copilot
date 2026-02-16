/**
 * Ignition WebDev client.
 * Talks to Ignition Gateway via WebDev REST endpoints.
 */

const GATEWAY = process.env.IGNITION_URL || 'http://localhost:8088';
const PROJECT = process.env.IGNITION_PROJECT || 'ignition-copilot';
const USERNAME = process.env.IGNITION_USER || 'anish';
const PASSWORD = process.env.IGNITION_PASS || 'developer';

const BASE = `${GATEWAY}/system/webdev/${PROJECT}`;
const AUTH = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

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

export async function testConnection() {
  try {
    const resp = await fetch(GATEWAY, {
      headers: { Authorization: AUTH },
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function browseTags(path = '[default]', recursive = false) {
  return get('tag_browse', { path, recursive: String(recursive) });
}

export async function readTags(paths) {
  return get('tag_read', { paths: Array.isArray(paths) ? paths.join(',') : paths });
}

export async function writeTags(writes) {
  return post('tag_write', { writes });
}

export async function searchTags(pattern = '*', root = '[default]', tagType = '', max = 200) {
  return get('tag_search', { root, pattern, tagType, max: String(max) });
}

export async function getTagConfig(path) {
  return get('tag_config', { path });
}

export async function createTag(basePath, name, tagType = 'AtomicTag', dataType = 'Float8', value = 0) {
  return post('tag_config', { basePath, name, tagType, dataType, value });
}

export async function deleteTags(paths) {
  return post('tag_delete', { paths });
}

export async function queryHistory(paths, startTime = '-1h', endTime = '', returnSize = 500) {
  return post('history_query', { paths, startTime, endTime, returnSize });
}

export async function getActiveAlarms(source = '', priority = '') {
  const params = {};
  if (source) params.source = source;
  if (priority) params.priority = priority;
  return get('alarm_active', params);
}

export async function queryAlarmJournal(startTime = '-24h', max = 500) {
  return post('alarm_journal', { startTime, max });
}

export async function getSystemInfo() {
  return get('system_info');
}

export async function executeExpression(expression) {
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
  deleteTags,
  queryHistory,
  getActiveAlarms,
  queryAlarmJournal,
  getSystemInfo,
  executeExpression,
};
