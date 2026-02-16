import React, { useState, useEffect, useCallback } from 'react';
import { browseTags, readTags, searchTags, writeTags } from '../api.js';

export default function TagExplorer() {
  const [path, setPath] = useState('[default]');
  const [tags, setTags] = useState([]);
  const [values, setValues] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState(['[default]']);
  const [selectedTags, setSelectedTags] = useState([]);
  const [writeTag, setWriteTag] = useState(null); // { path, value }
  const [writeValue, setWriteValue] = useState('');
  const [writeStatus, setWriteStatus] = useState(null);

  const browse = useCallback(async (tagPath) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseTags(tagPath);
      if (result.success) {
        setTags(result.tags || []);
        setPath(tagPath);
        if (tagPath === '[default]') {
          setBreadcrumbs(['[default]']);
        } else {
          const parts = tagPath.replace('[default]/', '').split('/');
          setBreadcrumbs(['[default]', ...parts]);
        }
      } else {
        setError(result.error || 'Browse failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { browse('[default]'); }, [browse]);

  const readSelected = async () => {
    if (selectedTags.length === 0) return;
    setLoading(true);
    try {
      const paths = selectedTags.map(t => path === '[default]' ? `[default]/${t}` : `${path}/${t}`);
      const result = await readTags(paths);
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
      if (!result.success) setError(result.error);
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
        // Re-read the tag to refresh the displayed value
        const readResult = await readTags([writeTag]);
        if (readResult.success && readResult.results) {
          const vals = {};
          readResult.results.forEach(v => { vals[v.path] = v; });
          setValues(prev => ({ ...prev, ...vals }));
        }
        setTimeout(() => { setWriteTag(null); setWriteStatus(null); }, 1500);
      } else {
        setWriteStatus('error');
      }
    } catch (err) {
      setWriteStatus('error');
    }
  };

  const toggleSelect = (tagName) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const navigateFolder = (tag) => {
    const newPath = path === '[default]' ? `[default]/${tag.name}` : `${path}/${tag.name}`;
    browse(newPath);
    setSearchResults(null);
    setSelectedTags([]);
  };

  const navigateBreadcrumb = (idx) => {
    if (idx === 0) {
      browse('[default]');
    } else {
      const newPath = '[default]/' + breadcrumbs.slice(1, idx + 1).join('/');
      browse(newPath);
    }
    setSearchResults(null);
    setSelectedTags([]);
  };

  const getTagIcon = (tag) => {
    if (tag.hasChildren || tag.tagType === 'Folder' || tag.tagType === 'UdtInstance') return '📁';
    const dt = (tag.dataType || '').toLowerCase();
    if (dt.includes('bool')) return '🔘';
    if (dt.includes('int') || dt.includes('float') || dt.includes('double')) return '🔢';
    if (dt.includes('string')) return '🔤';
    if (dt.includes('date')) return '📅';
    return '🏷️';
  };

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden bg-gray-50">
      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
          placeholder="Search tags by name..."
          className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm"
        />
        <button onClick={doSearch} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors shadow-sm">
          Search
        </button>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 mb-3 text-sm text-gray-500 flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-gray-300">/</span>}
            <button
              onClick={() => navigateBreadcrumb(i)}
              className={`hover:text-blue-600 transition-colors ${i === breadcrumbs.length - 1 ? 'text-gray-900 font-medium' : ''}`}
            >
              {crumb}
            </button>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Write dialog */}
      {writeTag && (
        <div className="mb-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Write Tag Value</span>
            <button onClick={() => { setWriteTag(null); setWriteStatus(null); }} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
          <div className="text-xs text-blue-700 font-mono mb-2">{writeTag}</div>
          <div className="flex gap-2">
            <input
              value={writeValue}
              onChange={e => setWriteValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doWrite()}
              placeholder="New value..."
              className="flex-1 bg-white border border-blue-200 rounded px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={doWrite}
              disabled={writeStatus === 'writing'}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded text-white text-sm font-medium transition-colors"
            >
              {writeStatus === 'writing' ? '...' : writeStatus === 'success' ? '✓ Written' : 'Write'}
            </button>
          </div>
          {writeStatus === 'error' && <div className="text-xs text-red-600 mt-1">Write failed — check tag path and value type</div>}
        </div>
      )}

      {/* Tag list */}
      <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-full text-gray-400">Loading...</div>
        ) : searchResults ? (
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between px-2 py-1 mb-2">
              <span className="text-sm text-gray-500">{searchResults.length} results for "{searchQuery}"</span>
              <button onClick={() => setSearchResults(null)} className="text-xs text-gray-400 hover:text-gray-700">Clear</button>
            </div>
            {searchResults.map((tag, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <span>{getTagIcon(tag)}</span>
                <span className="text-gray-900 flex-1 font-mono text-xs">{tag.fullPath || tag.name}</span>
                <span className="text-gray-400 text-xs">{tag.dataType || tag.tagType}</span>
              </div>
            ))}
            {searchResults.length === 0 && (
              <div className="text-center py-8 text-gray-400">No tags found</div>
            )}
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {tags.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No tags at this path</div>
            ) : tags.map((tag, i) => {
              const isFolder = tag.hasChildren || tag.tagType === 'Folder' || tag.tagType === 'UdtInstance';
              const isSelected = selectedTags.includes(tag.name);
              const fullPath = path === '[default]' ? `[default]/${tag.name}` : `${path}/${tag.name}`;
              const val = values[fullPath];

              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                    isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => isFolder ? navigateFolder(tag) : toggleSelect(tag.name)}
                >
                  <span className="text-base">{getTagIcon(tag)}</span>
                  <span className="flex-1 text-gray-900 font-mono text-xs">{tag.name}</span>
                  {tag.dataType && <span className="text-gray-400 text-xs">{tag.dataType}</span>}
                  {tag.tagType && <span className="text-gray-300 text-xs">{tag.tagType}</span>}
                  {val && (
                    <>
                      <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                        val.quality === 'Good' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {String(val.value).slice(0, 20)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); openWriteDialog(fullPath, val.value); }}
                        className="text-xs px-1.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 transition-colors"
                        title="Write value"
                      >
                        ✏️
                      </button>
                    </>
                  )}
                  {isFolder && <span className="text-gray-300">→</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {selectedTags.length > 0 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-gray-500">{selectedTags.length} selected</span>
          <button onClick={readSelected} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors shadow-sm">
            Read Values
          </button>
          <button
            onClick={() => {
              if (selectedTags.length === 1) {
                const fullPath = path === '[default]' ? `[default]/${selectedTags[0]}` : `${path}/${selectedTags[0]}`;
                const val = values[fullPath];
                openWriteDialog(fullPath, val?.value);
              }
            }}
            disabled={selectedTags.length !== 1}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg text-white text-sm transition-colors shadow-sm"
          >
            Write Value
          </button>
          <button onClick={() => setSelectedTags([])} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-700 text-sm transition-colors">
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
