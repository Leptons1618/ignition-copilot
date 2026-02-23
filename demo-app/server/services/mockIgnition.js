/**
 * Mock Ignition service — provides realistic synthetic data when the real
 * Ignition Gateway is unavailable (trial expired, offline, etc.).
 *
 * Data mirrors the DemoPlant/MotorM12 tag structure from tags.json.
 */

// ── Tag definitions (mirrors tags.json) ─────────────────────────────────────

const TAGS = {
  '[default]': {
    name: 'default', tagType: 'Provider',
    children: ['[default]DemoPlant'],
  },
  '[default]DemoPlant': {
    name: 'DemoPlant', tagType: 'Folder', fullPath: '[default]DemoPlant',
    children: ['[default]DemoPlant/MotorM12'],
  },
  '[default]DemoPlant/MotorM12': {
    name: 'MotorM12', tagType: 'Folder', fullPath: '[default]DemoPlant/MotorM12',
    children: [
      '[default]DemoPlant/MotorM12/Speed',
      '[default]DemoPlant/MotorM12/LoadPercent',
      '[default]DemoPlant/MotorM12/Temperature',
      '[default]DemoPlant/MotorM12/Vibration',
      '[default]DemoPlant/MotorM12/Current',
      '[default]DemoPlant/MotorM12/FanCurrent',
      '[default]DemoPlant/MotorM12/Running',
      '[default]DemoPlant/MotorM12/AlarmActive',
      '[default]DemoPlant/MotorM12/Mode',
      '[default]DemoPlant/MotorM12/SimState',
      '[default]DemoPlant/MotorM12/FaultReason',
    ],
  },
  '[default]DemoPlant/MotorM12/Speed': {
    name: 'Speed', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/Speed',
    value: 1450, engUnit: 'RPM', historyEnabled: true,
    _gen: { base: 1450, noise: 30, drift: 0 },
  },
  '[default]DemoPlant/MotorM12/LoadPercent': {
    name: 'LoadPercent', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/LoadPercent',
    value: 42, engUnit: '%', historyEnabled: true,
    _gen: { base: 42, noise: 8, drift: 0.02 },
  },
  '[default]DemoPlant/MotorM12/Temperature': {
    name: 'Temperature', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/Temperature',
    value: 62, engUnit: '°C', historyEnabled: true,
    alarms: [{ name: 'HighTemp', mode: 'AboveValue', setpointA: 85, priority: 'High' }],
    _gen: { base: 62, noise: 5, drift: 0.05 },
  },
  '[default]DemoPlant/MotorM12/Vibration': {
    name: 'Vibration', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/Vibration',
    value: 2.8, engUnit: 'mm/s', historyEnabled: true,
    alarms: [{ name: 'HighVibration', mode: 'AboveValue', setpointA: 7, priority: 'Medium' }],
    _gen: { base: 2.8, noise: 0.8, drift: 0.01 },
  },
  '[default]DemoPlant/MotorM12/Current': {
    name: 'Current', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/Current',
    value: 24.5, engUnit: 'A', historyEnabled: true,
    _gen: { base: 24.5, noise: 3, drift: 0 },
  },
  '[default]DemoPlant/MotorM12/FanCurrent': {
    name: 'FanCurrent', tagType: 'AtomicTag', dataType: 'Float4',
    fullPath: '[default]DemoPlant/MotorM12/FanCurrent',
    value: 8.5, engUnit: 'A', historyEnabled: true,
    _gen: { base: 8.5, noise: 1.2, drift: 0 },
  },
  '[default]DemoPlant/MotorM12/Running': {
    name: 'Running', tagType: 'AtomicTag', dataType: 'Boolean',
    fullPath: '[default]DemoPlant/MotorM12/Running',
    value: true,
  },
  '[default]DemoPlant/MotorM12/AlarmActive': {
    name: 'AlarmActive', tagType: 'AtomicTag', dataType: 'Boolean',
    fullPath: '[default]DemoPlant/MotorM12/AlarmActive',
    value: false,
  },
  '[default]DemoPlant/MotorM12/Mode': {
    name: 'Mode', tagType: 'AtomicTag', dataType: 'String',
    fullPath: '[default]DemoPlant/MotorM12/Mode',
    value: 'Auto',
  },
  '[default]DemoPlant/MotorM12/SimState': {
    name: 'SimState', tagType: 'AtomicTag', dataType: 'String',
    fullPath: '[default]DemoPlant/MotorM12/SimState',
    value: 'NORMAL',
  },
  '[default]DemoPlant/MotorM12/FaultReason': {
    name: 'FaultReason', tagType: 'AtomicTag', dataType: 'String',
    fullPath: '[default]DemoPlant/MotorM12/FaultReason',
    value: '',
  },
};

