import React, { useState, useEffect } from 'react';
import {
  Server, Cpu, BookOpen, Wrench, RefreshCw, Activity, Globe, Database,
  CheckCircle2, XCircle, AlertCircle, Layers,
} from 'lucide-react';
import { getIgnitionStatus, getChatTools, getRAGStats, getChatModels, getChatConfig } from '../api.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import Card from './ui/Card.jsx';
import StatusDot from './ui/StatusDot.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  const [tools, setTools] = useState([]);
  const [ragStats, setRagStats] = useState(null);
  const [models, setModels] = useState([]);
  const [chatConfig, setChatConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, t, r, m, c] = await Promise.allSettled([
        getIgnitionStatus(),
        getChatTools(),
        getRAGStats(),
        getChatModels(),
        getChatConfig(),
      ]);
      if (s.status === 'fulfilled') setStatus(s.value);
      if (t.status === 'fulfilled') setTools(t.value?.tools || []);
      if (r.status === 'fulfilled') setRagStats(r.value);
      if (m.status === 'fulfilled') setModels(m.value?.models || []);
      if (c.status === 'fulfilled') setChatConfig(c.value);
    } catch (err) {
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  return (
    <div className="h-full overflow-y-auto p-4 t-bg">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold t-text flex items-center gap-2">
              <Activity size={22} className="t-accent" />
              System Status
            </h2>
            <p className="t-text-m text-sm">Monitor all connected services</p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card
            header={
              <div className="flex items-center gap-2">
                <Server size={16} className="t-accent" />
                <span className="font-semibold t-text">Ignition Gateway</span>
                <span className="ml-auto">
                  {status?.connected ? <Badge color="success">Online</Badge> : <Badge color="error">Offline</Badge>}
                </span>
              </div>
            }
            state={status?.connected ? 'ok' : 'error'}
          >
            {status?.connected ? (
              <div className="space-y-2 text-sm">
                {status.info?.info?.gateway?.systemName && (
                  <InfoRow label="System Name" value={status.info.info.gateway.systemName} />
                )}
                {status.info?.info?.gateway?.version && (
                  <InfoRow label="Version" value={status.info.info.gateway.version} />
                )}
                {status.info?.info?.gateway?.edition && (
                  <InfoRow label="Edition" value={status.info.info.gateway.edition} />
                )}
                {status.info?.info?.gateway?.state && (
                  <InfoRow icon={<StatusDot color={status.info.info.gateway.state === 'RUNNING' ? 'success' : 'warning'} pulse />} label="State" value={status.info.info.gateway.state} />
                )}
                <InfoRow icon={<Globe size={13} className="t-text-m" />} label="URL" value="http://localhost:8088" />
              </div>
            ) : (
              <p className="t-err text-sm">{status?.error || 'Cannot connect to Ignition Gateway'}</p>
            )}
          </Card>

          <Card
            header={
              <div className="flex items-center gap-2">
                <Cpu size={16} className="t-accent" />
                <span className="font-semibold t-text">LLM Provider</span>
                <span className="ml-auto">
                  {models.length > 0 ? <Badge color="success">Online</Badge> : <Badge color="error">Offline</Badge>}
                </span>
              </div>
            }
            state={models.length > 0 ? 'ok' : 'error'}
          >
            {models.length > 0 ? (
              <div className="space-y-2 text-sm">
                <InfoRow label="Provider" value={chatConfig?.provider || 'ollama'} />
                <InfoRow icon={<Globe size={13} className="t-text-m" />} label="URL" value={chatConfig?.baseUrl || chatConfig?.ollamaUrl || '-'} />
                <InfoRow label="Models" value={`${models.length} available`} />
                <div className="mt-2 space-y-1">
                  {models.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 size={12} className="t-ok" />
                      <span className="t-text-2 font-mono">{m.name || m}</span>
                      {m.size && <span className="t-text-m">{(m.size / 1e9).toFixed(1)}GB</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="t-err text-sm">Cannot connect to configured LLM provider</p>
            )}
          </Card>

          <Card
            header={
              <div className="flex items-center gap-2">
                <BookOpen size={16} className="t-ok" />
                <span className="font-semibold t-text">RAG Knowledge Base</span>
                <span className="ml-auto">
                  {ragStats ? <Badge color="success">Online</Badge> : <Badge color="warning">Unavailable</Badge>}
                </span>
              </div>
            }
            state={ragStats ? 'ok' : 'error'}
          >
            {ragStats ? (
              <div className="space-y-2 text-sm">
                <InfoRow icon={<Database size={13} className="t-text-m" />} label="Documents" value={ragStats.documentCount || 0} />
                <InfoRow label="Sources" value={ragStats.sources?.length || 0} />
                <InfoRow label="Model" value="nomic-embed-text" />
                <InfoRow label="Status" value={ragStats.initialized ? 'Initialized' : 'Not initialized'} />
              </div>
            ) : (
              <p className="t-warn text-sm">RAG not initialized</p>
            )}
          </Card>

          <Card
            header={
              <div className="flex items-center gap-2">
                <Wrench size={16} className="t-warn" />
                <span className="font-semibold t-text">Available Tools</span>
                <span className="ml-auto">
                  {tools.length > 0 ? <Badge color="success">{tools.length} tools</Badge> : <Badge color="error">None</Badge>}
                </span>
              </div>
            }
            state={tools.length > 0 ? 'ok' : 'error'}
          >
            {tools.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tools.map((tool, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    <Layers size={11} className="t-accent shrink-0" />
                    <span className="t-text-2 font-mono">{tool.name || tool}</span>
                    {tool.description && <span className="t-text-m truncate flex-1">{tool.description}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="t-text-m text-sm">No tools loaded</p>
            )}
          </Card>
        </div>

        <div className="mt-6 t-surface border t-border-s rounded-xl p-5 t-shadow">
          <h3 className="t-text font-semibold mb-4 flex items-center gap-2">
            <Layers size={16} className="t-accent" />
            Architecture
          </h3>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="t-bg-alt rounded-lg p-4 border t-border-s">
              <div className="t-text font-medium">React Frontend</div>
              <div className="t-text-m text-xs">:3000 | Vite + TailwindCSS</div>
            </div>
            <div className="t-bg-alt rounded-lg p-4 border t-border-s">
              <div className="t-text font-medium">Node.js Backend</div>
              <div className="t-text-m text-xs">:3001 | Express + LLM API</div>
            </div>
            <div className="t-bg-alt rounded-lg p-4 border t-border-s">
              <div className="t-text font-medium">Ignition Gateway</div>
              <div className="t-text-m text-xs">:8088 | WebDev Module</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <span className="t-text-m text-xs">REST API</span>
            <span className="t-text-m text-xs">WebDev REST</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-center text-sm">
            <div className="t-bg-alt rounded-lg p-3 border t-border-s">
              <div className="t-text font-medium text-xs">LLM Provider</div>
              <div className="t-text-m text-xs">Runtime-configurable</div>
            </div>
            <div className="t-bg-alt rounded-lg p-3 border t-border-s">
              <div className="t-text font-medium text-xs">RAG Knowledge Base</div>
              <div className="t-text-m text-xs">In-memory | nomic-embed-text</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="t-text-m inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="t-text font-mono text-xs">{String(value)}</span>
    </div>
  );
}
