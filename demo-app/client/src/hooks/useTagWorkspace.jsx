import React, { createContext, useContext, useMemo, useState } from 'react';

const KEY = 'ignition-copilot:workspace-tags';

function normalize(paths = []) {
  const out = [];
  const seen = new Set();
  for (const p of paths) {
    const v = String(p || '').trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function loadInitial() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return normalize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function useTagWorkspaceState() {
  const [tags, setTags] = useState(loadInitial);

  const persist = (next) => {
    setTags(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  };

  return useMemo(() => ({
    tags,
    addTags: (paths) => {
      const next = normalize([...tags, ...(Array.isArray(paths) ? paths : [paths])]);
      persist(next);
    },
    removeTag: (path) => persist(tags.filter(t => t !== path)),
    removeTags: (paths) => {
      const rm = new Set(paths);
      persist(tags.filter(t => !rm.has(t)));
    },
    clearTags: () => persist([]),
    hasTag: (path) => tags.includes(path),
  }), [tags]);
}

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const workspace = useTagWorkspaceState();

  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

export default useTagWorkspaceState;
