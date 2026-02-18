import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Folder, FolderOpen, Binary, Hash, Type, Calendar, Search, Plus, Eye, PencilLine, X, FilePlus2, CheckSquare, Square, Layers } from 'lucide-react';
import { browseTags, readTags, searchTags, writeTags } from '../api.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import Modal from './ui/Modal.jsx';
import { Textarea } from './ui/Input.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';

export default function TagExplorer({ workspaceTags = [], onAddWorkspaceTags }) {
  const [path, setPath] = useState('[default]');
  const [tags, setTags] = useState([]);
  const [values, setValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState(['[default]']);
  const [selectedTags, setSelectedTags] = useState([]);
  const [writeTag, setWriteTag] = useState(null);
  const [writeValue, setWriteValue] = useState('');
  const [writeStatus, setWriteStatus] = useState(null);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchInput, setBatchInput] = useState('');

  const browse = useCallback(async (tagPath) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseTags(tagPath);
      if (!result.success) {
        setError(result.error || 'Browse failed');
        return;
      }
      setTags(result.tags || []);
      setPath(tagPath);
      if (tagPath === '[default]') {
        setBreadcrumbs(['[default]']);
      } else {
        setBreadcrumbs(['[default]', ...tagPath.replace('[default]/', '').split('/')]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse('[default]'); }, [browse]);

  const selectedFullPaths = useMemo(
    () => selectedTags.map(n => path === '[default]' ? `[default]/${n}` : `${path}/${n}`),
    [selectedTags, path]
  );

  const leafTags = useMemo(
    () => tags.filter(t => !t.hasChildren && t.tagType !== 'Folder' && t.tagType !== 'UdtInstance'),
    [tags]
  );

  const allLeafsSelected = leafTags.length > 0 && leafTags.every(t => selectedTags.includes(t.name));

  const toggleSelectAll = () => {
    if (allLeafsSelected) {
      setSelectedTags([]);
    } else {
      setSelectedTags(leafTags.map(t => t.name));
    }
  };

  const readSelected = async () => {
    if (selectedFullPaths.length === 0) return;
    setLoading(true);
    try {
      const result = await readTags(selectedFullPaths);
      if (result.success) {
        const vals = {};
        (result.results || []).forEach(v => { vals[v.path] = v; });
        setValues(prev => ({ ...prev, ...vals }));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await searchTags(searchQuery.trim());
      setSearchResults(result.success ? (result.matches || []) : []);
      if (!result.success) setError(result.error || 'Search failed');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openWriteDialog = (tagFullPath, currentValue) => {
    setWriteTag(tagFullPath);
    setWriteValue(currentValue !== undefined ? String(currentValue) : '');
    setWriteStatus(null);
  };

  const doWrite = async () => {
    if (!writeTag) return;
    setWriteStatus('writing');
    try {
      const result = await writeTags([{ path: writeTag, value: writeValue }]);
      if (result.success) {
        setWriteStatus('success');
        const readResult = await readTags([writeTag]);
        if (readResult.success && readResult.results) {
          const vals = {};
          readResult.results.forEach(v => { vals[v.path] = v; });
          setValues(prev => ({ ...prev, ...vals }));
        }
        setTimeout(() => { setWriteTag(null); setWriteStatus(null); }, 1000);
      } else {
        setWriteStatus('error');
      }
    } catch {
      setWriteStatus('error');
    }
  };

  const toggleSelect = (tagName) => {
    setSelectedTags(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };

  const navigateFolder = (tag) => {
    const next = path === '[default]' ? `[default]/${tag.name}` : `${path}/${tag.name}`;
    browse(next);
    setSearchResults(null);
    setSelectedTags([]);
  };

  const navigateBreadcrumb = (idx) => {
    const next = idx === 0 ? '[default]' : `[default]/${breadcrumbs.slice(1, idx + 1).join('/')}`;
    browse(next);
    setSearchResults(null);
    setSelectedTags([]);
  };

  const addSelectedToWorkspace = () => {
    if (selectedFullPaths.length > 0) onAddWorkspaceTags?.(selectedFullPaths);
  };

  const addBatchToWorkspace = () => {
    const paths = batchInput
      .split(/\r?\n|,/)
      .map(v => v.trim())
      .filter(Boolean);
    if (paths.length === 0) return;
    onAddWorkspaceTags?.(paths);
    setBatchInput('');
    setShowBatchModal(false);
  };

  const iconForTag = (tag) => {
    if (tag.hasChildren || tag.tagType === 'Folder' || tag.tagType === 'UdtInstance') return <Folder size={15} />;
    const dt = String(tag.dataType || '').toLowerCase();
    if (dt.includes('bool')) return <Binary size={15} />;
    if (dt.includes('int') || dt.includes('float') || dt.includes('double')) return <Hash size={15} />;
    if (dt.includes('string')) return <Type size={15} />;
    if (dt.includes('date')) return <Calendar size={15} />;
    return <FilePlus2 size={15} />;
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden t-bg gap-3">
      {/* Search + actions bar */}
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

      {/* Breadcrumb */}
      <div className="t-surface border t-border-s rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 text-sm t-text-2">
          <FolderOpen size={15} className="t-accent shrink-0" />
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="t-text-m">/</span>}
              <button onClick={() => navigateBreadcrumb(i)} className={`hover:t-accent transition-colors cursor-pointer ${i === breadcrumbs.length - 1 ? 'font-semibold t-text' : ''}`}>
                {crumb}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {error && <div className="px-3 py-2 t-err-soft border t-err-border rounded t-err text-sm">{error}</div>}

      {/* Write dialog */}
      {writeTag && (
        <div className="px-4 py-3 t-accent-soft border t-accent-border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium t-text">Write Tag Value</span>
            <button onClick={() => { setWriteTag(null); setWriteStatus(null); }} className="t-text-m hover:t-text-2 cursor-pointer"><X size={16} /></button>
          </div>
          <div className="text-xs t-accent font-mono mb-2">{writeTag}</div>
          <div className="flex gap-2">
            <input value={writeValue} onChange={e => setWriteValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && doWrite()} className="flex-1 t-field-bg border t-accent-border rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]" />
            <Button variant={writeStatus === 'success' ? 'success' : 'primary'} size="sm" onClick={doWrite} disabled={writeStatus === 'writing'}>
              {writeStatus === 'writing' ? 'Writing...' : writeStatus === 'success' ? 'Written' : 'Write'}
            </Button>
          </div>
        </div>
      )}

      {/* Selection toolbar */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 t-accent-soft border t-accent-border rounded-lg">
          <Badge color="info">{selectedTags.length} selected</Badge>
          <Button variant="secondary" size="xs" onClick={readSelected}>
            <Eye size={13} /> Read Values
          </Button>
          <Button variant="primary" size="xs" onClick={addSelectedToWorkspace}>
            <Plus size={13} /> Add to Workspace
          </Button>
          <Button variant="ghost" size="xs" onClick={() => setSelectedTags([])}>
            <X size={13} /> Clear
          </Button>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0">
        <div className="lg:col-span-2 border t-border-s rounded-lg t-surface overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <LoadingSpinner label="Loading tags..." />
            </div>
          ) : searchResults ? (
            <SearchResults
              results={searchResults}
              onClear={() => setSearchResults(null)}
              onAdd={(p) => onAddWorkspaceTags?.([p])}
              iconForTag={iconForTag}
            />
          ) : (
            <div className="p-2 space-y-0.5">
              {/* Select all header */}
              {leafTags.length > 0 && (
                <button onClick={toggleSelectAll} className="flex items-center gap-2 px-3 py-1.5 text-xs t-text-m hover:t-text-2 w-full text-left cursor-pointer">
                  {allLeafsSelected ? <CheckSquare size={14} className="t-accent" /> : <Square size={14} />}
                  {allLeafsSelected ? 'Deselect all' : `Select all ${leafTags.length} leaf tags`}
                </button>
              )}
              {tags.length === 0 && (
                <EmptyState icon={FolderOpen} title="No tags at this path" description="Navigate to a folder containing tags." />
              )}
              {tags.map((tag, i) => {
                const isFolder = tag.hasChildren || tag.tagType === 'Folder' || tag.tagType === 'UdtInstance';
                const isSelected = selectedTags.includes(tag.name);
                const fullPath = path === '[default]' ? `[default]/${tag.name}` : `${path}/${tag.name}`;
                const val = values[fullPath];
                const inWorkspace = workspaceTags.includes(fullPath);

                return (
                  <div
                    key={`${tag.name}-${i}`}
                    className={`group flex items-center gap-2 px-3 py-2 rounded border text-sm cursor-pointer transition-colors ${
                      isSelected ? 't-accent-soft t-accent-border' :
                      inWorkspace ? 't-ok-soft t-ok-border' :
                      'border-transparent hover:t-surface-h'
                    }`}
                    onClick={() => isFolder ? navigateFolder(tag) : toggleSelect(tag.name)}
                  >
                    <span className={isFolder ? 't-accent' : 't-text-m'}>{iconForTag(tag)}</span>
                    <span className="flex-1 t-text font-mono text-xs">{tag.name}</span>
                    {tag.dataType && <span className="t-text-m text-xs">{tag.dataType}</span>}
                    {val && (
                      <span className="text-xs px-2 py-0.5 rounded t-ok-soft t-ok font-mono">
                        {String(val.value).slice(0, 20)}
                      </span>
                    )}
                    {inWorkspace && <Badge color="success">WS</Badge>}
                    {!isFolder && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); onAddWorkspaceTags?.([fullPath]); }} className="t-text-m hover:t-accent p-0.5 cursor-pointer" title="Add to workspace">
                          <Plus size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openWriteDialog(fullPath, val?.value); }} className="t-text-m hover:t-warn p-0.5 cursor-pointer" title="Write value">
                          <PencilLine size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="border t-border-s rounded-lg t-surface p-3 overflow-y-auto space-y-4">
          <div>
            <div className="text-sm font-semibold t-text mb-2 flex items-center gap-1">
              Workspace Tags
              <Badge color="neutral">{workspaceTags.length}</Badge>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {workspaceTags.length === 0 && <div className="text-xs t-text-m">No workspace tags yet.</div>}
              {workspaceTags.map(t => (
                <div key={t} className="text-xs font-mono t-text-2 t-bg-alt border t-border-s rounded px-2 py-1 truncate" title={t}>
                  {t.split('/').pop()}
                  <span className="t-text-m ml-1">({t.split('/').slice(0, -1).join('/')})</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Batch add modal */}
      {showBatchModal && (
        <Modal title="Batch Add Tags" onClose={() => setShowBatchModal(false)}>
          <p className="text-sm t-text-2 mb-3">Enter tag paths, one per line or comma-separated.</p>
          <Textarea
            rows={8}
            value={batchInput}
            onChange={e => setBatchInput(e.target.value)}
            placeholder={"[default]/DemoPlant/MotorM12/Temperature\n[default]/DemoPlant/MotorM12/Vibration\n[default]/DemoPlant/MotorM12/Speed"}
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

function SearchResults({ results, onClear, onAdd, iconForTag }) {
  return (
    <div className="p-2 space-y-1">
      <div className="flex items-center justify-between px-2 py-1 mb-2">
        <span className="text-sm t-text-2">
          <Badge color="neutral">{results.length}</Badge> results
        </span>
        <Button variant="ghost" size="xs" onClick={onClear}>Clear</Button>
      </div>
      {results.map((tag, i) => (
        <div key={`${tag.fullPath || tag.name}-${i}`} className="group flex items-center gap-2 px-3 py-2 t-bg-alt rounded border t-border-s text-sm hover:t-border transition-colors">
          <span className="t-text-m">{iconForTag(tag)}</span>
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
