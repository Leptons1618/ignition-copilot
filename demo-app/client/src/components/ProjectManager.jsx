import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FileJson, ChevronRight, ChevronDown, Plus, Save, Trash2, RefreshCw,
  Settings2, ExternalLink, Eye, Code, Layers, AlertTriangle, FolderTree, Search,
  X, Check, Layout, BarChart3, Bell, Navigation, FileCode, Database, Copy,
  Wand2, Loader2, CheckCircle2, Monitor, Download, Upload, Edit3, Globe,
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

function ComponentTree({ node, depth = 0, onSelectNode, selectedNodePath }) {
  const [expanded, setExpanded] = useState(depth < 2);
  if (!node || typeof node !== 'object') return null;
  const name = node.meta?.name || node.type?.split('.').pop() || 'unknown';
  const type = node.type || 'unknown';
  const hasChildren = node.children?.length > 0;
  const nodePath = `${depth}-${name}`;
  const isSelected = selectedNodePath === nodePath;

  return (
    <div>
      <button
        onClick={() => { if (hasChildren) setExpanded(v => !v); onSelectNode?.(node, nodePath); }}
        className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs hover:t-surface-h rounded transition-colors cursor-pointer ${
          isSelected ? 't-accent-soft t-accent font-semibold' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span className="w-3" />}
        <span className="font-medium t-text">{name}</span>
        <span className="t-text-m text-[10px] truncate">{type}</span>
        {node.props?.style && <span className="text-[9px] t-info px-1 rounded t-info-soft ml-auto">styled</span>}
      </button>
      {expanded && hasChildren && node.children.map((child, i) => (
        <ComponentTree key={i} node={child} depth={depth + 1} onSelectNode={onSelectNode} selectedNodePath={selectedNodePath} />
      ))}
    </div>
  );
}

// ─── Node Properties Panel ───────────────────────────────

function NodeProperties({ node }) {
  if (!node) return (
    <div className="p-4 text-xs t-text-m text-center">Click a component in the tree to view its properties</div>
  );

  const props = node.props || {};
  const meta = node.meta || {};
  const style = props.style || {};

  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <div className="font-semibold t-text mb-1">{meta.name || 'unnamed'}</div>
        <div className="font-mono text-[10px] t-text-m">{node.type}</div>
      </div>
      {Object.keys(props).length > 0 && (
        <div>
          <div className="font-semibold t-text-2 uppercase text-[10px] mb-1">Props</div>
          {Object.entries(props).filter(([k]) => k !== 'style').map(([key, val]) => (
            <div key={key} className="flex items-start gap-2 py-0.5">
              <span className="font-mono font-medium t-accent shrink-0">{key}</span>
              <span className="t-text-2 font-mono break-all">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
            </div>
          ))}
        </div>
      )}
      {Object.keys(style).length > 0 && (
        <div>
          <div className="font-semibold t-text-2 uppercase text-[10px] mb-1">Style</div>
          {Object.entries(style).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2 py-0.5">
              <span className="font-mono t-text-m">{key}</span>
              <span className="t-text-2 font-mono">{String(val)}</span>
            </div>
          ))}
        </div>
      )}
      {node.children?.length > 0 && (
        <div className="text-[10px] t-text-m">{node.children.length} child(ren)</div>
      )}
    </div>
  );
}

// ─── View Preview Renderer ───────────────────────────────

