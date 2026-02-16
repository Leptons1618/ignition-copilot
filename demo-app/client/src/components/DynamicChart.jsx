import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getTimeSeries, readTags, searchTags } from '../api.js';
import { Search, Plus, RefreshCw } from 'lucide-react';
import { mergeSeriesData, formatTime, getColor } from '../lib/chartUtils.js';
import { TIME_RANGES, CHART_TYPES } from '../lib/constants.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

export default function DynamicChart({ chartRequest, workspaceTags = [], onAddWorkspaceTags }) {
  const [tagPaths, setTagPaths] = useState('');
  const [timeRange, setTimeRange] = useState('-1h');
  const [chartType, setChartType] = useState('line');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [liveValues, setLiveValues] = useState(null);
  const [searchPattern, setSearchPattern] = useState('Temp');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (!chartRequest) return;
    const tags = chartRequest.tags || chartRequest.paths || [];
    const range = chartRequest.range || chartRequest.startTime || '-1h';
    if (Array.isArray(tags) && tags.length > 0) {
      setTagPaths(tags.join(', '));
      setTimeRange(range);
      fetchChart(tags, range);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartRequest]);

  const fetchChart = useCallback(async (paths, range) => {
    const tagArray = paths || tagPaths.split(',').map(t => t.trim()).filter(Boolean);
    const r = range || timeRange;
    if (tagArray.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getTimeSeries(tagArray, r);
      if (result.success !== false) setChartData(result);
      else setError(result.error || 'Failed to fetch chart data');
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

  const runSearch = async () => {
    try {
      const result = await searchTags(`*${searchPattern || '*'}*`, '[default]');
      setSearchResults((result.matches || []).slice(0, 40));
    } catch {
      setSearchResults([]);
    }
  };

  const addTagPath = (fullPath) => {
    const current = tagPaths ? tagPaths.split(',').map(t => t.trim()) : [];
    if (!current.includes(fullPath)) setTagPaths(current.length ? `${current.join(', ')}, ${fullPath}` : fullPath);
  };

  const { mergedData, seriesNames } = React.useMemo(() => {
    if (!chartData?.series) return { mergedData: [], seriesNames: [] };
    return mergeSeriesData(chartData.series);
  }, [chartData]);

  const renderSeries = () => {
    return seriesNames.map((name, i) => {
      const color = getColor(i);
      if (chartType === 'bar') return <Bar key={name} dataKey={name} fill={color} name={name} />;
      if (chartType === 'area') return <Area key={name} type="monotone" dataKey={name} stroke={color} fill={color} fillOpacity={0.1} name={name} />;
      return <Line key={name} type="monotone" dataKey={name} stroke={color} strokeWidth={2} dot={false} name={name} />;
    });
  };

  const ChartComponent = chartType === 'bar' ? BarChart : chartType === 'area' ? AreaChart : LineChart;

  return (
    <div className="h-full flex flex-col p-4 overflow-y-auto bg-gray-50 gap-3">
      <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex gap-2">
          <input value={tagPaths} onChange={e => setTagPaths(e.target.value)} placeholder="Comma-separated tag paths" className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm" />
          <button onClick={() => fetchChart()} disabled={loading || !tagPaths.trim()} className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:bg-gray-200">
            {loading ? 'Loading' : 'Chart'}
          </button>
          <button onClick={readLive} disabled={!tagPaths.trim()} className="inline-flex items-center gap-1 px-4 py-2 rounded bg-gray-800 text-white text-sm disabled:bg-gray-200">
            <RefreshCw size={14} />
            Live
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {TIME_RANGES.map(r => (
            <button key={r.value} onClick={() => setTimeRange(r.value)} className={`px-3 py-1 rounded text-sm border ${timeRange === r.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
              {r.label}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200" />
          {CHART_TYPES.map(ct => (
            <button key={ct.value} onClick={() => setChartType(ct.value)} className={`px-3 py-1 rounded text-sm border ${chartType === ct.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'}`}>
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
        <section className="lg:col-span-2 bg-white border border-gray-200 rounded-lg p-4 min-h-[420px]">
          {error && <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
          {mergedData.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-900 font-medium">{seriesNames.join(', ')}</h3>
                <Badge color="neutral">{mergedData.length} points</Badge>
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <ChartComponent data={mergedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={formatTime} />
                  {seriesNames.length > 1 && <Legend />}
                  {renderSeries()}
                </ChartComponent>
              </ResponsiveContainer>
            </>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner label="Fetching chart data..." />
            </div>
          ) : (
            <EmptyState icon={Search} title="No chart data yet" description="Add tags and click Chart to visualize." />
          )}
        </section>

        <aside className="bg-white border border-gray-200 rounded-lg p-3 overflow-y-auto">
          <div className="text-sm font-semibold text-gray-900 mb-2">Tag Sources</div>
          <div className="space-y-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">Workspace Tags</div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {workspaceTags.map(t => (
                  <button key={t} onClick={() => addTagPath(t)} className="w-full text-left text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100 font-mono">
                    {t}
                  </button>
                ))}
                {workspaceTags.length === 0 && <div className="text-xs text-gray-400">No workspace tags.</div>}
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Search Ignition Tags</div>
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2 top-2 text-gray-400" />
                  <input value={searchPattern} onChange={e => setSearchPattern(e.target.value)} className="w-full border border-gray-200 rounded pl-7 pr-2 py-1.5 text-xs" />
                </div>
                <button onClick={runSearch} className="px-2 py-1.5 bg-blue-600 text-white rounded text-xs">Find</button>
              </div>
              <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map((t, i) => {
                  const fullPath = t.fullPath || t.path || t.name;
                  return (
                    <div key={`${fullPath}-${i}`} className="flex items-center gap-1 border border-gray-200 rounded px-2 py-1 bg-gray-50">
                      <span className="text-[10px] font-mono text-gray-700 flex-1 truncate">{fullPath}</span>
                      <button onClick={() => addTagPath(fullPath)} className="text-gray-600 hover:text-blue-700">
                        <Plus size={12} />
                      </button>
                      <button onClick={() => onAddWorkspaceTags?.([fullPath])} className="text-gray-600 hover:text-green-700" title="Add to workspace">
                        <Plus size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {liveValues && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Live Snapshot</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {liveValues.map((v, i) => (
                  <div key={i} className="text-xs border border-gray-200 rounded bg-gray-50 px-2 py-1">
                    <div className="font-mono text-gray-700 truncate">{v.path}</div>
                    <div className="text-gray-900">{typeof v.value === 'number' ? v.value.toFixed(2) : String(v.value)}</div>
                    <div className={v.quality === 'Good' ? 'text-green-700' : 'text-amber-700'}>{v.quality}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
