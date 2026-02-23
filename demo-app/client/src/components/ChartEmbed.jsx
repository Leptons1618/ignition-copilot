import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function ChartEmbed({ data }) {
  if (!data || !data.series || data.series.length === 0) return null;

  // Merge all series into a single data array keyed by timestamp
  const merged = {};
  const seriesNames = [];

  data.series.forEach((s, idx) => {
    const name = s.name || s.fullPath || `Series ${idx + 1}`;
    seriesNames.push(name);
    if (Array.isArray(s.data)) {
      s.data.forEach(pt => {
        const ts = pt.timestamp || pt.t || pt.x;
        if (!merged[ts]) merged[ts] = { time: ts };
        merged[ts][name] = pt.value ?? pt.v ?? pt.y;
      });
    }
  });

  const chartData = Object.values(merged).sort((a, b) => {
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  if (chartData.length === 0) return <p className="t-text-m text-sm">No data to chart</p>;

  // Format timestamp for display
  const formatTime = (ts) => {
    try {
      const d = new Date(ts);
      return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    } catch {
      return ts;
    }
  };

  return (
    <div className="t-surface border t-border-s rounded-lg p-3 t-shadow">
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelFormatter={formatTime}
          />
          {seriesNames.length > 1 && <Legend />}
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              name={name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
