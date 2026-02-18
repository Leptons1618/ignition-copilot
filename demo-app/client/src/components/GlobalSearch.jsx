import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, FileJson, FolderTree, Tag, Database, Code2, ArrowRight, Loader2 } from 'lucide-react';
import Badge from './ui/Badge.jsx';
import logger from '../lib/logger.js';

const API = '/api';

export default function GlobalSearch({ onNavigate, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIdx(0);
      logger.track('global_search', { query: q, resultCount: (data.results || []).length });
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 250);
  };

  const handleKeyDown = (e) => {
    if (!results || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = results[selectedIdx];
      if (item) {
        onNavigate(item);
        onClose();
      }
    }
  };

  const ICONS = {
    tag: Tag,
    view: FileJson,
    project: FolderTree,
    script: Code2,
    query: Database,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-xl mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search tags, views, projects, scripts..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent outline-none"
          />
          {loading && <Loader2 size={16} className="animate-spin text-gray-400" />}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {results === null && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              Start typing to search across tags, views, and projects
            </div>
          )}

          {results !== null && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              No results found for "{query}"
            </div>
          )}

          {results?.map((item, i) => {
            const Icon = ICONS[item.type] || Tag;
            return (
              <button
                key={`${item.type}-${item.path}-${i}`}
                onClick={() => { onNavigate(item); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <Icon size={15} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate font-mono">{item.name || item.path}</div>
                  {item.description && (
                    <div className="text-[11px] text-gray-400 truncate">{item.description}</div>
                  )}
                </div>
                <Badge color="neutral">{item.type}</Badge>
                <ArrowRight size={12} className="text-gray-300" />
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span><kbd className="px-1 py-0.5 rounded border border-gray-300 bg-white text-gray-500">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded border border-gray-300 bg-white text-gray-500">Enter</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 rounded border border-gray-300 bg-white text-gray-500">Esc</kbd> Close</span>
            <span className="ml-auto"><kbd className="px-1 py-0.5 rounded border border-gray-300 bg-white text-gray-500">Ctrl+K</kbd> Search</span>
          </div>
        </div>
      </div>
    </div>
  );
}
