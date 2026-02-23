import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, X, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import Chat from './Chat.jsx';

export default function FloatingChat({ onShowChart, workspaceTags, onAddWorkspaceTags, onRemoveWorkspaceTag, seedPrompt }) {
  const [mode, setMode] = useState('hidden');
  const [panelSize, setPanelSize] = useState({ width: 440, height: 600 });
  const resizingRef = useRef(null);
  const panelRef = useRef(null);

  const toggle = useCallback(() => {
    setMode(prev => prev === 'hidden' ? 'panel' : 'hidden');
  }, []);

  const expand = useCallback(() => setMode('full'), []);
  const collapse = useCallback(() => setMode('panel'), []);
  const close = useCallback(() => setMode('hidden'), []);

  // Open panel when seedPrompt arrives
  useEffect(() => {
    if (seedPrompt?.prompt) {
      setMode(prev => prev === 'hidden' ? 'panel' : prev);
    }
  }, [seedPrompt]);

  // Resize handling for panel mode
  const startResize = useCallback((e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panelSize.width;
    const startH = panelSize.height;
    resizingRef.current = { startX, startY, startW, startH, direction };

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const { startX, startY, startW, startH, direction: dir } = resizingRef.current;
      let newW = startW, newH = startH;
      if (dir.includes('w')) newW = Math.max(320, Math.min(800, startW + (startX - ev.clientX)));
      if (dir.includes('n')) newH = Math.max(300, Math.min(window.innerHeight - 60, startH + (startY - ev.clientY)));
      setPanelSize({ width: newW, height: newH });
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [panelSize]);

  if (mode === 'hidden') {
    return (
      <button
        onClick={toggle}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center t-shadow-lg transition-all hover:scale-110 active:scale-95 t-accent-bg text-white cursor-pointer"
        title="Open AI Chat"
      >
        <MessageSquare size={22} />
      </button>
    );
  }

  if (mode === 'full') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col animate-fade-in t-bg">
        <div className="flex items-center justify-between px-4 py-2 border-b t-head-bg t-border-s">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="t-accent" />
            <span className="text-sm font-semibold t-text">AI Chat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={collapse} className="p-1.5 rounded-md transition-colors t-text-m cursor-pointer" title="Collapse to panel">
              <Minimize2 size={16} />
            </button>
            <button onClick={close} className="p-1.5 rounded-md transition-colors t-text-m cursor-pointer" title="Close chat">
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <Chat
            onShowChart={onShowChart}
            seedPrompt={seedPrompt}
            workspaceTags={workspaceTags}
            onAddWorkspaceTags={onAddWorkspaceTags}
            onRemoveWorkspaceTag={onRemoveWorkspaceTag}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border overflow-hidden t-shadow-lg animate-float-in t-bg t-border"
      style={{
        width: `min(${panelSize.width}px, calc(100vw - 48px))`,
        height: `min(${panelSize.height}px, calc(100vh - 100px))`,
      }}
    >
      {/* Left resize edge */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize z-10 hover:bg-[var(--color-accent)] hover:opacity-30 transition-opacity"
        onPointerDown={(e) => startResize(e, 'w')}
      />
      {/* Top resize edge */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-10 hover:bg-[var(--color-accent)] hover:opacity-30 transition-opacity"
        onPointerDown={(e) => startResize(e, 'n')}
      />
      {/* Top-left corner resize */}
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-20"
        onPointerDown={(e) => startResize(e, 'nw')}
      />

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 t-head-bg t-border-s">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center t-accent-soft">
            <MessageSquare size={13} className="t-accent" />
          </div>
          <span className="text-sm font-semibold t-text">AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={expand} className="p-1.5 rounded-md transition-colors hover:opacity-80 t-text-m cursor-pointer" title="Expand to full page">
            <Maximize2 size={14} />
          </button>
          <button onClick={close} className="p-1.5 rounded-md transition-colors hover:opacity-80 t-text-m cursor-pointer" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <Chat
          onShowChart={onShowChart}
          seedPrompt={seedPrompt}
          workspaceTags={workspaceTags}
          onAddWorkspaceTags={onAddWorkspaceTags}
          onRemoveWorkspaceTag={onRemoveWorkspaceTag}
        />
      </div>
    </div>
  );
}
