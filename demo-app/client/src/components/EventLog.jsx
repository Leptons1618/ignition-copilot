import React, { useState, useMemo, useEffect } from 'react';
import { Activity, X, Clock3, AlertTriangle, Info, CheckCircle2, Server } from 'lucide-react';
import Badge from './ui/Badge.jsx';
import Button from './ui/Button.jsx';
import logger from '../lib/logger.js';
import { getBackendRequestLogs, getFrontendEventLogs } from '../api.js';

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
  const [source, setSource] = useState('frontend');
  const [refreshKey, setRefreshKey] = useState(0);
  const [backendLogs, setBackendLogs] = useState([]);
  const [loadingBackend, setLoadingBackend] = useState(false);

  useEffect(() => {
    if (source !== 'backend') return;
    let active = true;
    setLoadingBackend(true);
    Promise.all([
      getBackendRequestLogs(100).catch(() => ({ logs: [] })),
      getFrontendEventLogs(100).catch(() => ({ events: [] })),
    ]).then(([reqs, events]) => {
      if (!active) return;
      const normalizedReqs = (reqs.logs || []).map(r => ({
        id: `${r.timestamp}-${r.method}-${r.url}`,
        level: r.status >= 500 ? 'error' : (r.status >= 400 ? 'warn' : 'info'),
        category: 'api',
        action: `${r.method} ${r.url}`,
        timestamp: r.timestamp,
        data: { status: r.status, duration: r.duration },
      }));
      const normalizedEvents = (events.events || []).map(e => ({
        ...e,
        id: e.id || `${e.timestamp}-${e.action}`,
      }));
      setBackendLogs([...normalizedReqs, ...normalizedEvents].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))));
    }).finally(() => {
      if (active) setLoadingBackend(false);
    });
    return () => { active = false; };
  }, [source, refreshKey]);

  const events = useMemo(() => {
    const filterMap = { all: undefined, info: 'info', warn: 'warn', error: 'error' };
    const base = source === 'frontend'
      ? logger.getEvents(100, { level: filterMap[filter] })
      : backendLogs;
    if (filter === 'all') return base;
    return base.filter(e => e.level === filterMap[filter]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, refreshKey, source, backendLogs]);

  return (
    <div className="h-full flex flex-col t-bg">
      <header className="px-4 py-3 border-b t-border-s flex items-center gap-3 shrink-0 t-surface">
        <Activity size={16} className="t-accent" />
        <span className="text-sm font-semibold t-text">Event Log</span>
        <Badge color="neutral">{events.length}</Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => setSource('frontend')}
            className={`px-2 py-0.5 text-xs rounded ${source === 'frontend' ? 't-accent-soft t-accent' : 't-text-m'}`}
          >
            Frontend
          </button>
          <button
            onClick={() => setSource('backend')}
            className={`px-2 py-0.5 text-xs rounded inline-flex items-center gap-1 ${source === 'backend' ? 't-accent-soft t-accent' : 't-text-m'}`}
          >
            <Server size={10} />
            Backend
          </button>
        </div>
        <div className="flex items-center gap-1">
          {['all', 'info', 'warn', 'error'].map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filter === level
                  ? 't-accent-soft t-accent'
                  : 't-text-m t-surface-h'
              }`}
            >
              {level.charAt(0).toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="xs" onClick={() => setRefreshKey(k => k + 1)}>
          Refresh
        </Button>
        <Button variant="ghost" size="xs" onClick={() => { logger.clear(); setBackendLogs([]); setRefreshKey(k => k + 1); }}>
          Clear
        </Button>
        {onClose && (
          <button onClick={onClose} className="t-text-m hover:t-text">
            <X size={14} />
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto">
        {loadingBackend ? (
          <div className="flex items-center justify-center py-8 text-sm t-text-m">Loading backend logs...</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 t-text-m text-sm">
            <CheckCircle2 size={24} className="mb-2" />
            No events to display
          </div>
        ) : (
          <div className="divide-y t-border-s">
            {events.map(evt => {
              const Icon = LEVEL_ICONS[evt.level] || Activity;
              return (
                <div key={evt.id} className="px-4 py-2 transition-colors t-surface-h">
                  <div className="flex items-center gap-2">
                    <Icon size={13} className={LEVEL_COLORS[evt.level] || 'text-gray-400'} />
                    <span className="text-xs font-medium t-text-2">[{evt.category}]</span>
                    <span className="text-xs t-text">{evt.action}</span>
                    <span className="text-[10px] t-text-m ml-auto flex items-center gap-1">
                      <Clock3 size={10} />
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {evt.data && Object.keys(evt.data).length > 0 && (
                    <div className="text-[10px] t-text-m font-mono mt-0.5 truncate pl-5">
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
