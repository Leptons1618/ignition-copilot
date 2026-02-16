import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { mergeSeriesData, formatTime, getColor } from '../../lib/chartUtils.js';
import { Maximize2 } from 'lucide-react';

/**
 * Inline chart block for embedding in chat messages.
 * Renders a compact chart from series data.
 */
export default function ChartBlock({ data, onExpand }) {
  if (!data?.series?.length) return null;

  const { mergedData, seriesNames } = mergeSeriesData(data.series);
  if (mergedData.length === 0) return <p className="text-gray-500 text-sm">No data to chart</p>;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm my-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">{seriesNames.join(', ')}</span>
        {onExpand && (
          <button
            onClick={() => onExpand(data.series.map(s => s.fullPath || s.name), '-1h')}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Maximize2 size={12} />
            Expand
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={mergedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" tickFormatter={formatTime} stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <YAxis stroke="#9ca3af" tick={{ fontSize: 10 }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 11 }}
            labelFormatter={formatTime}
          />
          {seriesNames.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={getColor(i)}
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
