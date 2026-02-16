import React, { useState, useEffect } from 'react';
import Chat from './components/Chat.jsx';
import TagExplorer from './components/TagExplorer.jsx';
import DynamicChart from './components/DynamicChart.jsx';
import DemoScenarios from './components/DemoScenarios.jsx';
import SystemStatus from './components/SystemStatus.jsx';
import DemoGuide from './components/DemoGuide.jsx';
import DashboardBuilder from './components/DashboardBuilder.jsx';
import { getIgnitionStatus } from './api.js';

const TABS = [
  { id: 'guide', label: 'Demo Guide', icon: 'DG' },
  { id: 'chat', label: 'AI Chat', icon: 'AI' },
  { id: 'tags', label: 'Tag Explorer', icon: 'TG' },
  { id: 'charts', label: 'Charts', icon: 'CH' },
  { id: 'dashboard', label: 'Dashboard', icon: 'DB' },
  { id: 'scenarios', label: 'Demo Scenarios', icon: 'SC' },
  { id: 'system', label: 'System', icon: 'SY' },
];

export default function App() {
  const [tab, setTab] = useState('guide');
  const [connected, setConnected] = useState(null);
  const [chartRequest, setChartRequest] = useState(null);
  const [chatSeed, setChatSeed] = useState(null);

  useEffect(() => {
    getIgnitionStatus().then(data => setConnected(data.connected)).catch(() => setConnected(false));
    const iv = setInterval(() => {
      getIgnitionStatus().then(data => setConnected(data.connected)).catch(() => setConnected(false));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  const showChart = (paths, startTime) => {
    setChartRequest({ tags: paths, range: startTime || '-1h' });
    setTab('charts');
  };

  const openChatPrompt = (prompt) => {
    setChatSeed({ prompt, ts: Date.now() });
    setTab('chat');
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg font-bold">IC</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Ignition Copilot</h1>
            <p className="text-xs text-gray-500">AI-Powered SCADA Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            connected === true ? 'bg-green-50 text-green-700 border border-green-200' :
            connected === false ? 'bg-red-50 text-red-700 border border-red-200' :
            'bg-yellow-50 text-yellow-700 border border-yellow-200'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connected === true ? 'bg-green-500' : connected === false ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            {connected === true ? 'Gateway Connected' : connected === false ? 'Disconnected' : 'Checking...'}
          </span>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200 px-4 flex gap-1 shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 overflow-hidden">
        {tab === 'guide' && <DemoGuide onOpenChatPrompt={openChatPrompt} onOpenCharts={showChart} onOpenScenarios={() => setTab('scenarios')} onOpenDashboard={() => setTab('dashboard')} />}
        {tab === 'chat' && <Chat onShowChart={showChart} seedPrompt={chatSeed} />}
        {tab === 'tags' && <TagExplorer />}
        {tab === 'charts' && <DynamicChart chartRequest={chartRequest} />}
        {tab === 'dashboard' && <DashboardBuilder onOpenChatPrompt={openChatPrompt} />}
        {tab === 'scenarios' && <DemoScenarios />}
        {tab === 'system' && <SystemStatus />}
      </main>
    </div>
  );
}
