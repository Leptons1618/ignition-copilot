import React, { useState, useMemo } from 'react';
import { Activity, Bell, X, ChevronDown, Filter, Clock3, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import logger from '../lib/logger.js';

const LEVEL_ICONS = {
  info: Info,
  warn: AlertTriangle,
  error: AlertTriangle,
  debug: Activity,
};

const LEVEL_COLORS = {
  info: 'text-blue-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
  debug: 'text-gray-400',
};

export default function EventLog({ onClose }) {
  const [filter, setFilter] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const events = useMemo(() => {
    const filterMap = { all: undefined, info: 'info', warn: 'warn', error: 'error' };
    return logger.getEvents(100, { level: filterMap[filter] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, refreshKey]);

  return (
    <div className="h-full flex flex-col bg-white">
      <header className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 shrink-0">
        <Activity size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-gray-900">Event Log</span>
        <Badge color="neutral">{events.length}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          {['all', 'info', 'warn', 'error'].map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filter === level
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="xs" onClick={() => setRefreshKey(k => k + 1)}>
          Refresh
        </Button>
        <Button variant="ghost" size="xs" onClick={() => { logger.clear(); setRefreshKey(k => k + 1); }}>
          Clear
        </Button>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 text-sm">
            <CheckCircle2 size={24} className="mb-2" />
            No events to display
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {events.map(evt => {
              const Icon = LEVEL_ICONS[evt.level] || Activity;
              return (
                <div key={evt.id} className="px-4 py-2 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className={LEVEL_COLORS[evt.level] || 'text-gray-400'} />
                    <span className="text-xs font-medium text-gray-700">[{evt.category}]</span>
                    <span className="text-xs text-gray-900">{evt.action}</span>
                    <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                      <Clock3 size={10} />
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {evt.data && Object.keys(evt.data).length > 0 && (
                    <div className="text-[10px] text-gray-500 font-mono mt-0.5 truncate pl-5">
                      {JSON.stringify(evt.data)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
