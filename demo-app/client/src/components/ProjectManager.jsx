import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FileJson, ChevronRight, ChevronDown, Plus, Save, Trash2, RefreshCw,
  Settings2, ExternalLink, Eye, Code, Layers, AlertTriangle, FolderTree, Search,
  X, Check, Layout, BarChart3, Bell, Navigation, FileCode, Database, Copy,
} from 'lucide-react';
import { useNotifications } from '../lib/notifications.jsx';

const API = '/api/projects';

// ─── API helpers ─────────────────────────────────────────

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Component Tree Renderer ─────────────────────────────

function ComponentTree({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (!node || typeof node !== 'object') return null;
  const name = node.meta?.name || node.type?.split('.').pop() || 'unknown';
  const type = node.type || 'unknown';
  const hasChildren = node.children?.length > 0;

  return (
    <div>
      <button
        onClick={() => hasChildren && setExpanded(v => !v)}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:t-surface-h rounded transition-colors ${hasChildren ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
        <span className="font-medium t-text">{name}</span>
        <span className="t-text-m text-[10px] truncate">{type}</span>
      </button>
      {expanded && hasChildren && node.children.map((child, i) => (
        <ComponentTree key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ─── View Tree Item ──────────────────────────────────────

function ViewTreeItem({ item, selected, onSelect, depth = 0, children }) {
  const [expanded, setExpanded] = useState(true);
  const isFolder = item.isFolder;
  const isActive = selected === item.path;

  return (
    <div>
      <button
        onClick={() => isFolder ? setExpanded(v => !v) : onSelect(item)}
        className={`w-full flex items-center gap-1.5 py-1.5 text-sm transition-colors rounded-md cursor-pointer ${
          isActive ? 't-accent-soft t-accent font-medium' : 't-text-2 hover:t-surface-h'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isFolder ? (
          expanded ? <ChevronDown size={13} className="t-text-m shrink-0" /> : <ChevronRight size={13} className="t-text-m shrink-0" />
        ) : (
          <FileJson size={13} className={`shrink-0 ${isActive ? 't-accent' : 't-text-m'}`} />
        )}
        {isFolder && <FolderOpen size={13} className="t-warn shrink-0" />}
        <span className="truncate">{item.name}</span>
      </button>
      {expanded && children}
    </div>
  );
}

// ─── Template Picker ─────────────────────────────────────

function ViewTreeItemRecursive({ item, selected, onSelect, depth = 0 }) {
  return (
    <ViewTreeItem item={item} selected={selected} onSelect={onSelect} depth={depth}>
      {item.children?.map((child, i) => (
        <ViewTreeItemRecursive
          key={child.path || i}
          item={child}
          selected={selected}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </ViewTreeItem>
  );
}

const TEMPLATES = [
  { id: 'blank', label: 'Blank', icon: Layout, desc: 'Empty flex container' },
  { id: 'kpi', label: 'KPI Dashboard', icon: BarChart3, desc: '4 KPI cards + trend chart' },
  { id: 'detail', label: 'Asset Detail', icon: Eye, desc: 'Properties panel + chart' },
  { id: 'alarm', label: 'Alarm View', icon: Bell, desc: 'Alarm status table' },
  { id: 'navigation', label: 'Navigation', icon: Navigation, desc: 'Sidebar navigation menu' },
];

// ─── Main Component ──────────────────────────────────────

export default function ProjectManager() {
  const [config, setConfig] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [views, setViews] = useState([]);
  const [scripts, setScripts] = useState([]);
  const [queries, setQueries] = useState([]);
  const [selectedView, setSelectedView] = useState(null);
  const [viewContent, setViewContent] = useState(null);
  const [editorText, setEditorText] = useState('');
  const [editorDirty, setEditorDirty] = useState(false);
  const [editorError, setEditorError] = useState(null);
  const [activeTab, setActiveTab] = useState('tree'); // 'tree' | 'editor' | 'preview'
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewTemplate, setNewViewTemplate] = useState('blank');
  const [loading, setLoading] = useState(true);
  const [resourceTab, setResourceTab] = useState('views'); // 'views' | 'scripts' | 'queries'
  const [configForm, setConfigForm] = useState({ ignitionDir: '', gatewayUrl: '' });
  const notifications = useNotifications();
  const editorRef = useRef(null);

  // Load config + projects on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await fetchJson(`${API}/config`);
      setConfig(cfg);
      setConfigForm({ ignitionDir: cfg.ignitionDir, gatewayUrl: cfg.gatewayUrl });
      await loadProjects();
    } catch (err) {
      notifications.error(`Failed to load config: ${err.message}`);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJson(API);
      setProjects(data.projects || []);
      setConfig(prev => ({ ...prev, exists: data.exists, ignitionDir: data.ignitionDir, gatewayUrl: data.gatewayUrl }));
      if (!data.exists) {
        setShowSettings(true);
      } else if (data.projects.length > 0 && !selectedProject) {
        selectProject(data.projects[0].name);
      }
    } catch (err) {
      notifications.error(`Failed to load projects: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  const selectProject = useCallback(async (projectName) => {
    setSelectedProject(projectName);
    setSelectedView(null);
    setViewContent(null);
    setEditorText('');
    setEditorDirty(false);
    try {
      const [viewsData, scriptsData, queriesData] = await Promise.all([
        fetchJson(`${API}/${encodeURIComponent(projectName)}/views`),
        fetchJson(`${API}/${encodeURIComponent(projectName)}/scripts`).catch(() => ({ scripts: [] })),
        fetchJson(`${API}/${encodeURIComponent(projectName)}/named-queries`).catch(() => ({ queries: [] })),
      ]);
      setViews(viewsData.views || []);
      setScripts(scriptsData.scripts || []);
      setQueries(queriesData.queries || []);
    } catch (err) {
      notifications.error(`Failed to load project: ${err.message}`);
    }
  }, []);

  const loadView = useCallback(async (viewItem) => {
    setSelectedView(viewItem.path);
    try {
      const data = await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/view?path=${encodeURIComponent(viewItem.path)}`);
      setViewContent(data.content);
      setEditorText(JSON.stringify(data.content, null, 2));
      setEditorDirty(false);
      setEditorError(null);
      setActiveTab('tree');
    } catch (err) {
      notifications.error(`Failed to load view: ${err.message}`);
    }
  }, [selectedProject]);

  const saveView = useCallback(async () => {
    if (!selectedView || !selectedProject) return;
    try {
      const content = JSON.parse(editorText);
      if (!content.root) throw new Error('View must have a root property');
      await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/view`, {
        method: 'PUT',
        body: JSON.stringify({ path: selectedView, content }),
      });
      setViewContent(content);
      setEditorDirty(false);
      setEditorError(null);
      notifications.success('View saved successfully');
    } catch (err) {
      setEditorError(err.message);
      notifications.error(`Save failed: ${err.message}`);
    }
  }, [selectedView, selectedProject, editorText]);

  const createView = useCallback(async () => {
    if (!newViewName.trim() || !selectedProject) return;
    try {
      await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/views`, {
        method: 'POST',
        body: JSON.stringify({ name: newViewName.trim(), template: newViewTemplate }),
      });
      notifications.success(`View "${newViewName}" created`);
      setShowCreateView(false);
      setNewViewName('');
      setNewViewTemplate('blank');
      await selectProject(selectedProject);
    } catch (err) {
      notifications.error(`Create failed: ${err.message}`);
    }
  }, [newViewName, newViewTemplate, selectedProject, selectProject]);

  const deleteView = useCallback(async () => {
    if (!selectedView || !selectedProject) return;
    try {
      await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/view?path=${encodeURIComponent(selectedView)}`, { method: 'DELETE' });
      notifications.success('View deleted');
      setSelectedView(null);
      setViewContent(null);
      setEditorText('');
      await selectProject(selectedProject);
    } catch (err) {
      notifications.error(`Delete failed: ${err.message}`);
    }
  }, [selectedView, selectedProject, selectProject]);

  const saveConfig = useCallback(async () => {
    try {
      const data = await fetchJson(`${API}/config`, {
        method: 'POST',
        body: JSON.stringify(configForm),
      });
      setConfig(data);
      setShowSettings(false);
      notifications.success('Configuration updated');
      await loadProjects();
    } catch (err) {
      notifications.error(`Config save failed: ${err.message}`);
    }
  }, [configForm, loadProjects]);

  const handleEditorChange = (e) => {
    const text = e.target.value;
    setEditorText(text);
    setEditorDirty(true);
    try {
      JSON.parse(text);
      setEditorError(null);
    } catch (err) {
      setEditorError(err.message);
    }
  };

  const perspectiveUrl = config?.gatewayUrl
    ? `${config.gatewayUrl}/data/perspective/client/${selectedProject}`
    : null;

  // Build folder-grouped view tree
  const viewTree = buildViewTree(views);

  // ─── Settings Panel ──────────────────────────────
  if (showSettings) {
    return (
      <div className="h-full flex items-center justify-center t-bg p-6">
        <div className="t-surface rounded-xl t-shadow-lg border t-border-s p-6 max-w-lg w-full">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={20} className="t-accent" />
            <h2 className="text-lg font-semibold t-text">Ignition Configuration</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium t-text-2 mb-1">Ignition Installation Directory</label>
              <input
                value={configForm.ignitionDir}
                onChange={e => setConfigForm(f => ({ ...f, ignitionDir: e.target.value }))}
                placeholder="C:\Program Files\Inductive Automation\Ignition"
                className="w-full border t-field-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:t-accent-border"
              />
              <p className="text-xs t-text-m mt-1">
                Projects are read from <code className="t-bg-alt px-1 rounded">{'{'}dir{'}'}/data/projects/</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium t-text-2 mb-1">Gateway URL</label>
              <input
                value={configForm.gatewayUrl}
                onChange={e => setConfigForm(f => ({ ...f, gatewayUrl: e.target.value }))}
                placeholder="http://localhost:8088"
                className="w-full border t-field-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:t-accent-border"
              />
              <p className="text-xs t-text-m mt-1">Used for Perspective view preview links</p>
            </div>

            {config && !config.exists && (
              <div className="flex items-start gap-2 p-3 t-warn-soft border t-warn-border rounded-lg text-sm t-warn">
                <AlertTriangle size={16} className="shrink-0 mt-0.5 t-warn" />
                <span>Directory not found. Please verify the Ignition installation path.</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button onClick={saveConfig} className="flex-1 t-accent-bg text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                <Check size={14} /> Save & Reload
              </button>
              {config?.exists && (
                <button onClick={() => setShowSettings(false)} className="px-4 py-2 border t-border rounded-lg text-sm t-text-2 hover:t-surface-h transition-colors cursor-pointer">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading state ────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center t-bg">
        <div className="flex items-center gap-2 t-text-m">
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading Ignition projects...</span>
        </div>
      </div>
    );
  }

  // ─── No projects ──────────────────────────────────
  if (projects.length === 0) {
    return (
      <div className="h-full flex items-center justify-center t-bg p-6">
        <div className="text-center max-w-md">
          <FolderTree size={48} className="mx-auto mb-4 t-text-m" />
          <h2 className="text-lg font-semibold t-text mb-2">No Projects Found</h2>
          <p className="text-sm t-text-m mb-4">
            No Ignition projects found at <code className="t-bg-alt px-1.5 py-0.5 rounded text-xs">{config?.ignitionDir}</code>.
            Make sure Ignition is installed and has at least one project.
          </p>
          <button onClick={() => setShowSettings(true)} className="t-accent-bg text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 transition-colors inline-flex items-center gap-2 cursor-pointer">
            <Settings2 size={14} /> Configure Path
          </button>
        </div>
      </div>
    );
  }

  // ─── Main Layout ──────────────────────────────────
  return (
    <div className="h-full flex flex-col t-bg">
      {/* Header bar */}
      <header className="t-surface border-b t-border-s px-4 py-2 flex items-center gap-3 shrink-0">
        <FolderTree size={16} className="t-accent" />
        <select
          value={selectedProject || ''}
          onChange={e => selectProject(e.target.value)}
          className="text-sm font-medium border t-border-s rounded-lg px-2 py-1.5 t-field-bg t-field-fg focus:outline-none focus:t-accent-border cursor-pointer"
        >
          {projects.map(p => (
            <option key={p.name} value={p.name}>
              {p.title || p.name}
              {!p.enabled ? ' (disabled)' : ''}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-xs t-text-m">
          {projects.find(p => p.name === selectedProject)?.hasPerspective && (
            <span className="t-accent-soft t-accent px-1.5 py-0.5 rounded">Perspective</span>
          )}
          {projects.find(p => p.name === selectedProject)?.hasVision && (
            <span className="bg-[var(--color-accent-subtle)] t-accent px-1.5 py-0.5 rounded">Vision</span>
          )}
        </div>

        <div className="flex-1" />

        {perspectiveUrl && (
          <a
            href={perspectiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs t-accent t-accent-soft px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <ExternalLink size={12} /> Open in Gateway
          </a>
        )}

        <button onClick={() => selectProject(selectedProject)} className="p-1.5 t-text-m hover:t-text-2 hover:t-surface-h rounded-lg transition-colors cursor-pointer" title="Refresh">
          <RefreshCw size={14} />
        </button>
        <button onClick={() => setShowSettings(true)} className="p-1.5 t-text-m hover:t-text-2 hover:t-surface-h rounded-lg transition-colors cursor-pointer" title="Settings">
          <Settings2 size={14} />
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left sidebar - resource browser */}
        <aside className="w-64 border-r t-border-s t-surface flex flex-col shrink-0">
          {/* Resource type tabs */}
          <div className="flex border-b t-border-s">
            {[
              { id: 'views', label: 'Views', icon: Eye, count: views.filter(v => v.isView).length },
              { id: 'scripts', label: 'Scripts', icon: FileCode, count: scripts.length },
              { id: 'queries', label: 'Queries', icon: Database, count: queries.length },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setResourceTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
                  resourceTab === tab.id ? 't-accent-border t-accent' : 'border-transparent t-text-m hover:t-text-2'
                }`}
              >
                <tab.icon size={12} />
                <span>{tab.label}</span>
                {tab.count > 0 && <span className="text-[10px] t-bg-alt px-1 rounded">{tab.count}</span>}
              </button>
            ))}
          </div>

          {/* Resource list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {resourceTab === 'views' && (
              <>
                {views.length === 0 && (
                  <p className="text-xs t-text-m text-center py-6">No Perspective views found</p>
                )}
                {viewTree.map((item, i) => (
                  <ViewTreeItemRecursive
                    key={item.path || i}
                    item={item}
                    selected={selectedView}
                    onSelect={loadView}
                    depth={0}
                  />
                ))}
              </>
            )}

            {resourceTab === 'scripts' && (
              <>
                {scripts.length === 0 && (
                  <p className="text-xs t-text-m text-center py-6">No scripts found</p>
                )}
                {scripts.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-sm t-text-2 hover:t-surface-h rounded cursor-pointer">
                    <FileCode size={13} className="t-ok shrink-0" />
                    <span className="truncate">{s.path}</span>
                  </div>
                ))}
              </>
            )}

            {resourceTab === 'queries' && (
              <>
                {queries.length === 0 && (
                  <p className="text-xs t-text-m text-center py-6">No named queries found</p>
                )}
                {queries.map((q, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-sm t-text-2 hover:t-surface-h rounded cursor-pointer">
                    <Database size={13} className="t-accent shrink-0" />
                    <span className="truncate">{q.path}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Create View button */}
          {resourceTab === 'views' && (
            <div className="p-2 border-t t-border-s">
              <button
                onClick={() => setShowCreateView(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium t-accent t-accent-soft hover:opacity-90 rounded-lg transition-colors cursor-pointer"
              >
                <Plus size={14} /> New View
              </button>
            </div>
          )}
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!viewContent ? (
            <div className="flex-1 flex items-center justify-center t-text-m">
              <div className="text-center">
                <Eye size={40} className="mx-auto mb-3 t-text-m" />
                <p className="text-sm">Select a view from the sidebar to inspect and edit</p>
              </div>
            </div>
          ) : (
            <>
              {/* View header */}
              <div className="t-surface border-b t-border-s px-4 py-2 flex items-center gap-3 shrink-0">
                <span className="text-sm font-medium t-text">{selectedView}</span>
                {editorDirty && <span className="text-xs t-warn-soft t-warn px-1.5 py-0.5 rounded">Modified</span>}

                <div className="flex-1" />

                {/* View tabs */}
                <div className="flex t-bg-alt rounded-lg p-0.5">
                  {[
                    { id: 'tree', label: 'Component Tree', icon: Layers },
                    { id: 'editor', label: 'JSON Editor', icon: Code },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        activeTab === tab.id ? 't-surface t-text t-shadow' : 't-text-m hover:t-text-2'
                      }`}
                    >
                      <tab.icon size={12} />
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-5 t-border-s" />

                <button
                  onClick={saveView}
                  disabled={!editorDirty || !!editorError}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium t-accent-bg text-white rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Save size={12} /> Save
                </button>
                <button
                  onClick={deleteView}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium t-err t-err-soft rounded-lg hover:opacity-90 transition-colors cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>

              {/* View content */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'tree' && (
                  <div className="h-full overflow-y-auto p-4">
                    <div className="max-w-3xl">
                      {/* View params & custom */}
                      {viewContent.params && Object.keys(viewContent.params).length > 0 && (
                        <div className="mb-4 p-3 t-bg-alt rounded-lg border t-border-s">
                          <h4 className="text-xs font-semibold t-text-m uppercase mb-2">View Parameters</h4>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(viewContent.params).map(([key, val]) => (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <span className="font-mono font-medium t-text">{key}</span>
                                <span className="t-text-m">=</span>
                                <span className="t-text-2 font-mono">{JSON.stringify(val)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Component tree */}
                      <div className="t-surface rounded-lg border t-border-s">
                        <div className="px-3 py-2 border-b t-border-s flex items-center gap-2">
                          <Layers size={14} className="t-accent" />
                          <span className="text-xs font-semibold t-text-2">Component Tree</span>
                        </div>
                        <div className="p-1">
                          <ComponentTree node={viewContent.root} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'editor' && (
                  <div className="h-full flex flex-col">
                    {editorError && (
                      <div className="px-4 py-2 t-err-soft border-b t-err-border flex items-center gap-2 text-xs t-err">
                        <AlertTriangle size={12} />
                        JSON Error: {editorError}
                      </div>
                    )}
                    <textarea
                      ref={editorRef}
                      value={editorText}
                      onChange={handleEditorChange}
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                          e.preventDefault();
                          saveView();
                        }
                        // Tab key inserts spaces
                        if (e.key === 'Tab') {
                          e.preventDefault();
                          const start = e.target.selectionStart;
                          const end = e.target.selectionEnd;
                          const val = e.target.value;
                          setEditorText(val.substring(0, start) + '  ' + val.substring(end));
                          setTimeout(() => {
                            e.target.selectionStart = e.target.selectionEnd = start + 2;
                          }, 0);
                        }
                      }}
                      spellCheck={false}
                      className="flex-1 w-full p-4 font-mono text-xs t-field-fg t-field-bg border-none resize-none focus:outline-none leading-relaxed"
                      placeholder="Select a view to edit its JSON..."
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create View Modal */}
      {showCreateView && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateView(false)}>
          <div className="t-surface rounded-xl t-shadow-lg border t-border-s max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold t-text">Create New View</h3>
              <button onClick={() => setShowCreateView(false)} className="t-text-m hover:t-text-2 cursor-pointer"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium t-text-2 mb-1">View Path / Name</label>
                <input
                  value={newViewName}
                  onChange={e => setNewViewName(e.target.value)}
                  placeholder="e.g. Pages/Overview or Home"
                  className="w-full border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  onKeyDown={e => e.key === 'Enter' && createView()}
                />
                <p className="text-xs t-text-m mt-1">Use <code>/</code> for folders, e.g. <code>Navigation/Sidebar</code></p>
              </div>

              <div>
                <label className="block text-sm font-medium t-text-2 mb-2">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setNewViewTemplate(t.id)}
                      className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        newViewTemplate === t.id
                          ? 't-accent-border t-accent-soft ring-1 ring-[var(--color-accent)]'
                          : 't-border-s hover:t-border hover:t-surface-h'
                      }`}
                    >
                      <t.icon size={16} className={newViewTemplate === t.id ? 't-accent' : 't-text-m'} />
                      <div>
                        <div className="text-sm font-medium t-text">{t.label}</div>
                        <div className="text-xs t-text-m">{t.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={createView}
                disabled={!newViewName.trim()}
                className="w-full t-accent-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={14} /> Create View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Organize flat view list into a hierarchical folder tree for recursive display */
function buildViewTree(views) {
  const folders = views.filter(v => v.isFolder);
  const viewItems = views.filter(v => v.isView);

  // Build a map of folderPath → { ...folder, children: [] }
  const folderMap = new Map();
  for (const f of folders) {
    folderMap.set(f.path, { ...f, children: [] });
  }

  const rootItems = [];

  for (const view of viewItems) {
    const parts = view.path.split('/');
    if (parts.length > 1) {
      // Find or create parent folder(s)
      let parentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        const currentPath = parentPath ? `${parentPath}/${segment}` : segment;
        if (!folderMap.has(currentPath)) {
          folderMap.set(currentPath, { name: segment, path: currentPath, isFolder: true, children: [] });
        }
        // Attach sub-folder to parent folder
        if (parentPath && folderMap.has(parentPath)) {
          const parent = folderMap.get(parentPath);
          if (!parent.children.find(c => c.path === currentPath)) {
            parent.children.push(folderMap.get(currentPath));
          }
        }
        parentPath = currentPath;
      }
      // Add view to its immediate parent folder
      const immediateParent = parts.slice(0, -1).join('/');
      if (folderMap.has(immediateParent)) {
        folderMap.get(immediateParent).children.push(view);
      }
    } else {
      rootItems.push(view);
    }
  }

  // Collect root-level folders (not nested inside another)
  const rootFolders = [];
  for (const [path, folder] of folderMap) {
    if (!path.includes('/')) {
      rootFolders.push(folder);
    }
  }

  // Add any remaining empty folders not already in roots
  for (const f of folders) {
    if (!f.path.includes('/') && !rootFolders.find(r => r.path === f.path)) {
      rootFolders.push(folderMap.get(f.path) || { ...f, children: [] });
    }
  }

  return [...rootFolders, ...rootItems];
}