// Runtime mutable values (so writes persist within session)
const liveValues = {};
for (const [path, tag] of Object.entries(TAGS)) {
  if (tag.value !== undefined) liveValues[path] = tag.value;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function jitter(base, noise) {
  return base + (Math.random() - 0.5) * 2 * noise;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function resolvePath(raw) {
  const p = String(raw || '').trim();
  if (TAGS[p]) return p;

  // Try adding [default] prefix
  const prefixed = p.startsWith('[default]') ? p : `[default]${p}`;
  if (TAGS[prefixed]) return prefixed;

  // Try with/without leading slash after [default]
  const alt1 = prefixed.replace('[default]/', '[default]');
  if (TAGS[alt1]) return alt1;
  const alt2 = prefixed.replace('[default]', '[default]/');
  if (TAGS[alt2]) return alt2;

  // Fuzzy: look for any tag path that ends with the significant part
  // e.g. "MotorM12/Temperature" should match "[default]DemoPlant/MotorM12/Temperature"
  const suffix = p.replace(/^\[default\]\/?/, '');
  if (suffix) {
    for (const key of Object.keys(TAGS)) {
      if (key.endsWith('/' + suffix) || key.endsWith(suffix)) return key;
    }
  }

  return p;
}

function parseTimeOffset(str) {
  const m = String(str || '-1h').match(/^-?(\d+)(s|m|h|d)$/i);
  if (!m) return 3600_000; // default 1h
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const ms = { s: 1000, m: 60_000, h: 3600_000, d: 86400_000 }[unit] || 3600_000;
  return n * ms;
}

function generateHistory(tag, startMs, endMs, count = 300) {
  const gen = tag._gen;
  if (!gen) return [];
  const step = Math.max(1, Math.floor((endMs - startMs) / count));
  const records = [];
  let val = gen.base;
  for (let ts = startMs; ts <= endMs; ts += step) {
    val = gen.base + gen.drift * ((ts - startMs) / 60_000) + (Math.random() - 0.5) * 2 * gen.noise;
    records.push({ timestamp: ts, value: round2(val), quality: 'Good' });
  }
  return records;
}

function matchPattern(name, pattern) {
  if (!pattern || pattern === '*') return true;
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
  return re.test(name);
}

// ── Public API (same signatures as real ignition.js exports) ────────────────

export async function testConnection() {
  return true; // mock always "connected"
}

export async function browseTags(path = '[default]', recursive = false) {
  const resolved = resolvePath(path);
  const tag = TAGS[resolved];
  if (!tag) return { success: true, path, count: 0, tags: [] };

  const results = [];
  const children = tag.children || [];

  for (const childPath of children) {
    const child = TAGS[childPath];
    if (!child) continue;
    const isFolder = child.tagType === 'Folder' || child.tagType === 'Provider';
    const entry = {
      name: child.name,
      path: childPath,
      fullPath: childPath,
      tagType: child.tagType,
      dataType: child.dataType || null,
      hasChildren: isFolder,
      valueSource: 'memory',
    };
    results.push(entry);

    if (recursive && isFolder) {
      const sub = await browseTags(childPath, true);
      results.push(...(sub.tags || []));
    }
  }

  return { success: true, path, count: results.length, tags: results };
}

export async function readTags(paths) {
  const normalized = Array.isArray(paths) ? paths : [paths];
  const results = [];
  for (const raw of normalized) {
    const p = resolvePath(raw);
    const tag = TAGS[p];
    if (tag && tag.tagType === 'AtomicTag') {
      let val = liveValues[p];
      // Add a tiny jitter for analog values so polling looks alive
      if (tag._gen) val = round2(jitter(tag._gen.base, tag._gen.noise * 0.15));
      results.push({ path: p, value: val, quality: 'Good', timestamp: new Date().toISOString() });
    } else {
      results.push({ path: p, value: null, quality: 'Bad', timestamp: new Date().toISOString() });
    }
  }
  return { success: true, results };
}

export async function writeTags(writes) {
  const results = [];
  for (const w of writes || []) {
    const p = resolvePath(w.path);
    if (TAGS[p]) {
      liveValues[p] = w.value;
      results.push({ path: p, success: true });
    } else {
      results.push({ path: p, success: false, error: 'Tag not found' });
    }
  }
  return { results };
}

export async function searchTags(pattern = '*', root = '[default]', tagType = '', max = 200) {
  // Normalize root: handle [default]/Foo vs [default]Foo
  const normalizedRoot = root.replace(/^\[default\]\//, '[default]').replace(/\/$/, '');
  const matches = [];
  for (const [path, tag] of Object.entries(TAGS)) {
    if (tag.tagType === 'Provider') continue;
    if (!path.startsWith(normalizedRoot)) continue;
    if (tagType && tag.tagType !== tagType) continue;
    if (!matchPattern(tag.name, pattern)) continue;
    matches.push({
      name: tag.name,
      fullPath: path,
      path,
      tagType: tag.tagType,
      dataType: tag.dataType || null,
    });
    if (matches.length >= max) break;
  }
  return { success: true, matches };
}

export async function getTagConfig(path) {
  const p = resolvePath(path);
  const tag = TAGS[p];
  if (!tag) return { error: 'Tag not found' };
  return {
    name: tag.name,
    fullPath: p,
    tagType: tag.tagType,
    dataType: tag.dataType || null,
    value: liveValues[p] ?? tag.value,
    engUnit: tag.engUnit || null,
    historyEnabled: tag.historyEnabled || false,
    alarms: tag.alarms || [],
  };
}

export async function createTag(basePath, name, tagType = 'AtomicTag', dataType = 'Float8', value = 0) {
  const full = `${basePath}/${name}`;
  TAGS[full] = {
    name, tagType, dataType, fullPath: full,
    value, _gen: dataType.toLowerCase().includes('float') ? { base: Number(value) || 0, noise: 1, drift: 0 } : undefined,
  };
  liveValues[full] = value;
  // Add to parent's children
  const parent = TAGS[basePath];
  if (parent) {
    if (!parent.children) parent.children = [];
    if (!parent.children.includes(full)) parent.children.push(full);
  }
  return { success: true, path: full };
}

export async function deleteTags(paths) {
  const results = [];
  for (const raw of paths || []) {
    const p = resolvePath(raw);
    if (TAGS[p]) {
      delete TAGS[p];
      delete liveValues[p];
      results.push({ path: p, success: true });
    } else {
      results.push({ path: p, success: false });
    }
  }
  return { results };
}

export async function queryHistory(paths, startTime = '-1h', endTime = '', returnSize = 500) {
  const now = Date.now();
  const startMs = now - parseTimeOffset(startTime);
  const endMs = endTime ? now - parseTimeOffset(endTime) : now;
  const perTag = Math.max(50, Math.floor(returnSize / Math.max(1, paths.length)));

  const data = {};
  const normalized = Array.isArray(paths) ? paths : [paths];
  for (const raw of normalized) {
    const p = resolvePath(raw);
    const tag = TAGS[p];
    if (tag && tag._gen) {
      data[p] = { records: generateHistory(tag, startMs, endMs, perTag) };
    } else {
      data[p] = { records: [] };
    }
  }
  return { data };
}

export async function getActiveAlarms(source = '', priority = '') {
  const alarms = [
    {
      id: 'alarm-001',
      source: '[default]DemoPlant/MotorM12/Temperature',
      displayPath: 'DemoPlant/MotorM12/Temperature',
      name: 'HighTemp',
      priority: 'High',
      state: 'Active',
      activeTime: Date.now() - 300_000,
      value: 87.3,
    },
    {
      id: 'alarm-002',
      source: '[default]DemoPlant/MotorM12/Vibration',
      displayPath: 'DemoPlant/MotorM12/Vibration',
      name: 'HighVibration',
      priority: 'Medium',
      state: 'Active',
      activeTime: Date.now() - 120_000,
      value: 5.2,
    },
  ];

  let filtered = alarms;
  if (source) filtered = filtered.filter(a => a.source.includes(source));
  if (priority) filtered = filtered.filter(a => a.priority.toLowerCase() === priority.toLowerCase());
  return { alarms: filtered };
}

export async function queryAlarmJournal(startTime = '-24h', max = 500) {
  const now = Date.now();
  const events = [
    { id: 'evt-001', source: '[default]DemoPlant/MotorM12/Temperature', name: 'HighTemp', priority: 'High', eventType: 'Active', timestamp: now - 7200_000, value: 86.1 },
    { id: 'evt-002', source: '[default]DemoPlant/MotorM12/Temperature', name: 'HighTemp', priority: 'High', eventType: 'Clear', timestamp: now - 5400_000, value: 74.0 },
    { id: 'evt-003', source: '[default]DemoPlant/MotorM12/Vibration', name: 'HighVibration', priority: 'Medium', eventType: 'Active', timestamp: now - 3600_000, value: 5.5 },
    { id: 'evt-004', source: '[default]DemoPlant/MotorM12/Temperature', name: 'HighTemp', priority: 'High', eventType: 'Active', timestamp: now - 1800_000, value: 87.3 },
    { id: 'evt-005', source: '[default]DemoPlant/MotorM12/Current', name: 'HighCurrent', priority: 'Low', eventType: 'Active', timestamp: now - 900_000, value: 28.4 },
    { id: 'evt-006', source: '[default]DemoPlant/MotorM12/Current', name: 'HighCurrent', priority: 'Low', eventType: 'Clear', timestamp: now - 600_000, value: 24.2 },
  ];
  return { events: events.slice(0, max) };
}

export async function getSystemInfo() {
  return {
    info: {
      gateway: {
        systemName: 'Ignition-Copilot-Demo',
        version: '8.1.44',
        edition: 'Ignition (Demo Mode)',
        state: 'RUNNING',
      },
      platform: { os: 'Windows 10', java: '17.0.9', memory: '2048 MB', processors: 8 },
      uptime: '4d 12h 30m',
      tagProviders: [{ name: 'default', tagCount: Object.keys(TAGS).filter(k => TAGS[k].tagType === 'AtomicTag').length, status: 'Running' }],
      modules: [
        { name: 'WebDev', version: '4.0.22', status: 'Running' },
        { name: 'Perspective', version: '2.1.22', status: 'Running' },
        { name: 'Tag Historian', version: '5.1.22', status: 'Running' },
        { name: 'Alarm Notification', version: '5.1.22', status: 'Running' },
      ],
      connections: { databases: 1, devices: 0, clientSessions: 2 },
    },
    _demoMode: true,
  };
}

export async function executeExpression(expression) {
  return { result: `[Demo Mode] Expression not executed: ${expression}`, _demoMode: true };
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
