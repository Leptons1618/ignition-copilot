import React, { useState, useEffect } from 'react';
import { getIgnitionStatus, getChatTools, getRAGStats, getChatModels } from '../api.js';

export default function SystemStatus() {
  const [status, setStatus] = useState(null);
  const [tools, setTools] = useState([]);
  const [ragStats, setRagStats] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, t, r, m] = await Promise.allSettled([
        getIgnitionStatus(),
        getChatTools(),
        getRAGStats(),
        getChatModels(),
      ]);
      if (s.status === 'fulfilled') setStatus(s.value);
      if (t.status === 'fulfilled') setTools(t.value?.tools || []);
      if (r.status === 'fulfilled') setRagStats(r.value);
      if (m.status === 'fulfilled') setModels(m.value?.models || []);
    } catch (err) {
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const StatusCard = ({ title, badge, children, state }) => (
    <div className={`bg-white border rounded-xl p-5 shadow-sm ${
      state === 'ok' ? 'border-green-200' : state === 'error' ? 'border-red-200' : 'border-gray-200'
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 font-semibold">{badge}</span>
        <h3 className="text-gray-900 font-semibold">{title}</h3>
        {state && (
          <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
            state === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {state === 'ok' ? 'Online' : 'Offline'}
          </span>
        )}
      </div>
      {children}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">System Status</h2>
            <p className="text-gray-500 text-sm">Monitor all connected services</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm transition-colors shadow-sm"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatusCard title="Ignition Gateway" badge="GW" state={status?.connected ? 'ok' : 'error'}>
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
                  <InfoRow label="State" value={status.info.info.gateway.state} />
                )}
                <InfoRow label="URL" value="http://localhost:8088" />
                <InfoRow label="Project" value="ignition-copilot" />
              </div>
            ) : (
              <p className="text-red-600 text-sm">{status?.error || 'Cannot connect to Ignition Gateway'}</p>
            )}
          </StatusCard>

          <StatusCard title="Ollama LLM" badge="LLM" state={models.length > 0 ? 'ok' : 'error'}>
            {models.length > 0 ? (
              <div className="space-y-2 text-sm">
                <InfoRow label="URL" value="http://localhost:11434" />
                <InfoRow label="Models" value={`${models.length} available`} />
                <div className="mt-2 space-y-1">
                  {models.map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-green-600">OK</span>
                      <span className="text-gray-700 font-mono">{m.name || m}</span>
                      {m.size && <span className="text-gray-400">{(m.size / 1e9).toFixed(1)}GB</span>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-red-600 text-sm">Cannot connect to Ollama</p>
            )}
          </StatusCard>

          <StatusCard title="RAG Knowledge Base" badge="RAG" state={ragStats ? 'ok' : 'error'}>
            {ragStats ? (
              <div className="space-y-2 text-sm">
                <InfoRow label="Documents" value={ragStats.documentCount || 0} />
                <InfoRow label="Sources" value={ragStats.sources?.length || 0} />
                <InfoRow label="Model" value="nomic-embed-text" />
                <InfoRow label="Status" value={ragStats.initialized ? 'Initialized' : 'Not initialized'} />
              </div>
            ) : (
              <p className="text-amber-600 text-sm">RAG not initialized</p>
            )}
          </StatusCard>

          <StatusCard title="Available Tools" badge="TOOLS" state={tools.length > 0 ? 'ok' : 'error'}>
            {tools.length > 0 ? (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {tools.map((tool, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs py-1">
                    <span className="text-blue-600">FN</span>
                    <span className="text-gray-700 font-mono">{tool.name || tool}</span>
                    {tool.description && <span className="text-gray-400 truncate flex-1">{tool.description}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">No tools loaded</p>
            )}
          </StatusCard>
        </div>

        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-gray-900 font-semibold mb-4">Architecture</h3>
          <div className="grid grid-cols-3 gap-3 text-center text-sm">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-gray-900 font-medium">React Frontend</div>
              <div className="text-gray-400 text-xs">:3000 | Vite + TailwindCSS</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-gray-900 font-medium">Node.js Backend</div>
              <div className="text-gray-400 text-xs">:3001 | Express + Ollama</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-gray-900 font-medium">Ignition Gateway</div>
              <div className="text-gray-400 text-xs">:8088 | WebDev Module</div>
            </div>
          </div>
          <div className="flex justify-center gap-4 mt-3">
            <span className="text-gray-400 text-xs">REST API</span>
            <span className="text-gray-400 text-xs">WebDev REST</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 text-center text-sm">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-gray-900 font-medium text-xs">Ollama LLM</div>
              <div className="text-gray-400 text-xs">:11434 | llama3.2:3b</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="text-gray-900 font-medium text-xs">RAG Knowledge Base</div>
              <div className="text-gray-400 text-xs">In-memory | nomic-embed-text</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-mono text-xs">{String(value)}</span>
    </div>
  );
}
