import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderTree, LineChart, LayoutDashboard, PlaySquare, Server,
  Compass, Activity, Search, Boxes, ScrollText, ChevronLeft, ChevronRight,
  Menu, X, Settings, Palette, Moon, Sun, FolderOpen, Tag,
  ChartLine, MessageSquarePlus, Trash2, ChevronUp, ChevronDown, RefreshCw,
} from 'lucide-react';
import { readTags } from './api.js';
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
  const [navWidth, setNavWidth] = useState(192);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspacePopupOpen, setWorkspacePopupOpen] = useState(false);
  const [workspaceValues, setWorkspaceValues] = useState({});
  const workspace = useTagWorkspace();
  const { themeId, switchTheme, themes } = useTheme();
  const navResizeRef = useRef(null);
  const workspaceBtnRef = useRef(null);

  // Live workspace tag polling
  useEffect(() => {
    if (workspace.tags.length === 0) { setWorkspaceValues({}); return; }
    const poll = async () => {
      try {
        const result = await readTags(workspace.tags);
        if (result.success !== false && result.results) {
          const vals = {};
          result.results.forEach(v => { vals[v.path] = v; });
          setWorkspaceValues(vals);
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 5000);
    return () => clearInterval(iv);
  }, [workspace.tags.join(',')]);

  // Nav resize drag handler
  const startNavResize = useCallback((e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = navWidth;
    const onMove = (ev) => {
      const delta = ev.clientX - startX;
      const newW = Math.max(56, Math.min(280, startW + delta));
      setNavWidth(newW);
      setSidebarCollapsed(newW < 80);
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [navWidth]);

  // Close workspace popup on outside click
  useEffect(() => {
    if (!workspacePopupOpen) return;
    const handler = (e) => {
      if (workspaceBtnRef.current && !workspaceBtnRef.current.contains(e.target)) {
        const popup = document.getElementById('workspace-popup');
        if (popup && !popup.contains(e.target)) setWorkspacePopupOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [workspacePopupOpen]);

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

  const actualNavWidth = sidebarCollapsed ? 56 : navWidth;

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
        <div className="flex-1 flex items-center gap-2 min-w-0 overflow-hidden px-2 relative">
          <button
            ref={workspaceBtnRef}
            onClick={() => setWorkspacePopupOpen(v => !v)}
            className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md transition-colors t-surface t-text-2 cursor-pointer"
          >
            <FolderOpen size={12} />
            <span className="hidden sm:inline">Workspace</span>
            <span
              className={`inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full t-accent ${workspace.tags.length > 0 ? 't-accent-soft' : 't-surface'}`}
            >
              {workspace.tags.length}
            </span>
            {workspace.tags.length > 0 && (workspacePopupOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>

          {/* Inline tag pills */}
          {!workspacePopupOpen && workspace.tags.length > 0 && (
            <div className="flex items-center gap-1 overflow-hidden">
              {workspace.tags.slice(0, 4).map(tag => (
                <span key={tag} title={tag} className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md truncate max-w-[120px] t-surface t-text-2 border t-border-s">
                  {tag.split('/').pop()}
                  <button onClick={(e) => { e.stopPropagation(); workspace.removeTag(tag); }} className="hover:opacity-100 opacity-50 transition-opacity t-text-m cursor-pointer">
                    <X size={8} />
                  </button>
                </span>
              ))}
              {workspace.tags.length > 4 && <span className="text-[10px] px-1 t-text-m">+{workspace.tags.length - 4}</span>}
            </div>
          )}

          {workspace.tags.length > 0 && (
            <div className="hidden md:flex items-center gap-1 ml-auto shrink-0">
              <button onClick={() => showChart(workspace.tags, '-1h')} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors t-accent-soft t-accent cursor-pointer">
                <ChartLine size={10} /> Charts
              </button>
              <button onClick={() => openChatPrompt(`Read and summarize these workspace tags:\n${workspace.tags.join('\n')}`)} className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md transition-colors t-info-soft t-info cursor-pointer">
                <MessageSquarePlus size={10} /> Chat
              </button>
              <button onClick={workspace.clearTags} className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors t-text-m cursor-pointer">
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

      {/* Floating workspace popup */}
      {workspacePopupOpen && (
        <div
          id="workspace-popup"
          className="fixed z-40 animate-slide-up t-surface border t-border-s rounded-xl t-shadow-lg"
          style={{ top: '52px', left: `${actualNavWidth + 16}px`, width: 'min(400px, calc(100vw - 120px))', maxHeight: 'calc(100vh - 100px)' }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b t-border-s">
            <span className="text-sm font-semibold t-text flex items-center gap-1.5">
              <FolderOpen size={14} className="t-accent" />
              Workspace Tags
              <span className="text-[10px] px-1.5 py-0.5 rounded-full t-accent-soft t-accent font-bold">{workspace.tags.length}</span>
            </span>
            <div className="flex items-center gap-1">
              {workspace.tags.length > 0 && (
                <>
                  <button onClick={() => { showChart(workspace.tags, '-1h'); setWorkspacePopupOpen(false); }} className="text-[10px] px-2 py-1 rounded t-accent-soft t-accent cursor-pointer" title="Open in Charts">
                    <ChartLine size={12} />
                  </button>
                  <button onClick={workspace.clearTags} className="text-[10px] px-2 py-1 rounded t-text-m hover:t-err cursor-pointer" title="Clear all">
                    <Trash2 size={12} />
                  </button>
                </>
              )}
              <button onClick={() => setWorkspacePopupOpen(false)} className="p-1 t-text-m hover:t-text-2 cursor-pointer">
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto p-3 space-y-2" style={{ maxHeight: '400px' }}>
            {workspace.tags.length === 0 && (
              <p className="text-xs t-text-m text-center py-6">No tags in workspace. Add tags from the Tag Explorer.</p>
            )}
            {Object.entries(workspaceGroups).map(([provider, tags]) => (
              <div key={provider}>
                {Object.keys(workspaceGroups).length > 1 && (
                  <div className="flex items-center gap-1 text-[10px] t-text-m uppercase tracking-wider mb-1">
                    <Tag size={10} />{provider}
                  </div>
                )}
                <div className="space-y-1">
                  {tags.map(tag => {
                    const val = workspaceValues[tag];
                    return (
                      <div key={tag} className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border t-border-s hover:bg-[var(--color-surface-hover)] transition-colors" title={tag}>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono t-text-2 truncate">{tag.split('/').pop()}</div>
                          <div className="text-[10px] t-text-m truncate">{tag}</div>
                        </div>
                        {val && (
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded t-bg-alt t-text shrink-0">
                            {typeof val.value === 'number' ? val.value.toFixed(2) : String(val.value).slice(0, 12)}
                          </span>
                        )}
                        {val && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${val.quality === 'Good' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`} />
                        )}
                        <button onClick={() => workspace.removeTag(tag)} className="opacity-0 group-hover:opacity-100 t-text-m hover:t-err cursor-pointer transition-opacity">
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {workspace.tags.length > 0 && (
            <div className="px-4 py-2 border-t t-border-s flex items-center gap-1.5 text-[10px] t-text-m">
              <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
              Live updates every 5s
            </div>
          )}
        </div>
      )}

      {/* ═══ Body ═══ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Sidebar ─── */}
        <nav
          className={`
            flex flex-col shrink-0 z-20 transition-all duration-200 border-r t-nav-bg t-border-s relative
            ${mobileMenuOpen ? 'fixed inset-y-0 left-0 top-[49px] w-48 shadow-2xl' : 'hidden lg:flex'}
          `}
          style={!mobileMenuOpen ? { width: `${actualNavWidth}px` } : undefined}
        >
          {/* Drag handle for resize */}
          {!mobileMenuOpen && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 hover:bg-[var(--color-accent)] hover:w-1 transition-all"
              onPointerDown={startNavResize}
            />
          )}
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
            onClick={() => {
              if (sidebarCollapsed) {
                setSidebarCollapsed(false);
                setNavWidth(192);
              } else {
                setSidebarCollapsed(true);
                setNavWidth(56);
              }
            }}
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
        onRemoveWorkspaceTag={workspace.removeTag}
        seedPrompt={chatSeed}
      />

      {/* ═══ Global Search Modal ═══ */}
      {showSearch && (
        <GlobalSearch onNavigate={handleSearchNavigate} onClose={() => setShowSearch(false)} />
      )}
    </div>
  );
}
