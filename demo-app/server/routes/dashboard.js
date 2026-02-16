/**
 * Dashboard routes for generation and preset management.
 */

import { Router } from 'express';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import ignition from '../services/ignition.js';
import { getAssetHealth, summarizeAlarms, deriveAssetPathFromTags } from '../services/insights.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRESETS_FILE = join(__dirname, '..', 'data', 'dashboard-presets.json');

const router = Router();
const DEFAULT_KEYWORDS = ['temperature', 'vibration', 'speed', 'load', 'current', 'pressure', 'flow', 'level', 'status'];

function extractKeywords(prompt = '') {
  const text = String(prompt || '').toLowerCase();
  const words = text.match(/[a-z0-9_]+/g) || [];
  const unique = [...new Set(words)];
  const selected = unique.filter(w => DEFAULT_KEYWORDS.some(k => k.includes(w) || w.includes(k)));
  return selected.length > 0 ? selected : DEFAULT_KEYWORDS;
}

function isNumericType(dataType = '') {
  const t = String(dataType || '').toLowerCase();
  return t.includes('float') || t.includes('double') || t.includes('int') || t.includes('long') || t.includes('short');
}

function normalizeTag(tag) {
  return {
    name: tag.name,
    fullPath: tag.fullPath || tag.path || tag.fullpath,
    dataType: tag.dataType || '',
    tagType: tag.tagType || '',
  };
}

function metricName(path = '') {
  return path.split('/').pop() || path;
}

function buildWidgets(candidateTags, valuesByPath, chartPaths) {
  const widgets = [];
  const cardTags = candidateTags.filter(t => valuesByPath[t.fullPath]).slice(0, 6);

  for (const tag of cardTags) {
    widgets.push({
      id: `card-${tag.fullPath}`,
      type: 'kpi',
      title: metricName(tag.fullPath),
      path: tag.fullPath,
      value: valuesByPath[tag.fullPath]?.value,
      quality: valuesByPath[tag.fullPath]?.quality,
    });
  }

  const primaryCharts = chartPaths.slice(0, 4);
  if (primaryCharts.length > 0) {
    widgets.push({
      id: 'trend-main',
      type: 'trend',
      title: 'Process Trend',
      paths: primaryCharts,
    });
  }
  return widgets;
}

async function ensurePresetFile() {
  if (!existsSync(PRESETS_FILE)) {
    await writeFile(PRESETS_FILE, '[]', 'utf-8');
  }
}

async function readPresets() {
  await ensurePresetFile();
  const raw = await readFile(PRESETS_FILE, 'utf-8');
  const parsed = JSON.parse(raw || '[]');
  return Array.isArray(parsed) ? parsed : [];
}

async function writePresets(presets) {
  await ensurePresetFile();
  await writeFile(PRESETS_FILE, JSON.stringify(presets, null, 2), 'utf-8');
}

async function generateDashboardData(input = {}) {
  const { prompt = '', root = '[default]', timeRange = '-1h', maxTags = 12 } = input;
  const keywords = extractKeywords(prompt);

  const collected = [];
  const seen = new Set();
  for (const key of keywords) {
    const found = await ignition.searchTags(`*${key}*`, root, '', 50).catch(() => ({ matches: [] }));
    for (const raw of found.matches || []) {
      const tag = normalizeTag(raw);
      if (!tag.fullPath || seen.has(tag.fullPath)) continue;
      seen.add(tag.fullPath);
      collected.push(tag);
    }
    if (collected.length >= maxTags) break;
  }

  if (collected.length === 0) {
    const fallback = await ignition.searchTags('*', root, '', 80).catch(() => ({ matches: [] }));
    for (const raw of fallback.matches || []) {
      const tag = normalizeTag(raw);
      if (!tag.fullPath || seen.has(tag.fullPath)) continue;
      seen.add(tag.fullPath);
      collected.push(tag);
      if (collected.length >= maxTags) break;
    }
  }

  const selected = collected.slice(0, maxTags);
  const read = await ignition.readTags(selected.map(t => t.fullPath));
  const values = read.results || [];
  const valuesByPath = {};
  for (const v of values) valuesByPath[v.path] = v;

  const analogTags = selected
    .filter((t) => {
      const value = valuesByPath[t.fullPath]?.value;
      const numericByValue = Number.isFinite(Number(value));
      return (isNumericType(t.dataType) || numericByValue) && value !== null && value !== undefined;
    })
    .slice(0, 6)
    .map(t => t.fullPath);

  let trends = { series: [], stats: {} };
  if (analogTags.length > 0) {
    const history = await ignition.queryHistory(analogTags, timeRange, '', 240).catch(() => ({}));
    const series = [];
    for (const [path, info] of Object.entries(history?.data || history || {})) {
      const records = (info.records || []).filter(r => r.value !== null && r.value !== undefined);
      series.push({
        name: metricName(path),
        fullPath: path,
        data: records.map(r => ({ timestamp: r.timestamp, value: Number(r.value) || 0 })),
      });
    }
    trends = { series };
  }

  const assetPath = await deriveAssetPathFromTags(selected.map(t => t.fullPath));
  const assetHealth = await getAssetHealth(assetPath).catch(() => null);
  const alarmSummary = await summarizeAlarms('-8h').catch(() => null);
  const widgets = buildWidgets(selected, valuesByPath, analogTags);

  return {
    success: true,
    prompt,
    root,
    timeRange,
    selectedTags: selected,
    widgets,
    values: valuesByPath,
    trends,
    assetHealth,
    alarmSummary,
  };
}

router.post('/generate', async (req, res) => {
  try {
    const data = await generateDashboardData(req.body || {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/presets', async (req, res) => {
  try {
    const presets = await readPresets();
    res.json({ success: true, presets });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/presets', async (req, res) => {
  try {
    const { name, prompt = '', root = '[default]', timeRange = '-1h', description = '' } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: 'Preset name is required.' });
    }

    const presets = await readPresets();
    const now = new Date().toISOString();
    const preset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: String(name).trim(),
      description: String(description || '').trim(),
      prompt,
      root,
      timeRange,
      createdAt: now,
      updatedAt: now,
    };
    presets.unshift(preset);
    await writePresets(presets);
    res.json({ success: true, preset });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.put('/presets/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const presets = await readPresets();
    const idx = presets.findIndex(p => p.id === id);
    if (idx < 0) return res.status(404).json({ success: false, error: 'Preset not found.' });

    const prev = presets[idx];
    const next = {
      ...prev,
      name: req.body?.name ? String(req.body.name).trim() : prev.name,
      description: req.body?.description !== undefined ? String(req.body.description || '').trim() : prev.description,
      prompt: req.body?.prompt ?? prev.prompt,
      root: req.body?.root ?? prev.root,
      timeRange: req.body?.timeRange ?? prev.timeRange,
      updatedAt: new Date().toISOString(),
    };
    presets[idx] = next;
    await writePresets(presets);
    res.json({ success: true, preset: next });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/presets/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const presets = await readPresets();
    const next = presets.filter(p => p.id !== id);
    if (next.length === presets.length) {
      return res.status(404).json({ success: false, error: 'Preset not found.' });
    }
    await writePresets(next);
    res.json({ success: true, deletedId: id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/presets/:id/load', async (req, res) => {
  try {
    const id = req.params.id;
    const presets = await readPresets();
    const preset = presets.find(p => p.id === id);
    if (!preset) return res.status(404).json({ success: false, error: 'Preset not found.' });
    const dashboard = await generateDashboardData(preset);
    res.json({ success: true, preset, dashboard });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