function ViewPreview({ viewContent }) {
  if (!viewContent?.root) {
    return <div className="flex items-center justify-center h-full t-text-m text-sm">No view content to preview</div>;
  }

  const pageConfig = viewContent.custom?.pageConfig;
  return (
    <div className="h-full flex flex-col bg-[#e8eaed] dark:bg-[#1a1a2e]">
      {/* Simulated browser chrome */}
      <div className="shrink-0 bg-white dark:bg-[#2a2a3e] border-b border-gray-200 dark:border-gray-700 px-3 py-1.5 flex items-center gap-2 text-xs">
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-gray-100 dark:bg-[#1a1a2e] rounded px-3 py-0.5 text-gray-500 dark:text-gray-400 font-mono text-[11px] truncate">
          {pageConfig?.url ? `localhost:8088/data/perspective/client/project${pageConfig.url}` : 'localhost:8088/data/perspective/client/project/view'}
        </div>
        {pageConfig?.title && <span className="text-gray-600 dark:text-gray-300 font-medium">{pageConfig.title}</span>}
      </div>

      {/* View canvas - fills remaining space */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-[#22223a] rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 min-h-full">
          <PreviewNode node={viewContent.root} />
        </div>
      </div>
    </div>
  );
}

function resolveBindingText(prop) {
  if (prop && typeof prop === 'object' && prop.binding?.config?.path) {
    const tagPath = prop.binding.config.path;
    return `🔗 ${tagPath.split('/').pop()}`;
  }
  return typeof prop === 'string' ? prop : '';
}

function PreviewNode({ node }) {
  if (!node || typeof node !== 'object') return null;
  const type = node.type || '';
  const props = node.props || {};
  const rawStyle = props.style || {};
  const style = { ...rawStyle };
  const children = node.children || [];
  const name = node.meta?.name || '';
  const tip = `${type} — ${name}`;

  // Flex container
  if (type.includes('container.flex')) {
    const dir = props.direction || 'column';
    const justify = props.justify || 'flex-start';
    const align = props.align || 'stretch';
    const wrap = props.wrap || 'nowrap';
    return (
      <div
        style={{ display: 'flex', flexDirection: dir, justifyContent: justify, alignItems: align, flexWrap: wrap, gap: style.gap || '4px', ...style, minHeight: children.length ? undefined : 40 }}
        title={tip}
      >
        {children.map((child, i) => <PreviewNode key={i} node={child} />)}
        {children.length === 0 && <PreviewEmpty name={name} type={type} />}
      </div>
    );
  }

  // Coord container
  if (type.includes('container.coord')) {
    return (
      <div style={{ position: 'relative', ...style, minHeight: children.length ? 200 : 60 }} title={tip}>
        {children.map((child, i) => (
          <div key={i} style={{ position: 'absolute', ...(child.position || {}) }}>
            <PreviewNode node={child} />
          </div>
        ))}
        {children.length === 0 && <PreviewEmpty name={name} type={type} />}
      </div>
    );
  }

  // Label
  if (type.includes('display.label')) {
    const text = resolveBindingText(props.text) || name || 'Label';
    return (
      <div style={{ ...style }} title={tip}>
        <span style={{ fontSize: style.fontSize || '14px', fontWeight: style.fontWeight || 'normal', color: style.color || 'inherit' }}>
          {text}
        </span>
      </div>
    );
  }

  // Gauge
  if (type.includes('display.gauge')) {
    const val = typeof props.value === 'number' ? props.value : 65;
    const max = props.max || 100;
    const pct = Math.min((val / max) * 100, 100);
    return (
      <div className="flex flex-col items-center justify-center p-3" style={{ ...style }} title={tip}>
        <svg viewBox="0 0 120 70" width="100" height="60">
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
          <path d="M 10 65 A 50 50 0 0 1 110 65" fill="none" stroke="#6366f1" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${pct * 1.57} 157`} />
          <text x="60" y="55" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">{val}</text>
        </svg>
        <span className="text-[10px] mt-0.5 opacity-60">{name || 'Gauge'}</span>
      </div>
    );
  }

  // LED
  if (type.includes('display.led')) {
    const c = props.color || '#22c55e';
    return (
      <div className="flex items-center gap-2 p-2" style={{ ...style }} title={tip}>
        <span className="inline-block w-3.5 h-3.5 rounded-full shadow-md" style={{ backgroundColor: c, boxShadow: `0 0 6px ${c}` }} />
        <span className="text-xs">{name || 'LED'}</span>
      </div>
    );
  }

  // Progress bar
  if (type.includes('progress-bar')) {
    const val = typeof props.value === 'number' ? props.value : 60;
    return (
      <div className="p-2" style={{ ...style }} title={tip}>
        <div className="text-[10px] mb-0.5 opacity-60">{name || 'Progress'} — {val}%</div>
        <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${val}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)' }} />
        </div>
      </div>
    );
  }

  // Button
  if (type.includes('input.button')) {
    return (
      <button
        className="px-4 py-1.5 text-sm font-medium rounded-md transition-colors"
        style={{ backgroundColor: style.backgroundColor || '#6366f1', color: style.color || '#fff', ...style }}
        title={tip}
      >
        {props.text || name || 'Button'}
      </button>
    );
  }

  // Toggle
  if (type.includes('toggle-switch')) {
    const on = props.value !== false;
    return (
      <div className="flex items-center gap-2 p-1" style={{ ...style }} title={tip}>
        <div className={`w-9 h-5 rounded-full relative ${on ? 'bg-indigo-500' : 'bg-gray-300'}`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
        </div>
        <span className="text-xs">{name}</span>
      </div>
    );
  }

  // Text field
  if (type.includes('input.text-field') || type.includes('input.numeric')) {
    return (
      <div className="p-1" style={{ ...style }} title={tip}>
        <div className="text-[10px] mb-0.5 opacity-60">{name}</div>
        <div className="border border-gray-300 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:border-gray-600">
          {props.placeholder || props.value || '…'}
        </div>
      </div>
    );
  }

  // Dropdown
  if (type.includes('input.dropdown')) {
    return (
      <div className="p-1" style={{ ...style }} title={tip}>
        <div className="text-[10px] mb-0.5 opacity-60">{name}</div>
        <div className="border border-gray-300 rounded px-2 py-1 text-xs bg-white dark:bg-gray-800 dark:border-gray-600 flex items-center justify-between">
          <span>{props.value || 'Select...'}</span>
          <ChevronDown size={10} />
        </div>
      </div>
    );
  }

  // Charts
  if (type.includes('chart') || type.includes('easy-chart')) {
    return (
      <div
        className="flex flex-col items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg"
        style={{ minHeight: 140, background: 'linear-gradient(180deg, #f8f9ff 0%, #f0f1ff 100%)', ...style }}
        title={tip}
      >
        <svg viewBox="0 0 200 60" width="180" height="50" className="opacity-40">
          <polyline points="0,50 20,30 40,45 60,20 80,35 100,15 120,25 140,10 160,30 180,20 200,25" fill="none" stroke="#6366f1" strokeWidth="2" />
          <polyline points="0,55 20,40 40,50 60,35 80,42 100,30 120,38 140,28 160,40 180,35 200,38" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeDasharray="4 2" />
        </svg>
        <div className="text-[11px] font-medium opacity-50 mt-1">{name || 'Trend Chart'}</div>
      </div>
    );
  }

  // Alarm tables
  if (type.includes('alarm')) {
    const isJournal = type.includes('journal');
    return (
      <div
        className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
        style={{ ...style }}
        title={tip}
      >
        <div className="px-3 py-1.5 text-xs font-medium flex items-center gap-1.5" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
          <Bell size={11} /> {isJournal ? 'Alarm Journal' : 'Active Alarms'}
        </div>
        <div className="text-[10px]">
          <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="flex-1 px-2 py-1 font-medium">Source</span>
            <span className="w-16 px-2 py-1 font-medium">Priority</span>
            <span className="w-16 px-2 py-1 font-medium">State</span>
          </div>
          {[
            ['Motor M12 OverTemp', 'High', 'Active'],
            ['Pump P5 LowFlow', 'Medium', 'Active'],
            ['Conv C1 Jam', 'Low', 'Cleared'],
          ].map((row, i) => (
            <div key={i} className={`flex border-b border-gray-50 dark:border-gray-700 ${i === 0 ? 'bg-red-50/50' : ''}`}>
              <span className="flex-1 px-2 py-1">{row[0]}</span>
              <span className={`w-16 px-2 py-1 ${row[1] === 'High' ? 'text-red-600' : row[1] === 'Medium' ? 'text-orange-500' : 'text-blue-500'}`}>{row[1]}</span>
              <span className="w-16 px-2 py-1">{row[2]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Navigation links
  if (type.includes('navigation.link') || type.includes('link')) {
    return (
      <div className="px-3 py-1.5 hover:bg-gray-100/50 dark:hover:bg-white/5 rounded transition-colors" style={{ ...style }} title={tip}>
        <span style={{ color: style.color || '#6366f1', fontSize: style.fontSize || '13px' }}>
          {props.text || name || 'Link'} →
        </span>
      </div>
    );
  }

  // Table
  if (type.includes('display.table')) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style={{ ...style }} title={tip}>
        <div className="text-[10px]">
          <div className="flex border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="flex-1 px-2 py-1 font-medium">Column A</span>
            <span className="flex-1 px-2 py-1 font-medium">Column B</span>
            <span className="flex-1 px-2 py-1 font-medium">Column C</span>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex border-b border-gray-50 dark:border-gray-700">
              <span className="flex-1 px-2 py-1">Row {i}</span>
              <span className="flex-1 px-2 py-1">Value</span>
              <span className="flex-1 px-2 py-1">Data</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Markdown
  if (type.includes('markdown')) {
    return (
      <div className="p-3 text-sm" style={{ ...style }} title={tip}>
        <div className="opacity-60 italic">{props.source || name || 'Markdown content'}</div>
      </div>
    );
  }

  // Image
  if (type.includes('display.image')) {
    return (
      <div className="flex items-center justify-center border border-dashed border-gray-300 rounded p-4" style={{ ...style }} title={tip}>
        <div className="text-center text-xs opacity-40">
          <Layout size={20} className="mx-auto mb-1" />
          {name || 'Image'}
        </div>
      </div>
    );
  }

  // Icon
  if (type.includes('display.icon')) {
    return (
      <div className="inline-flex items-center justify-center p-1" style={{ ...style }} title={tip}>
        <div className="w-6 h-6 rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-[10px]">
          ★
        </div>
      </div>
    );
  }

  // Generic fallback container
  return (
    <div style={{ ...style, minHeight: children.length ? undefined : 30 }} title={tip}>
      {children.map((child, i) => <PreviewNode key={i} node={child} />)}
      {children.length === 0 && <PreviewEmpty name={name} type={type} />}
    </div>
  );
}

function PreviewEmpty({ name, type }) {
  return (
    <div className="flex items-center justify-center p-2 border border-dashed border-gray-300 dark:border-gray-600 rounded text-[10px] opacity-40" style={{ minHeight: 30 }}>
      {name || type?.split('.').pop() || 'empty'}
    </div>
  );
}

function normalizePreviewStyle(style) {
  const out = {};
  for (const [k, v] of Object.entries(style)) {
    out[k] = v;
  }
  return out;
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

// ─── Templates ───────────────────────────────────────────

const TEMPLATES = [
  { id: 'blank', label: 'Blank', icon: Layout, desc: 'Empty flex container' },
  { id: 'kpi', label: 'KPI Dashboard', icon: BarChart3, desc: '4 KPI cards + trend chart' },
  { id: 'detail', label: 'Asset Detail', icon: Eye, desc: 'Properties panel + chart' },
  { id: 'alarm', label: 'Alarm View', icon: Bell, desc: 'Alarm status table' },
  { id: 'navigation', label: 'Navigation', icon: Navigation, desc: 'Sidebar navigation menu' },
];

// ─── AI View Generator ───────────────────────────────────

const AI_PRESETS = [
  {
    id: 'motor-dashboard',
    label: 'Motor Dashboard',
    icon: BarChart3,
    desc: 'Speed, load, temp KPIs with trend chart and alarm status',
    prompt: 'Create a motor monitoring dashboard with KPI cards showing Speed (RPM), Load (%), Temperature (°F), and a Running status indicator. Add an Easy Chart for historical trending and an alarm status table at the bottom. Use a column layout with a header label.',
    suggestedName: 'Dashboards/MotorDashboard',
    suggestedTags: ['[default]DemoPlant/MotorM12/Speed', '[default]DemoPlant/MotorM12/LoadPercent', '[default]DemoPlant/MotorM12/Temperature', '[default]DemoPlant/MotorM12/Running'],
  },
  {
    id: 'plant-overview',
    label: 'Plant Overview',
    icon: Layout,
    desc: 'High-level plant status with KPIs and navigation links',
    prompt: 'Create a plant overview page with a header showing the plant name "DemoPlant", 6 KPI cards in a 3x2 grid showing OEE, Production Rate, Throughput, Downtime, Quality, and Energy Usage. Add navigation links to Dashboards/MotorDashboard and Alarms at the bottom.',
    suggestedName: 'Overview/PlantOverview',
    suggestedTags: [],
  },
  {
    id: 'alarm-display',
    label: 'Alarm Management',
    icon: Bell,
    desc: 'Active alarms table with filters and summary KPIs',
    prompt: 'Create an alarm management view with a summary row showing 4 KPI cards for Critical, High, Medium, Low alarm counts. Below that, add an alarm status table and an alarm journal table. Use red/orange/yellow/blue color coding.',
    suggestedName: 'Alarms/AlarmDashboard',
    suggestedTags: [],
  },
  {
    id: 'asset-detail',
    label: 'Asset Detail Page',
    icon: Eye,
    desc: 'Detailed asset view with properties, chart, and controls',
    prompt: 'Create an asset detail page with a header showing the asset name as a parameter. Left side has a property panel showing Status, Speed, Temperature, Load, and Run Hours as labels. Right side has a large Easy Chart for trending. Bottom has Start/Stop buttons and a navigation link back to the overview.',
    suggestedName: 'Assets/AssetDetail',
    suggestedTags: ['[default]DemoPlant/MotorM12/Speed', '[default]DemoPlant/MotorM12/Running'],
  },
  {
    id: 'nav-menu',
    label: 'Navigation Sidebar',
    icon: Navigation,
    desc: 'Sidebar navigation with grouped menu links',
    prompt: 'Create a vertical navigation sidebar with a dark background (#1e293b). Include a logo area at top, then grouped links: Overview (Plant Overview, Production), Assets (Motor M12, Pump P5, Conveyor C1), Monitoring (Alarms, Trends, Reports). Each link should use ia.navigation.link.',
    suggestedName: 'Navigation/Sidebar',
    suggestedTags: [],
  },
];

function AIViewGenerator({ project, onCreated, onClose }) {
  const [prompt, setPrompt] = useState('');
  const [viewName, setViewName] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [showTagBrowser, setShowTagBrowser] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activePreset, setActivePreset] = useState(null);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [chatConfig, setChatConfig] = useState(null);
  const notifications = useNotifications();

  // Load available tags
  useEffect(() => {
    fetch('/api/ignition/browse?path=[default]&recursive=true')
      .then(r => r.ok ? r.json() : { tags: [] })
      .then(d => {
        const tags = (d.results || d.tags || []);
        const flat = flattenTags(tags);
        setAvailableTags(flat);
      })
      .catch(() => {});
  }, []);

  // Load available models & current config
  useEffect(() => {
    fetch('/api/chat/models').then(r => r.json())
      .then(d => setAvailableModels(d.models || []))
      .catch(() => {});
    fetch('/api/chat/config').then(r => r.json())
      .then(cfg => {
        setChatConfig(cfg);
        setSelectedModel(cfg.defaultModel || '');
      })
      .catch(() => {});
  }, []);

  function flattenTags(tags) {
    const out = [];
    for (const t of tags) {
      if (t.tagType === 'AtomicTag' || (t.dataType && t.tagType !== 'Folder' && t.tagType !== 'Provider')) {
        out.push({ path: t.fullPath || t.path, name: t.name, dataType: t.dataType || 'Unknown', engUnit: t.engUnit || '' });
      }
      if (t.tags?.length) out.push(...flattenTags(t.tags));
    }
    return out;
  }

  const addTag = (tagPath) => {
    if (!selectedTags.includes(tagPath)) setSelectedTags(prev => [...prev, tagPath]);
  };

  const removeTag = (tagPath) => {
    setSelectedTags(prev => prev.filter(t => t !== tagPath));
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.id);
    setPrompt(preset.prompt);
    setViewName(preset.suggestedName);
    setSelectedTags(preset.suggestedTags || []);
    setResult(null);
    setError(null);
  };

  const buildFullPrompt = () => {
    let full = prompt;
    if (selectedTags.length > 0) {
      full += `\n\nBind the following Ignition tags to the relevant components:\n`;
      selectedTags.forEach(t => { full += `- ${t}\n`; });
      full += `\nFor tag bindings, set the component prop value to an object like: { "binding": { "type": "tag", "config": { "path": "${selectedTags[0]}" } } } for the appropriate properties (text, value, etc). This is how Ignition Perspective binds tag values to component properties.`;
    }
    return full;
  };

  const generate = async () => {
    if (!prompt.trim() || !viewName.trim()) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const data = await fetchJson(`${API}/${encodeURIComponent(project)}/generate-view`, {
        method: 'POST',
        body: JSON.stringify({
          name: viewName.trim(),
          prompt: buildFullPrompt(),
          tags: selectedTags,
          model: selectedModel || undefined,
        }),
      });
      setResult(data);
      if (data.success) {
        notifications.success(`View "${viewName}" generated with ${data.componentCount} components`);
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const filteredTags = tagInput
    ? availableTags.filter(t => t.path.toLowerCase().includes(tagInput.toLowerCase()) || t.name.toLowerCase().includes(tagInput.toLowerCase()))
    : availableTags;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="t-surface rounded-xl t-shadow-lg border t-border-s max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b t-border-s shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg t-accent-bg flex items-center justify-center">
              <Wand2 size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold t-text">AI View Generator</h3>
              <p className="text-xs t-text-m">Describe your UI and AI will create a Perspective view</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 t-text-m hover:t-text-2 hover:t-surface-h rounded-lg cursor-pointer"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-0">
            {/* Left side — form */}
            <div className="flex-1 p-5 space-y-4 border-r t-border-s overflow-y-auto">
              {/* Preset scenarios */}
              <div>
                <label className="block text-xs font-semibold t-text-2 uppercase mb-2">Quick Start Presets</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AI_PRESETS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => applyPreset(p)}
                      className={`flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        activePreset === p.id
                          ? 't-accent-border t-accent-soft ring-1 ring-[var(--color-accent)]'
                          : 't-border-s hover:t-border hover:t-surface-h'
                      }`}
                    >
                      <p.icon size={14} className={`shrink-0 mt-0.5 ${activePreset === p.id ? 't-accent' : 't-text-m'}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-medium t-text truncate">{p.label}</div>
                        <div className="text-[10px] t-text-m leading-tight">{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Model selector */}
              <div>
                <label className="block text-xs font-semibold t-text-2 uppercase mb-1.5">AI Model</label>
                <div className="flex gap-2">
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    className="flex-1 border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    {chatConfig?.llmProvider && chatConfig.llmProvider !== 'ollama' && (
                      <option value="">
                        {chatConfig.llmProvider === 'openai' ? `OpenAI: ${chatConfig.openaiModel || 'gpt-4o'}` :
                         chatConfig.llmProvider === 'copilot' ? `Copilot: ${chatConfig.copilotModel || 'gpt-4o'}` :
                         chatConfig.llmProvider === 'custom' ? `Custom: ${chatConfig.customModel || 'default'}` : 'Default'}
                      </option>
                    )}
                    {availableModels.filter(m => !m.name.includes('embed')).map(m => (
                      <option key={m.name} value={m.name}>
                        {m.name} {m.size > 1000 ? `(${(m.size / 1e9).toFixed(1)}GB)` : m.family ? `(${m.family})` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => fetch('/api/chat/models').then(r => r.json()).then(d => setAvailableModels(d.models || []))}
                    className="px-2 py-2 border t-border rounded-lg t-text-m hover:t-text-2 hover:t-surface-h transition-colors cursor-pointer"
                    title="Refresh models"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
                {selectedModel && availableModels.find(m => m.name === selectedModel)?.size > 1000 && (
                  <div className="text-[10px] t-text-m mt-1">
                    Local model — {(availableModels.find(m => m.name === selectedModel).size / 1e9).toFixed(1)}GB
                  </div>
                )}
              </div>

              {/* View name */}
              <div>
                <label className="block text-xs font-semibold t-text-2 uppercase mb-1.5">View Path / Name</label>
                <input
                  value={viewName}
                  onChange={e => setViewName(e.target.value)}
                  placeholder="e.g. Pages/MotorDashboard"
                  className="w-full border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                />
              </div>

              {/* Prompt */}
              <div>
                <label className="block text-xs font-semibold t-text-2 uppercase mb-1.5">Describe Your View</label>
                <textarea
                  value={prompt}
                  onChange={e => { setPrompt(e.target.value); setActivePreset(null); }}
                  placeholder="Create a motor monitoring dashboard with temperature KPI, speed gauge, vibration chart, and alarm status..."
                  rows={5}
                  className="w-full border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
                />
              </div>

              {/* Selected tags */}
              {selectedTags.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold t-text-2 uppercase mb-1.5">Tag Bindings ({selectedTags.length})</label>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono t-accent-soft t-accent rounded-md">
                        {t.split('/').pop()}
                        <button onClick={() => removeTag(t)} className="hover:t-err cursor-pointer"><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2 p-3 t-err-soft border t-err-border rounded-lg text-sm t-err">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Result */}
              {result?.success && (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-3 t-ok-soft border t-ok-border rounded-lg text-sm t-ok">
                    <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">View created: {result.name}</div>
                      <div className="text-xs mt-1">
                        {result.validation?.hasRoot && '✓ Valid root'} | {result.componentCount} components | {result.tagBindings > 0 ? `🔗 ${result.tagBindings} tag bindings` : '○ No tag bindings'}
                        {result.model && <span> | Model: {result.model}</span>}
                      </div>
                      {result.savedToDisk === false && (
                        <div className="text-xs mt-1 text-amber-600">⚠ View not saved to Ignition directory (permissions). JSON available in response.</div>
                      )}
                    </div>
                  </div>
                  {result.view && (
                    <div className="border t-border-s rounded-lg overflow-hidden">
                      <div className="px-3 py-1.5 border-b t-border-s t-bg-alt text-xs font-medium t-text-m flex items-center gap-1.5">
                        <Eye size={12} /> Generated View Preview
                      </div>
                      <div className="max-h-64 overflow-auto">
                        <ViewPreview viewContent={result.view} />
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => { onCreated?.(); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium t-accent t-accent-soft rounded-lg cursor-pointer"
                  >
                    <Eye size={14} /> Open in Project Manager
                  </button>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={generate}
                disabled={!prompt.trim() || !viewName.trim() || generating}
                className="w-full t-accent-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                {generating ? 'AI is generating your view...' : 'Generate View with AI'}
              </button>
            </div>

            {/* Right side — tag browser */}
            <div className="w-72 shrink-0 flex flex-col overflow-hidden">
              <div className="px-3 py-2.5 border-b t-border-s flex items-center gap-2">
                <Database size={13} className="t-accent" />
                <span className="text-xs font-semibold t-text-2 uppercase">Tag Browser</span>
                <span className="text-[10px] t-bg-alt px-1 rounded t-text-m ml-auto">{availableTags.length}</span>
              </div>
              <div className="px-2 py-2 border-b t-border-s">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 t-text-m" />
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    placeholder="Filter tags..."
                    className="w-full pl-7 pr-2 py-1.5 text-xs border t-border rounded-md t-field-bg t-field-fg focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {filteredTags.length === 0 && (
                  <div className="text-xs t-text-m text-center py-4">
                    {availableTags.length === 0 ? 'No tags available — connect to Ignition or use mock data' : 'No matching tags'}
                  </div>
                )}
                {filteredTags.slice(0, 100).map(tag => {
                  const isSelected = selectedTags.includes(tag.path);
                  return (
                    <button
                      key={tag.path}
                      onClick={() => isSelected ? removeTag(tag.path) : addTag(tag.path)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors cursor-pointer ${
                        isSelected ? 't-accent-soft t-accent' : 't-text-2 hover:t-surface-h'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                        isSelected ? 't-accent-bg border-transparent' : 't-border'
                      }`}>
                        {isSelected && <Check size={8} className="text-white" />}
                      </span>
                      <span className="font-mono truncate">{tag.name}</span>
                      <span className="text-[9px] t-text-m ml-auto shrink-0">{tag.dataType}</span>
                      {tag.engUnit && <span className="text-[9px] t-info shrink-0">{tag.engUnit}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Simple Input Modal ──────────────────────────────────

function SimpleInputModal({ title, label, placeholder, value, onChange, onSubmit, onClose, submitLabel, submitIcon: Icon }) {
  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="t-surface rounded-xl t-shadow-lg border t-border-s max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold t-text">{title}</h3>
          <button onClick={onClose} className="t-text-m hover:t-text-2 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium t-text-2 mb-1">{label}</label>
            <input
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              autoFocus
            />
          </div>
          <button
            onClick={onSubmit}
            disabled={!value?.trim()}
            className="w-full t-accent-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            {Icon && <Icon size={14} />} {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import View Modal ───────────────────────────────────

function ImportViewModal({ onImport, onClose }) {
  const [viewName, setViewName] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState(null);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setJsonText(text);
      try {
        JSON.parse(text);
        setParseError(null);
        if (!viewName) {
          const name = file.name.replace('.json', '').replace(/_/g, '/');
          setViewName(name);
        }
      } catch (err) {
        setParseError(err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    try {
      const parsed = JSON.parse(jsonText);
      onImport(viewName, parsed);
    } catch (err) {
      setParseError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="t-surface rounded-xl t-shadow-lg border t-border-s max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold t-text">Import View</h3>
          <button onClick={onClose} className="t-text-m hover:t-text-2 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium t-text-2 mb-1">View Path / Name</label>
            <input
              value={viewName}
              onChange={e => setViewName(e.target.value)}
              placeholder="e.g. Pages/ImportedView"
              className="w-full border t-border rounded-lg px-3 py-2 text-sm t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium t-text-2 mb-1">Upload JSON file or paste JSON</label>
            <input type="file" accept=".json" onChange={handleFileUpload} className="text-sm t-text-m mb-2" />
            <textarea
              value={jsonText}
              onChange={e => {
                setJsonText(e.target.value);
                try { JSON.parse(e.target.value); setParseError(null); } catch (err) { setParseError(err.message); }
              }}
              placeholder='{"root": { "type": "ia.container.flex", ... }}'
              rows={6}
              className="w-full border t-border rounded-lg px-3 py-2 text-xs font-mono t-field-bg t-field-fg t-field-border focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] resize-none"
            />
          </div>
          {parseError && (
            <div className="flex items-start gap-2 p-2 t-err-soft border t-err-border rounded-lg text-xs t-err">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /><span>{parseError}</span>
            </div>
          )}
          <button
            onClick={handleSubmit}
            disabled={!viewName.trim() || !jsonText.trim() || !!parseError}
            className="w-full t-accent-bg text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload size={14} /> Import View
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState('tree');
  // 'tree' | 'editor' | 'preview'
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateView, setShowCreateView] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showDuplicateView, setShowDuplicateView] = useState(false);
  const [showRenameView, setShowRenameView] = useState(false);
  const [showImportView, setShowImportView] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewTemplate, setNewViewTemplate] = useState('blank');
  const [loading, setLoading] = useState(true);
  const [resourceTab, setResourceTab] = useState('views');
  const [configForm, setConfigForm] = useState({ ignitionDir: '', gatewayUrl: '' });
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodePath, setSelectedNodePath] = useState(null);
  const notifications = useNotifications();
  const editorRef = useRef(null);

  useEffect(() => { loadConfig(); }, []);

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
    setSelectedNode(null);
    setSelectedNodePath(null);
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
    setSelectedNode(null);
    setSelectedNodePath(null);
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
    if (!window.confirm(`Delete view "${selectedView}"? This cannot be undone.`)) return;
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
      const parsed = JSON.parse(text);
      setEditorError(null);
      setViewContent(parsed);
    } catch (err) {
      setEditorError(err.message);
    }
  };

  const handleSelectNode = useCallback((node, path) => {
    setSelectedNode(node);
    setSelectedNodePath(path);
  }, []);

  const duplicateView = useCallback(async () => {
    if (!selectedView || !selectedProject || !newViewName.trim()) return;
    try {
      await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/duplicate-view`, {
        method: 'POST',
        body: JSON.stringify({ sourcePath: selectedView, newName: newViewName.trim() }),
      });
      notifications.success(`View duplicated as "${newViewName}"`);
      setShowDuplicateView(false);
      setNewViewName('');
      await selectProject(selectedProject);
    } catch (err) {
      notifications.error(`Duplicate failed: ${err.message}`);
    }
  }, [selectedView, selectedProject, newViewName, selectProject]);

  const renameView = useCallback(async () => {
    if (!selectedView || !selectedProject || !newViewName.trim()) return;
    try {
      const data = await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/rename-view`, {
        method: 'POST',
        body: JSON.stringify({ sourcePath: selectedView, newName: newViewName.trim() }),
      });
      notifications.success(`View renamed to "${data.name}"`);
      setShowRenameView(false);
      setSelectedView(data.name);
      setNewViewName('');
      await selectProject(selectedProject);
    } catch (err) {
      notifications.error(`Rename failed: ${err.message}`);
    }
  }, [selectedView, selectedProject, newViewName, selectProject]);

  const exportView = useCallback(async () => {
    if (!selectedView || !selectedProject) return;
    try {
      const res = await fetch(`${API}/${encodeURIComponent(selectedProject)}/export-view?path=${encodeURIComponent(selectedView)}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedView.replace(/\//g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notifications.success('View exported');
    } catch (err) {
      notifications.error(`Export failed: ${err.message}`);
    }
  }, [selectedView, selectedProject]);

  const importView = useCallback(async (name, viewJson) => {
    if (!selectedProject || !name?.trim()) return;
    try {
      await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/import-view`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), view: viewJson }),
      });
      notifications.success(`View "${name}" imported`);
      setShowImportView(false);
      await selectProject(selectedProject);
    } catch (err) {
      notifications.error(`Import failed: ${err.message}`);
    }
  }, [selectedProject, selectProject]);

  const requestScan = useCallback(async () => {
    if (!selectedProject) return;
    try {
      const data = await fetchJson(`${API}/${encodeURIComponent(selectedProject)}/scan`, { method: 'POST' });
      notifications.success(data.message || 'Scan requested');
    } catch (err) {
      notifications.error(`Scan failed: ${err.message}`);
    }
  }, [selectedProject]);

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
            <div className="p-2 border-t t-border-s space-y-1.5">
              <button
                onClick={() => setShowAIGenerator(true)}
                disabled={!selectedProject}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white t-accent-bg hover:opacity-90 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
              >
                <Wand2 size={14} /> AI Generate View
              </button>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setShowCreateView(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium t-accent t-accent-soft hover:opacity-90 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus size={14} /> New View
                </button>
                <button
                  onClick={() => setShowImportView(true)}
                  className="flex items-center justify-center gap-1 px-2.5 py-2 text-sm font-medium t-text-2 t-bg-alt hover:opacity-90 rounded-lg transition-colors cursor-pointer"
                  title="Import view from JSON"
                >
                  <Upload size={14} />
                </button>
              </div>
              <button
                onClick={requestScan}
                disabled={!selectedProject}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium t-text-m t-bg-alt rounded-lg hover:opacity-90 transition-colors disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw size={12} /> Request Gateway Scan
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
                    { id: 'preview', label: 'Preview', icon: Monitor },
                    { id: 'live', label: 'Live', icon: Globe },
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
                  onClick={exportView}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium t-text-2 t-bg-alt rounded-lg hover:opacity-90 transition-colors cursor-pointer"
                  title="Export view JSON"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => { setNewViewName(selectedView + '_copy'); setShowDuplicateView(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium t-text-2 t-bg-alt rounded-lg hover:opacity-90 transition-colors cursor-pointer"
                  title="Duplicate view"
                >
                  <Copy size={12} />
                </button>
                <button
                  onClick={() => { setNewViewName(selectedView); setShowRenameView(true); }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium t-text-2 t-bg-alt rounded-lg hover:opacity-90 transition-colors cursor-pointer"
                  title="Rename / move view"
                >
                  <Edit3 size={12} />
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
                  <div className="h-full flex min-h-0">
                    {/* Component tree */}
                    <div className="flex-1 overflow-y-auto p-4">
                      <div className="max-w-3xl">
                        {/* View params */}
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

                        {/* Page Config */}
                        {viewContent.custom?.pageConfig && (
                          <div className="mb-4 p-3 t-bg-alt rounded-lg border t-border-s">
                            <h4 className="text-xs font-semibold t-text-m uppercase mb-2">Page Configuration</h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(viewContent.custom.pageConfig).map(([key, val]) => (
                                <div key={key} className="flex items-center gap-2">
                                  <span className="font-mono font-medium t-text">{key}</span>
                                  <span className="t-text-2 font-mono">{JSON.stringify(val)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tree */}
                        <div className="t-surface rounded-lg border t-border-s">
                          <div className="px-3 py-2 border-b t-border-s flex items-center gap-2">
                            <Layers size={14} className="t-accent" />
                            <span className="text-xs font-semibold t-text-2">Component Tree</span>
                          </div>
                          <div className="p-1">
                            <ComponentTree node={viewContent.root} onSelectNode={handleSelectNode} selectedNodePath={selectedNodePath} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Node properties sidebar */}
                    <div className="w-64 border-l t-border-s t-surface overflow-y-auto shrink-0">
                      <div className="px-3 py-2 border-b t-border-s flex items-center gap-2">
                        <Settings2 size={12} className="t-accent" />
                        <span className="text-xs font-semibold t-text-2">Properties</span>
                      </div>
                      <NodeProperties node={selectedNode} />
                    </div>
                  </div>
                )}

                {activeTab === 'preview' && (
                  <ViewPreview viewContent={viewContent} />
                )}

                {activeTab === 'live' && (
                  <div className="h-full flex flex-col">
                    {perspectiveUrl ? (
                      <>
                        <div className="px-4 py-2 t-bg-alt border-b t-border-s flex items-center gap-2 text-xs shrink-0">
                          <Globe size={12} className="t-accent" />
                          <span className="t-text-m">Live Perspective View</span>
                          <div className="flex-1" />
                          <button
                            onClick={requestScan}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium t-accent t-accent-soft rounded transition-colors cursor-pointer"
                          >
                            <RefreshCw size={10} /> Request Scan
                          </button>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-8">
                          <div className="text-center max-w-lg space-y-4">
                            <Globe size={48} className="mx-auto t-accent" />
                            <h3 className="text-lg font-semibold t-text">Open in Ignition Gateway</h3>
                            <p className="text-sm t-text-m">
                              Perspective views are rendered by the Ignition Gateway. Click below to see this view live.
                            </p>
                            <div className="p-3 t-bg-alt rounded-lg border t-border-s">
                              <code className="text-xs t-accent font-mono break-all">{perspectiveUrl}/{selectedView}</code>
                            </div>
                            <div className="flex gap-3 justify-center">
                              <a
                                href={`${perspectiveUrl}/${selectedView}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white t-accent-bg rounded-lg hover:opacity-90 cursor-pointer"
                              >
                                <ExternalLink size={14} /> Open in New Tab
                              </a>
                              <a
                                href={perspectiveUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium t-accent t-accent-soft rounded-lg hover:opacity-90 cursor-pointer"
                              >
                                <Globe size={14} /> Open Project Root
                              </a>
                            </div>
                            <div className="text-xs t-text-m space-y-1">
                              <p>After creating or editing a view, click <strong>Request Scan</strong> to notify the Gateway.</p>
                              <p>Changes typically appear within 2-5 seconds.</p>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center t-text-m">
                        <div className="text-center">
                          <Globe size={40} className="mx-auto mb-3 t-text-m" />
                          <p className="text-sm">Configure Gateway URL in Settings to enable live preview</p>
                        </div>
                      </div>
                    )}
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

      {/* AI View Generator Modal */}
      {showAIGenerator && selectedProject && (
        <AIViewGenerator
          project={selectedProject}
          onCreated={() => { selectProject(selectedProject); setShowAIGenerator(false); }}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {/* Duplicate View Modal */}
      {showDuplicateView && (
        <SimpleInputModal
          title="Duplicate View"
          label="New View Path / Name"
          placeholder="e.g. Pages/DashboardCopy"
          value={newViewName}
          onChange={setNewViewName}
          onSubmit={duplicateView}
          onClose={() => { setShowDuplicateView(false); setNewViewName(''); }}
          submitLabel="Duplicate"
          submitIcon={Copy}
        />
      )}

      {/* Rename View Modal */}
      {showRenameView && (
        <SimpleInputModal
          title="Rename / Move View"
          label="New View Path / Name"
          placeholder="e.g. Pages/NewName"
          value={newViewName}
          onChange={setNewViewName}
          onSubmit={renameView}
          onClose={() => { setShowRenameView(false); setNewViewName(''); }}
          submitLabel="Rename"
          submitIcon={Edit3}
        />
      )}

      {/* Import View Modal */}
      {showImportView && (
        <ImportViewModal
          onImport={importView}
          onClose={() => setShowImportView(false)}
        />
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
