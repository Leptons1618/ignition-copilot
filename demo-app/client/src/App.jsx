import React, { useState, useEffect } from 'react';
import { MessageSquare, FolderTree, LineChart, LayoutDashboard, PlaySquare, Server, Compass, Activity } from 'lucide-react';
import Chat from './components/Chat.jsx';
import TagExplorer from './components/TagExplorer.jsx';
import DynamicChart from './components/DynamicChart.jsx';
import DemoScenarios from './components/DemoScenarios.jsx';
import SystemStatus from './components/SystemStatus.jsx';
import DemoGuide from './components/DemoGuide.jsx';
import DashboardBuilder from './components/DashboardBuilder.jsx';
import WorkspaceDock from './components/WorkspaceDock.jsx';
import useTagWorkspace from './hooks/useTagWorkspace.jsx';
import { getIgnitionStatus } from './api.js';
import StatusDot from './components/ui/StatusDot.jsx';
import Badge from './components/ui/Badge.jsx';

const TABS = [
  { id: 'guide', label: 'Guide', icon: Compass },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare },
  { id: 'tags', label: 'Tag Explorer', icon: FolderTree },
  { id: 'charts', label: 'Charts', icon: LineChart },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scenarios', label: 'Scenarios', icon: PlaySquare },
  { id: 'system', label: 'System', icon: Server },
];

export default function App() {
  const [tab, setTab] = useState('guide');
  const [connected, setConnected] = useState(null);
  const [chartRequest, setChartRequest] = useState(null);
  const [chatSeed, setChatSeed] = useState(null);
  const workspace = useTagWorkspace();

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
            <Activity size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Ignition Copilot</h1>
            <p className="text-xs text-gray-500">Industrial Operations Assistant</p>
          </div>
        </div>
        <Badge color={connected === true ? 'success' : connected === false ? 'error' : 'warning'}>
          <StatusDot color={connected === true ? 'success' : connected === false ? 'error' : 'warning'} pulse={connected === null} />
          {connected === true ? 'Gateway Connected' : connected === false ? 'Disconnected' : 'Checking'}
        </Badge>
      </header>

      <nav className="bg-white border-b border-gray-200 px-4 flex gap-1 shrink-0 overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <WorkspaceDock
        tags={workspace.tags}
        onRemoveTag={workspace.removeTag}
        onClear={workspace.clearTags}
        onOpenCharts={(tags) => showChart(tags, '-1h')}
        onOpenChat={(tags) => openChatPrompt(`Read and summarize these workspace tags:\n${tags.join('\n')}`)}
      />

      <main className="flex-1 overflow-hidden">
        {tab === 'guide' && <DemoGuide onOpenChatPrompt={openChatPrompt} onOpenCharts={showChart} onOpenScenarios={() => setTab('scenarios')} onOpenDashboard={() => setTab('dashboard')} />}
        {tab === 'chat' && <Chat onShowChart={showChart} seedPrompt={chatSeed} workspaceTags={workspace.tags} onAddWorkspaceTags={workspace.addTags} />}
        {tab === 'tags' && <TagExplorer workspaceTags={workspace.tags} onAddWorkspaceTags={workspace.addTags} />}
        {tab === 'charts' && <DynamicChart chartRequest={chartRequest} workspaceTags={workspace.tags} onAddWorkspaceTags={workspace.addTags} />}
        {tab === 'dashboard' && <DashboardBuilder onOpenChatPrompt={openChatPrompt} />}
        {tab === 'scenarios' && <DemoScenarios />}
        {tab === 'system' && <SystemStatus />}
      </main>
    </div>
  );
}
