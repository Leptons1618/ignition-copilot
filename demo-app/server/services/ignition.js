/**
 * Ignition WebDev client.
 * Talks to Ignition Gateway via WebDev REST endpoints.
 * Mock/demo responses are only enabled when DEMO_MODE=true.
 */

import mock from './mockIgnition.js';
import { getServiceConfig } from '../routes/config.js';

const DEFAULT_GATEWAY = process.env.IGNITION_URL || 'http://localhost:8088';
const DEFAULT_PROJECT = process.env.IGNITION_PROJECT || 'ignition-copilot';
const DEFAULT_USERNAME = process.env.IGNITION_USER || 'anish';
const DEFAULT_PASSWORD = process.env.IGNITION_PASS || 'developer';

const REQUEST_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 15000;

const _forcedDemo = process.env.DEMO_MODE === 'true';
let _demoMode = _forcedDemo;
let _lastProbe = 0;
let _lastProbeResult = {
  ok: _forcedDemo,
  status: _forcedDemo ? 200 : null,
  error: _forcedDemo ? null : 'Not checked',
  endpoint: null,
  checkedAt: 0,
};

function summarizeBody(body = '', max = 220) {
  const clean = String(body || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
}

function toIgnitionError(message, details = {}) {
  const err = new Error(message);
  err.details = details;
  return err;
}

function getRuntimeConnectionConfig() {
  const runtime = getServiceConfig?.() || {};
  const gateway = String(runtime.ignitionUrl || DEFAULT_GATEWAY).replace(/\/+$/, '');
  const project = String(runtime.ignitionProject || DEFAULT_PROJECT).trim();
  const username = String(runtime.ignitionUser || DEFAULT_USERNAME);
  const password = String(runtime.ignitionPass || DEFAULT_PASSWORD);
  return { gateway, project, username, password };
}

function getBaseUrl(config = getRuntimeConnectionConfig()) {
  return `${config.gateway}/system/webdev/${config.project}`;
}

function getAuthHeader(config = getRuntimeConnectionConfig()) {
  return 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64');
}

function isDemoMode() {
  return _demoMode;
}

async function probeGateway(force = false) {
  if (_forcedDemo) {
    _lastProbeResult = {
      ok: true,
      status: 200,
      error: null,
      endpoint: `${getBaseUrl()}/system_info`,
      checkedAt: Date.now(),
    };
    return _lastProbeResult;
  }

  const config = getRuntimeConnectionConfig();
  const endpoint = `${getBaseUrl(config)}/system_info`;
  const now = Date.now();
  if (
    !force
    && now - _lastProbe < PROBE_INTERVAL_MS
    && _lastProbeResult.checkedAt > 0
    && _lastProbeResult.endpoint === endpoint
  ) {
    return _lastProbeResult;
  }

  _lastProbe = now;
  try {
    const resp = await fetch(endpoint, {
      headers: { Authorization: getAuthHeader(config) },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (resp.ok) {
      _lastProbeResult = { ok: true, status: resp.status, error: null, endpoint, checkedAt: now };
      return _lastProbeResult;
    }
    const body = await resp.text().catch(() => '');
    const bodySnippet = summarizeBody(body);
    const message = resp.status === 404
      ? `Ignition WebDev endpoint not found at ${endpoint}. Ensure WebDev is installed and project "${config.project}" exposes system_info.`
      : `Ignition gateway returned HTTP ${resp.status}${bodySnippet ? `: ${bodySnippet}` : ''}`;
    _lastProbeResult = { ok: false, status: resp.status, error: message, endpoint, checkedAt: now };
    return _lastProbeResult;
  } catch (err) {
    const message = `Ignition gateway probe failed: ${err.message}`;
    _lastProbeResult = { ok: false, status: null, error: message, endpoint, checkedAt: now };
    return _lastProbeResult;
  }
}

async function ensureLiveGateway() {
  const probe = await probeGateway();
  if (!probe.ok) {
    throw toIgnitionError(probe.error || 'Ignition gateway unavailable', { probe });
  }
}

async function get(resource, params = {}) {
  await ensureLiveGateway();
  const config = getRuntimeConnectionConfig();
  const url = new URL(`${getBaseUrl(config)}/${resource}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  const resp = await fetch(url.toString(), {
    headers: { Authorization: getAuthHeader(config) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw toIgnitionError(
      `Ignition request failed (${resource}) HTTP ${resp.status}${body ? `: ${summarizeBody(body)}` : ''}`,
      { status: resp.status, resource, url: url.toString(), body: summarizeBody(body) },
    );
  }
  return resp.json();
}

async function post(resource, body) {
  await ensureLiveGateway();
  const config = getRuntimeConnectionConfig();
  const url = `${getBaseUrl(config)}/${resource}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(config), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw toIgnitionError(
      `Ignition request failed (${resource}) HTTP ${resp.status}${text ? `: ${summarizeBody(text)}` : ''}`,
      { status: resp.status, resource, url, body: summarizeBody(text) },
    );
  }
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
  const probe = await probeGateway(true);
  return !!probe.ok;
}

export async function getGatewayStatus(force = false) {
  const config = getRuntimeConnectionConfig();
  const probe = await probeGateway(force);
  return {
    connected: !!probe.ok,
    gateway: config.gateway,
    project: config.project,
    endpoint: probe.endpoint,
    status: probe.status,
    error: probe.error || null,
    checkedAt: probe.checkedAt || Date.now(),
    demoMode: _demoMode,
    forcedDemo: _forcedDemo,
  };
}

export async function browseTags(path = '[default]', recursive = false) {
  if (_demoMode) return mock.browseTags(path, recursive);
  return get('tag_browse', { path, recursive: String(recursive) });
}

export async function readTags(paths) {
  const normalized = normalizePaths(paths);
  if (_demoMode) return mock.readTags(normalized);
  return get('tag_read', { paths: normalized.join(',') });
}

export async function writeTags(writes) {
  if (_demoMode) return mock.writeTags(writes);
  return post('tag_write', { writes });
}

export async function searchTags(pattern = '*', root = '[default]', tagType = '', max = 200) {
  if (_demoMode) return mock.searchTags(pattern, root, tagType, max);
  return get('tag_search', { root, pattern, tagType, max: String(max) });
}

export async function getTagConfig(path) {
  if (_demoMode) return mock.getTagConfig(path);
  return get('tag_config', { path });
}

export async function createTag(basePath, name, tagType = 'AtomicTag', dataType = 'Float8', value = 0) {
  if (_demoMode) return mock.createTag(basePath, name, tagType, dataType, value);
  return post('tag_config', { basePath, name, tagType, dataType, value });
}

export async function deleteTags(paths) {
  if (_demoMode) return mock.deleteTags(paths);
  return post('tag_delete', { paths });
}

export async function queryHistory(paths, startTime = '-1h', endTime = '', returnSize = 500) {
  if (_demoMode) return mock.queryHistory(normalizePaths(paths), startTime, endTime, returnSize);
  return post('history_query', { paths: normalizePaths(paths), startTime, endTime, returnSize });
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

function normalizeProviderName(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  const m = s.match(/^\[([^\]]+)\]/);
  return m ? m[1] : s.replace(/^\[|\]$/g, '');
}

export async function listTagProviders() {
  if (_demoMode) {
    const sys = await mock.getSystemInfo().catch(() => ({}));
    const providers = Array.isArray(sys?.info?.tagProviders) ? sys.info.tagProviders : ['default'];
    const names = [...new Set(providers.map(v => normalizeProviderName(v?.name || v)).filter(Boolean))];
    return { success: true, providers: names.length > 0 ? names : ['default'], demoMode: true };
  }

  const info = await getSystemInfo();
  const source = (info && typeof info === 'object' && info.info && typeof info.info === 'object') ? info.info : info;
  const rawProviders = Array.isArray(source?.tagProviders) ? source.tagProviders : [];
  const names = [...new Set(rawProviders.map(v => normalizeProviderName(v?.name || v)).filter(Boolean))];
  return { success: true, providers: names.length > 0 ? names : ['default'], demoMode: false };
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
  deleteTags,
  queryHistory,
  getActiveAlarms,
  queryAlarmJournal,
  getSystemInfo,
  getGatewayStatus,
  listTagProviders,
  executeExpression,
  isDemoMode,
};
