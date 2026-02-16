import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { getTimeSeries, browseTags, readTags } from '../api.js';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0891b2', '#ea580c'];

const TIME_RANGES = [
  { label: '5m', value: '-5m' },
  { label: '15m', value: '-15m' },
  { label: '30m', value: '-30m' },
  { label: '1h', value: '-1h' },
  { label: '6h', value: '-6h' },
  { label: '24h', value: '-24h' },
];

const CHART_TYPES = [
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' },
  { label: 'Bar', value: 'bar' },
];

export default function DynamicChart({ chartRequest }) {
  const [tagPaths, setTagPaths] = useState('');
  const [timeRange, setTimeRange] = useState('-1h');
  const [chartType, setChartType] = useState('line');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [availableTags, setAvailableTags] = useState([]);
  const [liveValues, setLiveValues] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await browseTags('[default]');
        if (result.success) {
          setAvailableTags(result.tags || []);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (chartRequest) {
      const tags = chartRequest.tags || chartRequest.paths || [];
      const range = chartRequest.range || chartRequest.startTime || '-1h';
      if (Array.isArray(tags) && tags.length > 0) {
        setTagPaths(tags.join(', '));
        setTimeRange(range);
        fetchChart(tags, range);
      }
    }
  }, [chartRequest]);

  const fetchChart = useCallback(async (paths, range) => {
    const tagArray = paths || tagPaths.split(',').map(t => t.trim()).filter(Boolean);
    const r = range || timeRange;
    if (tagArray.length === 0) return;

    setLoading(true);
    setError(null);
    try {
      const result = await getTimeSeries(tagArray, r);
      if (result.success !== false) {
        setChartData(result);
      } else {
        setError(result.error || 'Failed to fetch chart data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tagPaths, timeRange]);

  const readLive = async () => {
    const tagArray = tagPaths.split(',').map(t => t.trim()).filter(Boolean);
    if (tagArray.length === 0) return;
    try {
      const result = await readTags(tagArray);
      if (result.success) setLiveValues(result.results);
    } catch {}
  };

  const addTag = (tagName) => {
    const fullPath = `[default]/${tagName}`;
    const current = tagPaths ? tagPaths.split(',').map(t => t.trim()) : [];
    if (!current.includes(fullPath)) {
      setTagPaths(current.length > 0 ? `${tagPaths}, ${fullPath}` : fullPath);
    }
  };

  const { mergedData, seriesNames } = React.useMemo(() => {
    if (!chartData || !chartData.series) return { mergedData: [], seriesNames: [] };

    const merged = {};
    const names = [];

    chartData.series.forEach((s, idx) => {
      const name = s.name || s.tagPath || `Series ${idx + 1}`;
      names.push(name);
      if (Array.isArray(s.data)) {
        s.data.forEach(pt => {
          const ts = pt.timestamp || pt.t || pt.x;
          if (!merged[ts]) merged[ts] = { time: ts };
          merged[ts][name] = pt.value ?? pt.v ?? pt.y;
        });
      }
    });

    const sorted = Object.values(merged).sort((a, b) =>
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    return { mergedData: sorted, seriesNames: names };
  }, [chartData]);

  const formatTime = (ts) => {
    try {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch { return ts; }
  };

  const renderChart = () => {
    const common = {
      data: mergedData,
      children: [
        <CartesianGrid key="g" strokeDasharray="3 3" stroke="#e5e7eb" />,
        <XAxis key="x" dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 11 }} />,
        <YAxis key="y" stroke="#9ca3af" tick={{ fontSize: 11 }} />,
        <Tooltip key="t" contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} labelFormatter={formatTime} />,
        seriesNames.length > 1 ? <Legend key="l" /> : null,
      ].filter(Boolean),
    };

    const lines = seriesNames.map((name, i) => {
      const color = COLORS[i % COLORS.length];
      if (chartType === 'bar') return <Bar key={name} dataKey={name} fill={color} name={name} />;
      if (chartType === 'area') return <Area key={name} type="monotone" dataKey={name} stroke={color} fill={color} fillOpacity={0.1} name={name} />;
      return <Line key={name} type="monotone" dataKey={name} stroke={color} strokeWidth={2} dot={false} name={name} />;
    });

    const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'area' ? AreaChart : LineChart;

    return (
      <ResponsiveContainer width="100%" height={400}>
        <ChartComponent data={mergedData}>
          {common.children}
          {lines}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto bg-gray-50">
      {/* Controls */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2">
          <input
            value={tagPaths}
            onChange={e => setTagPaths(e.target.value)}
            placeholder="Enter tag paths, comma-separated (e.g., [default]/MotorM12/Temp, [default]/MotorM12/Speed)"
            className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm shadow-sm"
          />
          <button
            onClick={() => fetchChart()}
            disabled={loading || !tagPaths.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg text-white font-medium transition-colors shadow-sm"
          >
            {loading ? '...' : 'Chart'}
          </button>
          <button
            onClick={readLive}
            disabled={!tagPaths.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg text-white font-medium transition-colors shadow-sm"
          >
            Live
          </button>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex gap-1">
            {TIME_RANGES.map(r => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  timeRange === r.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex gap-1">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => setChartType(ct.value)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  chartType === ct.value ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-500 hover:text-gray-900 border border-gray-200'
                }`}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </div>

        {/* Quick-add tags */}
        {availableTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-gray-400 mr-1 self-center">Quick add:</span>
            {availableTags.slice(0, 12).map((tag, i) => (
              <button
                key={i}
                onClick={() => addTag(tag.name)}
                className="px-2 py-0.5 bg-white hover:bg-gray-50 border border-gray-200 rounded text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Live values */}
      {liveValues && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          {liveValues.map((v, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
              <div className="text-xs text-gray-400 truncate">{v.path}</div>
              <div className="text-lg font-mono text-gray-900">{typeof v.value === 'number' ? v.value.toFixed(2) : String(v.value)}</div>
              <div className={`text-xs ${v.quality === 'Good' ? 'text-green-600' : 'text-amber-600'}`}>{v.quality}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {mergedData.length > 0 ? (
        <div className="flex-1 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-gray-900 font-medium">
              {seriesNames.join(', ')}
            </h3>
            <span className="text-xs text-gray-400">{mergedData.length} data points</span>
          </div>
          {renderChart()}
          {/* Stats */}
          {chartData?.series && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
              {chartData.series.map((s, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-2 text-xs border border-gray-100">
                  <div className="text-gray-500 truncate">{s.name || s.tagPath}</div>
                  {s.stats && (
                    <div className="grid grid-cols-2 gap-1 mt-1 text-gray-700">
                      <span>Min: {s.stats.min?.toFixed(2)}</span>
                      <span>Max: {s.stats.max?.toFixed(2)}</span>
                      <span>Avg: {s.stats.avg?.toFixed(2)}</span>
                      <span>Pts: {s.stats.count}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-center">
          <div>
            <span className="text-5xl block mb-4">📊</span>
            <p className="text-lg mb-1 text-gray-600">No Chart Data</p>
            <p className="text-sm">Enter tag paths above and click Chart, or use the Chat tab to generate charts via AI</p>
          </div>
        </div>
      )}
    </div>
  );
}
