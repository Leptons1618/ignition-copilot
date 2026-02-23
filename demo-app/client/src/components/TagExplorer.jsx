import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, Binary, Hash, Type, Calendar,
  Search, Plus, X, FilePlus2, Layers, RefreshCw, Check, Loader2, PencilLine,
  Tag as TagIcon,
} from 'lucide-react';
import { browseTags, readTags, searchTags, writeTags } from '../api.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import Modal from './ui/Modal.jsx';
import { Textarea } from './ui/Input.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

function isTagFolder(tag) {
  return tag.hasChildren || tag.tagType === 'Folder' || tag.tagType === 'UdtInstance' || tag.tagType === 'Provider';
}

function isBooleanTag(tag) {
  return String(tag.dataType || '').toLowerCase().includes('bool');
}

function tagIcon(tag, size = 15) {
  const dt = String(tag.dataType || '').toLowerCase();
  if (dt.includes('bool')) return <Binary size={size} />;
  if (dt.includes('int') || dt.includes('float') || dt.includes('double')) return <Hash size={size} />;
  if (dt.includes('string')) return <Type size={size} />;
  if (dt.includes('date')) return <Calendar size={size} />;
  return <FilePlus2 size={size} />;
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0
        ${checked ? 'bg-[var(--color-success)]' : 'bg-[var(--color-surface)]'} ${disabled ? 'opacity-50' : ''}`}
    >
      <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-sm
        ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  );
}

function InlineEditor({ value, onSave, onCancel, status }) {
  const [val, setVal] = useState(value);
  const ref = useRef(null);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  return (
    <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <input
        ref={ref}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave(val);
          if (e.key === 'Escape') onCancel();
        }}
        className="w-24 text-xs px-1.5 py-0.5 rounded border t-field-bg t-field-fg t-field-border focus:outline-none focus:t-accent-border"
        disabled={status === 'writing'}
      />
      {status === 'writing' ? (
        <Loader2 size={12} className="animate-spin t-accent" />
      ) : status === 'success' ? (
        <Check size={12} className="t-ok" />
      ) : (
        <>
          <button onClick={() => onSave(val)} className="t-ok hover:opacity-80 cursor-pointer"><Check size={12} /></button>
          <button onClick={onCancel} className="t-err hover:opacity-80 cursor-pointer"><X size={12} /></button>
        </>
      )}
    </div>
  );
}

function TagTreeNode({
  tag, parentPath, depth,
  expandedPaths, childrenMap, loadingPaths,
  tagValues, workspaceTags,
  editingTag, writeStatus,
  onToggleExpand, onAddWorkspaceTags,
  onStartEdit, onDoWrite, onCancelEdit, onToggleBoolean,
}) {
  const isFolder = isTagFolder(tag);
  const fullPath = parentPath === '[default]' ? `[default]/${tag.name}` : `${parentPath}/${tag.name}`;
  const isExpanded = expandedPaths.has(fullPath);
  const isLoading = loadingPaths.has(fullPath);
  const children = childrenMap[fullPath] || [];
  const value = tagValues[fullPath];
  const inWorkspace = workspaceTags.includes(fullPath);
  const isEditing = editingTag === fullPath;
  const isBool = isBooleanTag(tag);

  const childFolders = children.filter(isTagFolder);
  const childLeafs = children.filter(c => !isTagFolder(c));
  const sortedChildren = [...childFolders, ...childLeafs];

  return (
    <div>
      <div
        className={`group flex items-center gap-1.5 px-2 py-1.5 text-sm cursor-pointer transition-colors rounded-sm
          ${inWorkspace ? 'bg-[var(--color-success-subtle)]' : 'hover:bg-[var(--color-surface-hover)]'}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => isFolder ? onToggleExpand(fullPath) : null}
      >
        {isFolder ? (
          <span className="w-4 h-4 flex items-center justify-center shrink-0">
            {isLoading ? (
              <Loader2 size={12} className="animate-spin t-text-m" />
            ) : isExpanded ? (
              <ChevronDown size={14} className="t-text-m" />
            ) : (
              <ChevronRight size={14} className="t-text-m" />
            )}
          </span>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        <span className={isFolder ? 't-accent' : 't-text-m'}>
          {isFolder ? (isExpanded ? <FolderOpen size={15} /> : <Folder size={15} />) : tagIcon(tag)}
        </span>

        <span className={`flex-1 min-w-0 truncate text-xs font-mono ${isFolder ? 'font-semibold t-text' : 't-text-2'}`}>
          {tag.name}
        </span>

        {isFolder && tag.tagType && tag.tagType !== 'Folder' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded t-bg-alt t-text-m border t-border-s">{tag.tagType}</span>
        )}
        {isFolder && children.length > 0 && (
          <span className="text-[10px] t-text-m">({children.length})</span>
        )}

        {!isFolder && tag.dataType && (
          <span className="text-[10px] t-text-m shrink-0">{tag.dataType}</span>
        )}

        {!isFolder && value && !isEditing && (
          isBool ? (
            <ToggleSwitch
              checked={Boolean(value.value)}
              onChange={() => onToggleBoolean(fullPath, value.value)}
            />
          ) : (
            <span
              className="text-xs px-1.5 py-0.5 rounded t-bg-alt font-mono t-text cursor-text shrink-0 max-w-[120px] truncate hover:t-accent-border hover:border border border-transparent transition-colors"
              onClick={(e) => { e.stopPropagation(); onStartEdit(fullPath, value.value); }}
              title="Click to edit"
            >
              {typeof value.value === 'number' ? value.value.toFixed(2) : String(value.value).slice(0, 20)}
            </span>
          )
        )}

        {isEditing && (
          <InlineEditor
            value={String(value?.value ?? '')}
            onSave={(v) => onDoWrite(fullPath, v)}
            onCancel={onCancelEdit}
            status={writeStatus}
          />
        )}

        {!isFolder && value && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${value.quality === 'Good' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]'}`} title={value.quality} />
        )}

        {!isFolder && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddWorkspaceTags?.([fullPath]); }}
              className="p-0.5 t-text-m hover:t-accent cursor-pointer"
              title="Add to workspace"
            >
              <Plus size={13} />
            </button>
            {!isBool && !isEditing && (
              <button
                onClick={(e) => { e.stopPropagation(); onStartEdit(fullPath, value?.value); }}
                className="p-0.5 t-text-m hover:t-warn cursor-pointer"
                title="Edit value"
              >
                <PencilLine size={13} />
              </button>
            )}
          </div>
        )}
      </div>

      {isFolder && isExpanded && (
        <div>
          {sortedChildren.map((child, i) => (
            <TagTreeNode
              key={`${child.name}-${i}`}
              tag={child}
              parentPath={fullPath}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              childrenMap={childrenMap}
              loadingPaths={loadingPaths}
              tagValues={tagValues}
              workspaceTags={workspaceTags}
              editingTag={editingTag}
              writeStatus={writeStatus}
              onToggleExpand={onToggleExpand}
              onAddWorkspaceTags={onAddWorkspaceTags}
              onStartEdit={onStartEdit}
              onDoWrite={onDoWrite}
              onCancelEdit={onCancelEdit}
              onToggleBoolean={onToggleBoolean}
            />
          ))}
          {children.length === 0 && !isLoading && (
            <div style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }} className="text-xs t-text-m py-1 italic">
              Empty folder
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TagExplorer({ workspaceTags = [], onAddWorkspaceTags }) {
  const [rootTags, setRootTags] = useState([]);
  const [expandedPaths, setExpandedPaths] = useState(new Set());
  const [childrenMap, setChildrenMap] = useState({});
  const [loadingPaths, setLoadingPaths] = useState(new Set());
  const [tagValues, setTagValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [editingTag, setEditingTag] = useState(null);
  const [writeStatus, setWriteStatus] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    browseTags('[default]').then(result => {
      if (result.success !== false) setRootTags(result.tags || []);
      else setError(result.error || 'Failed to load tags');
    }).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback((fullPath) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(fullPath)) {
        next.delete(fullPath);
        return next;
      }
      next.add(fullPath);
      if (!childrenMap[fullPath]) {
        setLoadingPaths(lp => new Set([...lp, fullPath]));
        browseTags(fullPath).then(result => {
          if (result.success !== false) {
            setChildrenMap(cm => ({ ...cm, [fullPath]: result.tags || [] }));
          }
          setLoadingPaths(lp => { const n = new Set(lp); n.delete(fullPath); return n; });
        });
      }
      return next;
    });
  }, [childrenMap]);

  const visibleLeafPaths = useMemo(() => {
    const paths = [];
    const collect = (tags, parentPath) => {
      for (const tag of tags) {
        const fp = parentPath === '[default]' ? `[default]/${tag.name}` : `${parentPath}/${tag.name}`;
        if (!isTagFolder(tag)) {
          paths.push(fp);
        } else if (expandedPaths.has(fp) && childrenMap[fp]) {
          collect(childrenMap[fp], fp);
        }
      }
    };
    collect(rootTags, '[default]');
    return paths;
  }, [rootTags, expandedPaths, childrenMap]);

  useEffect(() => {
    if (visibleLeafPaths.length === 0) return;
    const poll = async () => {
      try {
        const result = await readTags(visibleLeafPaths);
        if (result.success !== false && result.results) {
          const vals = {};
          result.results.forEach(v => { vals[v.path] = v; });
          setTagValues(prev => ({ ...prev, ...vals }));
        }
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 3000);
    return () => clearInterval(iv);
  }, [visibleLeafPaths.join(',')]);

  const startEdit = (fullPath) => {
    setEditingTag(fullPath);
    setWriteStatus(null);
  };

  const doWrite = async (fullPath, value) => {
    setWriteStatus('writing');
    try {
      const result = await writeTags([{ path: fullPath, value }]);
      if (result.success) {
        setWriteStatus('success');
        const readResult = await readTags([fullPath]);
        if (readResult.success !== false && readResult.results) {
          const vals = {};
          readResult.results.forEach(v => { vals[v.path] = v; });
          setTagValues(prev => ({ ...prev, ...vals }));
        }
        setTimeout(() => { setEditingTag(null); setWriteStatus(null); }, 800);
      } else {
        setWriteStatus('error');
      }
    } catch {
      setWriteStatus('error');
    }
  };

  const toggleBoolean = async (fullPath, currentValue) => {
    try {
      await writeTags([{ path: fullPath, value: !currentValue }]);
      const readResult = await readTags([fullPath]);
      if (readResult.success !== false && readResult.results) {
        const vals = {};
        readResult.results.forEach(v => { vals[v.path] = v; });
        setTagValues(prev => ({ ...prev, ...vals }));
      }
    } catch {}
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await searchTags(searchQuery.trim());
      setSearchResults(result.success !== false ? (result.matches || []) : []);
      if (result.success === false) setError(result.error || 'Search failed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addBatchToWorkspace = () => {
    const paths = batchInput.split(/\r?\n|,/).map(v => v.trim()).filter(Boolean);
    if (paths.length > 0) onAddWorkspaceTags?.(paths);
    setBatchInput('');
    setShowBatchModal(false);
  };

  const sortedRootTags = useMemo(() => {
    const folders = rootTags.filter(isTagFolder);
    const leafs = rootTags.filter(t => !isTagFolder(t));
    return [...folders, ...leafs];
  }, [rootTags]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden t-bg gap-3">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-2.5 t-text-m" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search tags by name or pattern"
            className="w-full t-field-bg border t-field-border rounded-lg pl-9 pr-3 py-2 t-field-fg text-sm focus:outline-none focus:t-accent-border focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <Button variant="primary" size="sm" onClick={doSearch}>
          <Search size={14} /> Search
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowBatchModal(true)}>
          <Layers size={14} /> Batch Add
        </Button>
      </div>

      {error && <div className="px-3 py-2 t-err-soft border t-err-border rounded t-err text-sm">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <div className="lg:col-span-2 border t-border-s rounded-lg t-surface overflow-y-auto">
          {loading && rootTags.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner label="Loading tags..." />
            </div>
          ) : searchResults ? (
            <SearchResults
              results={searchResults}
              onClear={() => setSearchResults(null)}
              onAdd={(p) => onAddWorkspaceTags?.([p])}
            />
          ) : (
            <div className="p-1">
              {sortedRootTags.length === 0 && !loading && (
                <EmptyState icon={FolderOpen} title="No tags found" description="Check your Ignition gateway connection." />
              )}
              {sortedRootTags.map((tag, i) => (
                <TagTreeNode
                  key={`${tag.name}-${i}`}
                  tag={tag}
                  parentPath="[default]"
                  depth={0}
                  expandedPaths={expandedPaths}
                  childrenMap={childrenMap}
                  loadingPaths={loadingPaths}
                  tagValues={tagValues}
                  workspaceTags={workspaceTags}
                  editingTag={editingTag}
                  writeStatus={writeStatus}
                  onToggleExpand={toggleExpand}
                  onAddWorkspaceTags={onAddWorkspaceTags}
                  onStartEdit={startEdit}
                  onDoWrite={doWrite}
                  onCancelEdit={() => { setEditingTag(null); setWriteStatus(null); }}
                  onToggleBoolean={toggleBoolean}
                />
              ))}
            </div>
          )}
        </div>

        <aside className="border t-border-s rounded-lg t-surface p-3 overflow-y-auto space-y-4">
          <div>
            <div className="text-sm font-semibold t-text mb-2 flex items-center gap-1">
              <TagIcon size={14} className="t-accent" />
              Workspace Tags
              <Badge color="neutral">{workspaceTags.length}</Badge>
            </div>
            <div className="max-h-[calc(100%-2rem)] overflow-y-auto space-y-1">
              {workspaceTags.length === 0 && <div className="text-xs t-text-m py-4 text-center">No workspace tags yet. Click + on any tag to add it.</div>}
              {workspaceTags.map(t => {
                const val = tagValues[t];
                return (
                  <div key={t} className="flex items-center gap-1.5 text-xs font-mono t-bg-alt border t-border-s rounded px-2 py-1.5 group" title={t}>
                    <div className="flex-1 min-w-0">
                      <div className="t-text-2 truncate">{t.split('/').pop()}</div>
                      {val && (
                        <div className="text-[10px] t-text-m mt-0.5">
                          <span className="font-mono t-text">{typeof val.value === 'number' ? val.value.toFixed(2) : String(val.value).slice(0, 15)}</span>
                          <span className={`ml-1 ${val.quality === 'Good' ? 't-ok' : 't-warn'}`}>{val.quality}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const remaining = workspaceTags.filter(x => x !== t);
                        onAddWorkspaceTags?.([]); // clear first, then re-add
                      }}
                      className="opacity-0 group-hover:opacity-100 t-text-m hover:t-err cursor-pointer transition-opacity"
                      title="Remove"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          {visibleLeafPaths.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] t-text-m pt-2 border-t t-border-s">
              <RefreshCw size={10} className="animate-spin" style={{ animationDuration: '3s' }} />
              Live polling {visibleLeafPaths.length} tags
            </div>
          )}
        </aside>
      </div>

      {showBatchModal && (
        <Modal title="Batch Add Tags" onClose={() => setShowBatchModal(false)}>
          <p className="text-sm t-text-2 mb-3">Enter tag paths, one per line or comma-separated.</p>
          <Textarea
            rows={8}
            value={batchInput}
            onChange={e => setBatchInput(e.target.value)}
            placeholder={"[default]/DemoPlant/MotorM12/Temperature\n[default]/DemoPlant/MotorM12/Vibration"}
          />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setShowBatchModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={addBatchToWorkspace} disabled={!batchInput.trim()}>
              <Plus size={14} /> Add to Workspace
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SearchResults({ results, onClear, onAdd }) {
  return (
    <div className="p-2 space-y-1">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm t-text-2">
          <Badge color="neutral">{results.length}</Badge> results
        </span>
        <Button variant="ghost" size="xs" onClick={onClear}>Clear</Button>
      </div>
      {results.map((tag, i) => (
        <div key={`${tag.fullPath || tag.name}-${i}`} className="group flex items-center gap-2 px-3 py-2 t-bg-alt rounded border t-border-s text-sm hover:bg-[var(--color-surface-hover)] transition-colors">
          <span className="t-text-m">{tagIcon(tag)}</span>
          <span className="flex-1 t-text font-mono text-xs truncate">{tag.fullPath || tag.name}</span>
          <span className="t-text-m text-xs">{tag.dataType || tag.tagType}</span>
          <button onClick={() => onAdd(tag.fullPath || tag.path || tag.name)} className="t-text-m hover:t-accent p-0.5 cursor-pointer" title="Add to workspace">
            <Plus size={14} />
          </button>
        </div>
      ))}
      {results.length === 0 && (
        <EmptyState icon={Search} title="No tags found" description="Try a different search pattern." />
      )}
    </div>
  );
}
