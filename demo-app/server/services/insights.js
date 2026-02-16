/**
 * Industrial insights service with simple, practical health analytics.
 */

import ignition from './ignition.js';

const METRIC_RULES = {
  temperature: { warn: 75, critical: 85, unit: 'degC', higherIsWorse: true },
  vibration: { warn: 4, critical: 7, unit: 'mm/s', higherIsWorse: true },
  load: { warn: 85, critical: 95, unit: '%', higherIsWorse: true },
  current: { warn: 90, critical: 110, unit: 'A', higherIsWorse: true },
  speed: { warn: 0, critical: 0, unit: 'RPM', higherIsWorse: false },
  pressure: { warn: 85, critical: 95, unit: '%', higherIsWorse: true },
  flow: { warn: 20, critical: 10, unit: '%', higherIsWorse: false },
  level: { warn: 20, critical: 10, unit: '%', higherIsWorse: false },
};

const METRIC_KEYWORDS = {
  temperature: ['temp', 'temperature'],
  vibration: ['vibration', 'vib'],
  load: ['load'],
  current: ['current', 'amps', 'amp'],
  speed: ['speed', 'rpm'],
  pressure: ['pressure', 'psi', 'bar'],
  flow: ['flow', 'flowrate'],
  level: ['level'],
  status: ['status', 'run', 'running', 'enabled'],
};

function lower(v) {
  return String(v || '').toLowerCase();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function classifyMetric(pathOrName) {
  const t = lower(pathOrName);
  for (const [metric, keys] of Object.entries(METRIC_KEYWORDS)) {
    if (keys.some(k => t.includes(k))) return metric;
  }
  return null;
}

function scoreMetric(metric, value) {
  const rule = METRIC_RULES[metric];
  if (!rule) return { scorePenalty: 0, severity: 'normal' };
  if (!Number.isFinite(value)) return { scorePenalty: 0, severity: 'unknown' };

  if (metric === 'speed') {
    if (value <= 0.1) return { scorePenalty: 35, severity: 'critical' };
    if (value < 10) return { scorePenalty: 15, severity: 'warning' };
    return { scorePenalty: 0, severity: 'normal' };
  }

  if (rule.higherIsWorse) {
    if (value >= rule.critical) return { scorePenalty: 30, severity: 'critical' };
    if (value >= rule.warn) return { scorePenalty: 12, severity: 'warning' };
    return { scorePenalty: 0, severity: 'normal' };
  }

  if (value <= rule.critical) return { scorePenalty: 30, severity: 'critical' };
  if (value <= rule.warn) return { scorePenalty: 12, severity: 'warning' };
  return { scorePenalty: 0, severity: 'normal' };
}

function inferAssetBase(paths = []) {
  if (!paths.length) return '[default]';
  const parts = paths[0].split('/');
  if (parts.length <= 1) return paths[0];
  return parts.slice(0, -1).join('/');
}

export async function getAssetHealth(assetPath = '[default]/DemoPlant/MotorM12') {
  const search = await ignition.searchTags('*', assetPath, '', 300).catch(() => ({ matches: [] }));
  const tags = search.matches || [];
  const byMetric = {};

  for (const t of tags) {
    const fullPath = t.fullPath || t.path || '';
    const metric = classifyMetric(fullPath || t.name);
    if (!metric || metric === 'status') continue;
    if (!byMetric[metric]) byMetric[metric] = fullPath;
  }

  const selectedPaths = Object.values(byMetric).slice(0, 12);
  if (selectedPaths.length === 0) {
    return {
      assetPath,
      score: 0,
      status: 'unknown',
      findings: ['No measurable analog tags discovered for this asset path.'],
      metrics: [],
      recommendations: ['Verify tag naming conventions for core KPIs (Temperature, Vibration, Load, Current).'],
    };
  }

  const read = await ignition.readTags(selectedPaths);
  const results = read.results || [];

  let score = 100;
  const findings = [];
  const metrics = [];

  for (const item of results) {
    const metric = classifyMetric(item.path);
    const numericValue = toNumber(item.value);
    const quality = lower(item.quality || 'good');
    const rule = METRIC_RULES[metric] || null;

    const evalResult = scoreMetric(metric, numericValue);
    score -= evalResult.scorePenalty;
    if (quality !== 'good') score -= 10;

    if (evalResult.severity === 'critical') {
      findings.push(`${metric} is in critical range at ${numericValue}${rule?.unit ? ` ${rule.unit}` : ''}.`);
    } else if (evalResult.severity === 'warning') {
      findings.push(`${metric} is approaching limit at ${numericValue}${rule?.unit ? ` ${rule.unit}` : ''}.`);
    }
    if (quality !== 'good') {
      findings.push(`${metric || item.path} quality is ${item.quality}.`);
    }

    metrics.push({
      metric: metric || item.path,
      path: item.path,
      value: item.value,
      quality: item.quality,
      severity: evalResult.severity,
      threshold: rule || null,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const status = score >= 80 ? 'healthy' : score >= 55 ? 'warning' : 'critical';

  const recommendations = [];
  if (status === 'critical') {
    recommendations.push('Plan immediate operator inspection and consider controlled slowdown/trip logic validation.');
    recommendations.push('Check cooling and mechanical condition first (fan flow, bearings, alignment).');
  } else if (status === 'warning') {
    recommendations.push('Schedule a maintenance check in the next shift window.');
    recommendations.push('Increase trend sampling and watch vibration and temperature correlation.');
  } else {
    recommendations.push('Asset is stable; continue condition-based monitoring with current thresholds.');
  }

  return { assetPath, score, status, findings, metrics, recommendations };
}

export async function summarizeAlarms(startTime = '-24h', priority = '') {
  const active = await ignition.getActiveAlarms('', priority).catch(() => ({ alarms: [] }));
  const journal = await ignition.queryAlarmJournal(startTime, 500).catch(() => ({ events: [] }));

  const activeAlarms = active.alarms || active.results || [];
  const journalEvents = journal.events || journal.results || [];

  const byPriority = {};
  for (const a of activeAlarms) {
    const p = a.priority || 'Unknown';
    byPriority[p] = (byPriority[p] || 0) + 1;
  }

  return {
    window: startTime,
    activeCount: activeAlarms.length,
    journalCount: journalEvents.length,
    byPriority,
    topActive: activeAlarms.slice(0, 10),
  };
}

export async function deriveAssetPathFromTags(paths = []) {
  const filtered = (paths || []).filter(Boolean);
  return inferAssetBase(filtered);
}
