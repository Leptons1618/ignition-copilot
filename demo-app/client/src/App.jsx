import React, { useState, useEffect, useCallback } from 'react';
import {
  FolderTree, LineChart, LayoutDashboard, PlaySquare, Server,
  Compass, Activity, Search, Boxes, ScrollText, ChevronLeft, ChevronRight,
  Menu, X, Settings, Palette, Moon, Sun, FolderOpen, Tag,
  ChartLine, MessageSquarePlus, Trash2, ChevronUp, ChevronDown,
} from 'lucide-react';
import TagExplorer from './components/TagExplorer.jsx';
import DynamicChart from './components/DynamicChart.jsx';
import DemoScenarios from './components/DemoScenarios.jsx';
import SystemStatus from './components/SystemStatus.jsx';
import DemoGuide from './components/DemoGuide.jsx';
import DashboardBuilder from './components/DashboardBuilder.jsx';
import ProjectManager from './components/ProjectManager.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import EventLog from './components/EventLog.jsx';
import SettingsPage from './components/Settings.jsx';
import FloatingChat from './components/FloatingChat.jsx';
import useTagWorkspace from './hooks/useTagWorkspace.jsx';
import { getIgnitionStatus } from './api.js';
import { useTheme } from './lib/theme.jsx';
import logger from './lib/logger.js';

const TABS = [
  { id: 'guide', label: 'Guide', icon: Compass, group: 'main' },
  { id: 'tags', label: 'Tags', icon: FolderTree, group: 'main' },
  { id: 'charts', label: 'Charts', icon: LineChart, group: 'main' },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'projects', label: 'Projects', icon: Boxes, group: 'manage' },
  { id: 'scenarios', label: 'Scenarios', icon: PlaySquare, group: 'tools' },
  { id: 'logs', label: 'Event Log', icon: ScrollText, group: 'tools' },
  { id: 'system', label: 'System', icon: Server, group: 'tools' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'tools' },
];

const GROUP_LABELS = {
  main: 'Navigation',
  manage: 'Management',
  tools: 'Tools',
};

