const PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2', '#ea580c', '#db2777',
];

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function extractTimePoint(point = {}) {
  const t = point.timestamp ?? point.x ?? point.time ?? point.ts;
  if (t == null) return null;
  const ms = typeof t === 'number' ? t : Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

function extractValue(point = {}) {
  return toNumber(point.value ?? point.y);
}

export function mergeSeriesData(series = []) {
  const timeline = new Map();
  const seriesNames = [];

  for (const item of series || []) {
    const name = item?.name || item?.fullPath || 'Series';
    seriesNames.push(name);
    for (const point of item?.data || []) {
      const ms = extractTimePoint(point);
      const val = extractValue(point);
      if (ms == null || val == null) continue;
      if (!timeline.has(ms)) timeline.set(ms, { time: ms });
      timeline.get(ms)[name] = val;
    }
  }

  const mergedData = [...timeline.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, row]) => row);

  return { mergedData, seriesNames: [...new Set(seriesNames)] };
}

export function formatTime(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(ms)) return String(value ?? '');
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function getColor(index = 0) {
  return PALETTE[Math.abs(index) % PALETTE.length];
}

export default { mergeSeriesData, formatTime, getColor };
