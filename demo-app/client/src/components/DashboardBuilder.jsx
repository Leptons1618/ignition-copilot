import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import {
  generateDashboard,
  listDashboardPresets,
  saveDashboardPreset,
  updateDashboardPreset,
  deleteDashboardPreset,
  loadDashboardPreset,
} from '../api.js';

const COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

const EXAMPLES = [
  'Build a motor reliability dashboard for MotorM12 with temperature, vibration, load, current, speed.',
  'Create a pump performance dashboard with pressure, flow, level, and run status for the last 6 hours.',
  'Generate an operations dashboard focused on alarms and asset health for DemoPlant.',
];

function buildChartData(series = []) {
  const merged = {};
  const names = [];
  for (const s of series) {
    const name = s.name || s.fullPath;
    names.push(name);
    for (const pt of s.data || []) {
      const ts = pt.timestamp || pt.x;
      if (!merged[ts]) merged[ts] = { time: ts };
      merged[ts][name] = pt.value ?? pt.y;
    }
  }
  return {
    rows: Object.values(merged).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()),
    names,
  };
}

function formatTime(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function DashboardBuilder({ onOpenChatPrompt }) {
  const [prompt, setPrompt] = useState(EXAMPLES[0]);
  const [timeRange, setTimeRange] = useState('-1h');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState([]);
  const [presetId, setPresetId] = useState('');
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState(null);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === presetId) || null,
    [presets, presetId]
  );

  const refreshPresets = async () => {
    setPresetError(null);
    try {
      const result = await listDashboardPresets();
      setPresets(result.presets || []);
      if (result.presets?.length > 0 && !presetId) setPresetId(result.presets[0].id);
    } catch (err) {
      setPresetError(err.message);
    }
  };

  useEffect(() => {
    refreshPresets();
  }, []);

  const run = async (override = null) => {
    const request = override || { prompt, root: '[default]', timeRange };
    setLoading(true);
    setError(null);
    try {
      const result = await generateDashboard(request.prompt, request.root || '[default]', request.timeRange || '-1h');
      if (result.success === false) {
        setError(result.error || 'Dashboard generation failed.');
      } else {
        setData(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const savePreset = async () => {
    const name = presetName.trim();
    if (!name) {
      setPresetError('Enter a preset name first.');
      return;
    }
    setPresetLoading(true);
    setPresetError(null);
    try {
      await saveDashboardPreset({
        name,
        prompt,
        root: '[default]',
        timeRange,
      });
      setPresetName('');
      await refreshPresets();
    } catch (err) {
      setPresetError(err.message);
    } finally {
      setPresetLoading(false);
    }
  };

  const overwritePreset = async () => {
    if (!selectedPreset) {
      setPresetError('Select a preset to overwrite.');
      return;
    }
    setPresetLoading(true);
    setPresetError(null);
    try {
      await updateDashboardPreset(selectedPreset.id, {
        name: selectedPreset.name,
        prompt,
        root: '[default]',
        timeRange,
      });
      await refreshPresets();
    } catch (err) {
      setPresetError(err.message);
    } finally {
      setPresetLoading(false);
    }
  };

  const loadPreset = async () => {
    if (!selectedPreset) {
      setPresetError('Select a preset to load.');
      return;
    }
    setPresetLoading(true);
    setPresetError(null);
    try {
      const result = await loadDashboardPreset(selectedPreset.id);
      const preset = result.preset;
      setPrompt(preset.prompt || '');
      setTimeRange(preset.timeRange || '-1h');
      if (result.dashboard?.success) {
        setData(result.dashboard);
      } else {
        await run({ prompt: preset.prompt, root: preset.root || '[default]', timeRange: preset.timeRange || '-1h' });
      }
    } catch (err) {
      setPresetError(err.message);
    } finally {
      setPresetLoading(false);
    }
  };

  const removePreset = async () => {
    if (!selectedPreset) {
      setPresetError('Select a preset to delete.');
      return;
    }
    setPresetLoading(true);
    setPresetError(null);
    try {
      await deleteDashboardPreset(selectedPreset.id);
      await refreshPresets();
    } catch (err) {
      setPresetError(err.message);
    } finally {
      setPresetLoading(false);
    }
  };

  const trend = buildChartData(data?.trends?.series || []);

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Dashboard Builder</h2>
          <p className="text-sm text-gray-500 mb-4">
            Describe the industrial view you want. The system maps your request to tags, pulls live values and history, then builds a practical dashboard.
          </p>

          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={3}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex gap-2 flex-wrap">
              {EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-50 text-gray-700"
                >
                  Example {i + 1}
                </button>
              ))}
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={timeRange}
                onChange={e => setTimeRange(e.target.value)}
                className="bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700"
              >
                <option value="-30m">Last 30 min</option>
                <option value="-1h">Last 1 hour</option>
                <option value="-6h">Last 6 hours</option>
                <option value="-24h">Last 24 hours</option>
              </select>
              <button
                onClick={() => run()}
                disabled={loading || !prompt.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg text-white text-sm font-medium"
              >
                {loading ? 'Generating...' : 'Generate Dashboard'}
              </button>
              {onOpenChatPrompt && (
                <button
                  onClick={() => onOpenChatPrompt(`Create an operational summary for this dashboard request:\n${prompt}`)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-800 rounded-lg text-white text-sm font-medium"
                >
                  Explain in AI Chat
                </button>
              )}
            </div>

            <div className="border-t border-gray-200 pt-3">
              <div className="text-sm font-semibold text-gray-900 mb-2">Dashboard Presets</div>
              <div className="flex gap-2 items-center flex-wrap">
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="New preset name"
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 min-w-[180px]"
                />
                <button
                  onClick={savePreset}
                  disabled={presetLoading || !prompt.trim()}
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 rounded text-white text-sm"
                >
                  Save
                </button>
                <select
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="bg-white border border-gray-200 rounded px-3 py-2 text-sm text-gray-700 min-w-[220px]"
                >
                  <option value="">Select preset...</option>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <button
                  onClick={loadPreset}
                  disabled={presetLoading || !selectedPreset}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 rounded text-white text-sm"
                >
                  Load
                </button>
                <button
                  onClick={overwritePreset}
                  disabled={presetLoading || !selectedPreset}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-200 disabled:text-gray-400 rounded text-white text-sm"
                >
                  Overwrite
                </button>
                <button
                  onClick={removePreset}
                  disabled={presetLoading || !selectedPreset}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-200 disabled:text-gray-400 rounded text-white text-sm"
                >
                  Delete
                </button>
              </div>
              {presetError && <div className="text-xs text-red-600 mt-2">{presetError}</div>}
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="Selected Tags" value={data.selectedTags?.length || 0} />
              <StatCard label="Trend Series" value={data.trends?.series?.length || 0} />
              <StatCard label="Active Alarms" value={data.alarmSummary?.activeCount || 0} />
            </div>

            {data.assetHealth && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Asset Health</h3>
                <div className="flex items-center gap-4">
                  <div className={`text-3xl font-bold ${
                    data.assetHealth.status === 'healthy' ? 'text-green-600' :
                    data.assetHealth.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {data.assetHealth.score}
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Status: <span className="font-semibold">{data.assetHealth.status}</span></div>
                    <div>Asset: <span className="font-mono text-xs">{data.assetHealth.assetPath}</span></div>
                  </div>
                </div>
                {(data.assetHealth.findings || []).length > 0 && (
                  <div className="mt-3 space-y-1 text-sm text-gray-700">
                    {data.assetHealth.findings.slice(0, 5).map((f, i) => <div key={i}>- {f}</div>)}
                  </div>
                )}
              </div>
            )}

            {trend.rows.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Trend View</h3>
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={trend.rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <Tooltip labelFormatter={formatTime} />
                    {trend.names.length > 1 && <Legend />}
                    {trend.names.map((name, i) => (
                      <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {(data.widgets || []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Live KPI Cards</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {data.widgets.filter(w => w.type === 'kpi').slice(0, 8).map((w) => (
                    <div key={w.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="text-xs text-gray-500 truncate">{w.title}</div>
                      <div className="text-xl font-mono text-gray-900">{String(w.value)}</div>
                      <div className={`text-xs ${String(w.quality) === 'Good' ? 'text-green-600' : 'text-amber-600'}`}>{w.quality}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.alarmSummary && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Alarm Summary (Last 8h)</h3>
                <div className="text-sm text-gray-700">
                  Active: {data.alarmSummary.activeCount} | Journal Events: {data.alarmSummary.journalCount}
                </div>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {Object.entries(data.alarmSummary.byPriority || {}).map(([k, v]) => (
                    <div key={k} className="bg-gray-50 border border-gray-200 rounded p-2">
                      {k}: {v}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}