export default function App() {
  const [tab, setTab] = useState('guide');
  const [connected, setConnected] = useState(null);
  const [chartRequest, setChartRequest] = useState(null);
  const [chatSeed, setChatSeed] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);
  const workspace = useTagWorkspace();
  const { themeId, switchTheme, themes } = useTheme();

  useEffect(() => {
    logger.info('app', 'initialized');
    logger.startAutoFlush();
    return () => logger.stopAutoFlush();
  }, []);

  useEffect(() => {
    getIgnitionStatus().then(data => setConnected(data.connected)).catch(() => setConnected(false));
    const iv = setInterval(() => {
      getIgnitionStatus().then(data => setConnected(data.connected)).catch(() => setConnected(false));
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const showChart = (paths, startTime) => {
    setChartRequest({ tags: paths, range: startTime || '-1h' });
    setTab('charts');
    logger.track('navigate_chart', { paths, startTime });
  };

  const openChatPrompt = (prompt) => {
    setChatSeed({ prompt, ts: Date.now() });
    logger.track('open_chat_prompt', { promptLength: prompt.length });
  };

  const handleSearchNavigate = useCallback((item) => {
    if (item.type === 'tag') {
      workspace.addTags([item.path]);
      setTab('tags');
    } else if (item.type === 'view') {
      setTab('projects');
    } else if (item.type === 'doc') {
      openChatPrompt(`Search docs for: ${item.name}`);
    } else {
      setTab('tags');
    }
    logger.track('search_navigate', { type: item.type, path: item.path });
  }, [workspace]);

  const switchTab = (id) => {
    setTab(id);
    setMobileMenuOpen(false);
    logger.track('tab_switch', { tab: id });
  };

  const cycleTheme = () => {
    const ids = Object.keys(themes);
    const idx = ids.indexOf(themeId);
    switchTheme(ids[(idx + 1) % ids.length]);
  };

  // Workspace tag groups for titlebar display
  const workspaceGroups = {};
  for (const tag of workspace.tags) {
    const parts = tag.split('/');
    const provider = parts.length > 1 ? parts[1] : 'default';
    if (!workspaceGroups[provider]) workspaceGroups[provider] = [];
    workspaceGroups[provider].push(tag);
  }

  return (
    <div className="h-screen flex flex-col t-bg t-text">
      {/* ═══ Titlebar ═══ */}
      <header className="flex items-center gap-3 px-3 py-1.5 shrink-0 z-30 border-b t-head-bg t-border-s">
        {/* Left: brand + mobile hamburger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(v => !v)}
            className="lg:hidden p-1.5 rounded-md transition-colors t-text-m cursor-pointer"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md t-accent-bg"
          >
            <Activity size={16} className="text-white" />
          </div>
          <div className="hidden sm:block leading-tight">
            <h1 className="text-sm font-bold t-text">Ignition Copilot</h1>
            <p className="text-[10px] t-text-m">SCADA Assistant</p>
          </div>
        </div>

        {/* Center: workspace tags in titlebar */}
        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden px-2">
          <button
            onClick={() => setWorkspaceExpanded(v => !v)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors t-surface t-text-2 cursor-pointer"
          >
            <FolderOpen size={12} />
            <span className="hidden sm:inline">Workspace</span>
            <span
              className={`inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full t-accent ${workspace.tags.length > 0 ? 't-accent-soft' : 't-surface'}`}
            >
              {workspace.tags.length}
            </span>
            {workspace.tags.length > 0 && (workspaceExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>

          {/* Inline tag pills (collapsed view — show first few) */}
          {!workspaceExpanded && workspace.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {workspace.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  title={tag}
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md truncate max-w-[120px] t-surface t-text-2 border t-border-s"
                >
                  {tag.split('/').pop()}
                  <button
                    onClick={(e) => { e.stopPropagation(); workspace.removeTag(tag); }}
                    className="hover:opacity-100 opacity-50 transition-opacity t-text-m cursor-pointer"
                  >
                    <X size={8} />
                  </button>
                </span>
              ))}
              {workspace.tags.length > 4 && (
                <span className="text-[10px] px-1 t-text-m">+{workspace.tags.length - 4}</span>
              )}
            </div>
          )}

          {/* Quick workspace actions */}
          {workspace.tags.length > 0 && (
            <div className="hidden md:flex items-center gap-1 ml-auto shrink-0">
              <button
                onClick={() => showChart(workspace.tags, '-1h')}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors t-accent-soft t-accent cursor-pointer"
              >
                <ChartLine size={10} /> Charts
              </button>
              <button
                onClick={() => openChatPrompt(`Read and summarize these workspace tags:\n${workspace.tags.join('\n')}`)}
                className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors t-info-soft t-info cursor-pointer"
              >
                <MessageSquarePlus size={10} /> Chat
              </button>
              <button
                onClick={workspace.clearTags}
                className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors t-text-m cursor-pointer"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Right: search, theme, status */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors t-surface t-text-m cursor-pointer"
          >
            <Search size={12} />
            <span className="hidden md:inline">Search</span>
            <kbd
              className="hidden md:inline text-[9px] px-1 py-0.5 rounded ml-1 font-mono t-bg t-text-m border t-border-s"
            >
              ⌘K
            </kbd>
          </button>

          <button
            onClick={cycleTheme}
            className="p-1.5 rounded-md transition-colors t-text-m cursor-pointer"
            title={`Theme: ${themeId}`}
          >
            <Palette size={15} />
          </button>

          {/* Connection status */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
              connected === true ? 't-ok-soft t-ok' : connected === false ? 't-err-soft t-err' : 't-warn-soft t-warn'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected === null ? 'animate-pulse' : ''} ${
                connected === true ? 't-ok-fill' : connected === false ? 't-err-fill' : 't-warn-fill'
              }`}
            />
            <span className="hidden sm:inline">
              {connected === true ? 'Online' : connected === false ? 'Offline' : '...'}
            </span>
          </div>
        </div>
      </header>

      {/* Expanded workspace panel (below titlebar) */}
      {workspaceExpanded && workspace.tags.length > 0 && (
        <div
          className="border-b px-4 py-2 shrink-0 animate-slide-up t-bg-alt t-border-s"
        >
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(workspaceGroups).map(([provider, tags]) => (
              <div key={provider} className="flex items-center gap-1">
                {Object.keys(workspaceGroups).length > 1 && (
                  <span className="text-[9px] uppercase tracking-wider mr-1 t-text-m">
                    <Tag size={8} className="inline mr-0.5" />{provider}
                  </span>
                )}
                {tags.map(tag => (
                  <span
                    key={tag}
                    title={tag}
                    className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded-md t-surface t-text-2 border t-border-s"
                  >
                    {tag.split('/').pop()}
                    <button
                      onClick={() => workspace.removeTag(tag)}
                      className="opacity-50 hover:opacity-100 transition-opacity t-err cursor-pointer"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Body ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Sidebar ─── */}
        <nav
          className={`
            flex flex-col shrink-0 z-20 transition-all duration-200 border-r t-nav-bg t-border-s
            ${sidebarCollapsed ? 'w-14' : 'w-48'}
            ${mobileMenuOpen ? 'fixed inset-y-0 left-0 top-[49px] w-48 shadow-2xl' : 'hidden lg:flex'}
          `}
        >
          <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
            {Object.entries(GROUP_LABELS).map(([group, label]) => {
              const groupTabs = TABS.filter(t => t.group === group);
              return (
                <div key={group} className="mb-1">
                  {!sidebarCollapsed && (
                    <div className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest t-text-m">
                      {label}
                    </div>
                  )}
                  {groupTabs.map(t => {
                    const Icon = t.icon;
                    const isActive = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => switchTab(t.id)}
                        title={sidebarCollapsed ? t.label : undefined}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-all rounded-md mx-auto cursor-pointer ${
                          sidebarCollapsed ? 'justify-center w-10 mx-2' : 'mx-1'
                        } ${
                          isActive ? 't-accent-soft t-accent font-semibold' : 't-text-2 hover:t-surface-h'
                        }`}
                        style={{
                          borderLeft: isActive && !sidebarCollapsed ? '2px solid var(--color-accent)' : '2px solid transparent',
                        }}
                      >
                        <Icon size={16} className={isActive ? 't-accent' : 't-text-m'} />
                        {!sidebarCollapsed && <span>{t.label}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="hidden lg:flex items-center justify-center py-2.5 border-t transition-colors t-border-s t-text-m cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </nav>

        {/* Mobile overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-[15] lg:hidden"
            style={{ background: 'rgba(0,0,0,0.4)' }}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* ─── Main content ─── */}
        <main className="flex-1 overflow-hidden min-w-0">
          {tab === 'guide' && <DemoGuide onOpenChatPrompt={openChatPrompt} onOpenCharts={showChart} onOpenScenarios={() => setTab('scenarios')} onOpenDashboard={() => setTab('dashboard')} />}
          {tab === 'tags' && <TagExplorer workspaceTags={workspace.tags} onAddWorkspaceTags={workspace.addTags} />}
          {tab === 'charts' && <DynamicChart chartRequest={chartRequest} workspaceTags={workspace.tags} onAddWorkspaceTags={workspace.addTags} />}
          {tab === 'dashboard' && <DashboardBuilder onOpenChatPrompt={openChatPrompt} />}
          {tab === 'projects' && <ProjectManager />}
          {tab === 'scenarios' && <DemoScenarios />}
          {tab === 'logs' && <EventLog />}
          {tab === 'system' && <SystemStatus />}
          {tab === 'settings' && <SettingsPage />}
        </main>
      </div>

      {/* ═══ Floating AI Chat ═══ */}
      <FloatingChat
        onShowChart={showChart}
        workspaceTags={workspace.tags}
        onAddWorkspaceTags={workspace.addTags}
        seedPrompt={chatSeed}
      />

      {/* ═══ Global Search Modal ═══ */}
      {showSearch && (
        <GlobalSearch onNavigate={handleSearchNavigate} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
