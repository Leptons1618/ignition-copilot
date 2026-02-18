import React, { useState, useCallback } from 'react';
import { MessageSquare, X, Maximize2, Minimize2 } from 'lucide-react';
import Chat from './Chat.jsx';

/**
 * Floating AI chat overlay — accessible from any page.
 * Modes: hidden (FAB only), panel (floating panel), full (full-page overlay).
 */
export default function FloatingChat({ onShowChart, workspaceTags, onAddWorkspaceTags }) {
  const [mode, setMode] = useState('hidden'); // 'hidden' | 'panel' | 'full'
  const [seedPrompt, setSeedPrompt] = useState(null);

  const toggle = useCallback(() => {
    setMode(prev => prev === 'hidden' ? 'panel' : 'hidden');
  }, []);

  const expand = useCallback(() => setMode('full'), []);
  const collapse = useCallback(() => setMode('panel'), []);
  const close = useCallback(() => setMode('hidden'), []);

  const openWithPrompt = useCallback((prompt) => {
    setSeedPrompt({ prompt, ts: Date.now() });
    setMode(prev => prev === 'hidden' ? 'panel' : prev);
  }, []);

  // FAB button — always visible when chat is hidden
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

  // Full-page overlay
  if (mode === 'full') {
    return (
      <div className="fixed inset-0 z-50 flex flex-col animate-fade-in t-bg">
        {/* Full-page header */}
        <div className="flex items-center justify-between px-4 py-2 border-b t-head-bg t-border-s">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="t-accent" />
            <span className="text-sm font-semibold t-text">AI Chat</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={collapse}
              className="p-1.5 rounded-md transition-colors t-text-m cursor-pointer"
              title="Collapse to panel"
            >
              <Minimize2 size={16} />
            </button>
            <button
              onClick={close}
              className="p-1.5 rounded-md transition-colors t-text-m cursor-pointer"
              title="Close chat"
            >
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
          />
        </div>
      </div>
    );
  }

  // Panel mode — floating card at bottom-right
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border overflow-hidden t-shadow-lg animate-float-in t-bg t-border"
      style={{
        width: 'min(440px, calc(100vw - 48px))',
        height: 'min(600px, calc(100vh - 100px))',
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b shrink-0 t-head-bg t-border-s"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md flex items-center justify-center t-accent-soft">
            <MessageSquare size={13} className="t-accent" />
          </div>
          <span className="text-sm font-semibold t-text">AI Chat</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={expand}
            className="p-1.5 rounded-md transition-colors hover:opacity-80 t-text-m cursor-pointer"
            title="Expand to full page"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={close}
            className="p-1.5 rounded-md transition-colors hover:opacity-80 t-text-m cursor-pointer"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Chat content */}
      <div className="flex-1 overflow-hidden">
        <Chat
          onShowChart={onShowChart}
          seedPrompt={seedPrompt}
          workspaceTags={workspaceTags}
          onAddWorkspaceTags={onAddWorkspaceTags}
        />
      </div>
    </div>
  );
}
