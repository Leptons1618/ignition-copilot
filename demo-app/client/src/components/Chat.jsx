import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Bot, User, Wrench, ChevronDown, ChevronRight, Plus, Clock3, Settings2,
  Layers, Trash2, Download, StopCircle, Zap, Gauge, PanelRightOpen, PanelRightClose,
  X, Tag, RefreshCw, AlertTriangle, WifiOff, RotateCcw,
} from 'lucide-react';
import { streamChat, getChatModels, getChatConfig, setChatConfig } from '../api.js';
import MarkdownRenderer from './chat/MarkdownRenderer.jsx';
import ToolCallCard from './chat/ToolCallCard.jsx';
import ChartBlock from './chat/ChartBlock.jsx';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import { Select } from './ui/Input.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';
import useTagPolling from '../hooks/useTagPolling.js';
import { useNotifications } from '../lib/notifications.jsx';
import logger from '../lib/logger.js';

export default function Chat({ onShowChart, seedPrompt, workspaceTags = [], onAddWorkspaceTags, onRemoveWorkspaceTag }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState([]);
  const [config, setConfigState] = useState({
    model: '',
    temperature: 0.2,
    numPredict: 900,
    maxIterations: 4,
    enableRagContext: true,
  });

  const MAX_INPUT_LENGTH = 4000;
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const notifications = useNotifications();

  const tagValues = useTagPolling(showWorkspace ? workspaceTags : [], 10000);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadModelsAndConfig = useCallback(async () => {
    try {
      setConnectionError(null);
      const [m, c] = await Promise.all([getChatModels(), getChatConfig()]);
      const modelList = m.models || [];
      setModels(modelList);
      if (modelList.length === 0) {
        setConnectionError('No LLM models found. Ensure Ollama is running with at least one model pulled (e.g., "ollama pull llama3.2:3b").');
        logger.warn('chat', 'no_models_found');
      }
      const modelNames = modelList.map(x => x.name || x);
      const preferred = c.defaultModel || prev.model;
      const validModel = modelNames.includes(preferred) ? preferred : (modelNames[0] ?? '');
      setConfigState(prev => ({
        ...prev,
        model: validModel,
        temperature: c.temperature ?? prev.temperature,
        numPredict: c.numPredict ?? prev.numPredict,
        maxIterations: c.maxIterations ?? prev.maxIterations,
        enableRagContext: c.enableRagContext ?? prev.enableRagContext,
      }));
      logger.info('chat', 'config_loaded', { models: modelList.length });
    } catch (err) {
      setConnectionError(`Cannot connect to LLM service: ${err.message}. Ensure the server and Ollama are running.`);
      logger.error('chat', 'config_load_failed', { error: err.message });
    }
  }, []);

  useEffect(() => { loadModelsAndConfig(); }, [loadModelsAndConfig]);

  useEffect(() => {
    if (seedPrompt?.prompt) {
      setInput(seedPrompt.prompt);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [seedPrompt]);

  const persistConfig = async (next) => {
    setConfigState(next);
    try {
      await setChatConfig({
        model: next.model,
        temperature: next.temperature,
        numPredict: next.numPredict,
        maxIterations: next.maxIterations,
        enableRagContext: next.enableRagContext,
      });
    } catch {}
  };

  const applyPreset = (preset) => {
    if (preset === 'speed') {
      persistConfig({ ...config, numPredict: 256, maxIterations: 2, temperature: 0.1 });
    } else {
      persistConfig({ ...config, numPredict: 900, maxIterations: 4, temperature: 0.2 });
    }
  };

  const send = useCallback(() => {
    const text = input.trim().slice(0, MAX_INPUT_LENGTH);
    if (!text || streaming) return;

    // Basic input validation
    if (text.length < 1) {
      notifications.warning('Please enter a message.');
      return;
    }

    if (!config.model) {
      notifications.error('No model selected. Check Ollama connection in settings.');
      return;
    }

    logger.track('chat_send', { messageLength: text.length, model: config.model });

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    const assistantIdx = newMessages.length;

    setMessages([...newMessages, {
      role: 'assistant', content: '', toolCalls: [], streaming: true, perf: null, model: config.model,
    }]);
    setInput('');
    setStreaming(true);
    setConnectionError(null);

    const startedAt = performance.now();

    const abort = streamChat(
      newMessages.map(m => ({ role: m.role, content: m.content })),
      sessionIdRef.current,
      {
        model: config.model || undefined,
        temperature: config.temperature,
        numPredict: config.numPredict,
        maxIterations: config.maxIterations,
        enableRagContext: config.enableRagContext,
      },
      (event) => {
        setMessages(prev => {
          const msgs = [...prev];
          const msg = { ...msgs[assistantIdx] };

          switch (event.type) {
            case 'token':
              msg.content += (typeof event.data === 'string' ? event.data : '');
              break;
            case 'tool_start':
              msg.toolCalls = [...(msg.toolCalls || []), {
                tool: event.data.tool, args: event.data.args, result: null, status: 'running',
              }];
              logger.debug('chat', 'tool_start', { tool: event.data.tool });
              break;
            case 'tool_result': {
              const tcs = [...(msg.toolCalls || [])];
              const idx = tcs.findLastIndex(tc => tc.tool === event.data.tool && tc.status === 'running');
              if (idx >= 0) {
                tcs[idx] = { ...tcs[idx], result: event.data.result, status: event.data.result?.error ? 'error' : 'success' };
              }
              msg.toolCalls = tcs;
              logger.debug('chat', 'tool_result', { tool: event.data.tool, hasError: !!event.data.result?.error });

              // Auto-detect chart data from query_history
              if (event.data.tool === 'query_history' && event.data.result?.data) {
                msg.chartData = formatChartDataFromHistory(event.data.result.data);
              }
              break;
            }
            case 'done': {
              msg.content = event.data.content || msg.content;
              msg.toolCalls = event.data.toolCalls || msg.toolCalls;
              msg.model = event.data.model || msg.model;
              const totalMs = Math.round(performance.now() - startedAt);
              msg.perf = event.data.perf || { totalMs };
              msg.streaming = false;
              setStreaming(false);
              logger.perf('chat_response', totalMs, { model: msg.model, toolCalls: (msg.toolCalls || []).length });

              // Check for chart data in final tool calls
              for (const tc of (event.data.toolCalls || [])) {
                if (tc.tool === 'query_history' && tc.result?.data) {
                  msg.chartData = formatChartDataFromHistory(tc.result.data);
                }
              }
              break;
            }
            case 'error': {
              const errorMsg = event.data?.message || 'Unknown error';
              msg.content = msg.content || `Error: ${errorMsg}`;
              msg.error = true;
              msg.streaming = false;
              setStreaming(false);
              logger.error('chat', 'stream_error', { error: errorMsg });

              // Detect connection issues
              if (errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('Failed')) {
                setConnectionError('Lost connection to the LLM service. Check that Ollama is running.');
                notifications.error('Chat connection lost. Check Ollama status.', 'Connection Error');
              }
              break;
            }
          }

          msgs[assistantIdx] = msg;
          return msgs;
        });
      }
    );

    abortRef.current = abort;
  }, [input, streaming, messages, config, notifications]);

  const stopStreaming = () => {
    abortRef.current?.();
    setStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  };

  const clearChat = () => {
    setMessages([]);
    sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  };

  const exportChat = () => {
    const md = messages.map(m => {
      const prefix = m.role === 'user' ? '**User:**' : '**Assistant:**';
      return `${prefix}\n\n${m.content}`;
    }).join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-export-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickActions = [
    { label: 'Read Workspace', prompt: `Read these tags and summarize status:\n${workspaceTags.join('\n') || '[default]/DemoPlant/MotorM12/Temperature'}` },
    { label: 'Reliability Review', prompt: 'Run asset health analysis for [default]/DemoPlant/MotorM12 and provide immediate actions.' },
    { label: 'Alarm Analysis', prompt: 'Summarize active alarms and likely root causes for DemoPlant.' },
    { label: 'Trend Findings', prompt: 'Query the last 1h trend for temperature, speed, and fan current and summarize anomalies.' },
  ];

  const hasTagPaths = input.trim() && /\[.*\]/.test(input);

  const addFromInput = () => {
    const paths = input.split(/\r?\n|,/).map(v => v.trim()).filter(v => v.startsWith('['));
    if (paths.length > 0) {
      onAddWorkspaceTags?.(paths);
      setInput('');
    }
  };

  const insertTagToInput = (path) => {
    setInput(prev => prev ? `${prev}\n${path}` : path);
    inputRef.current?.focus();
  };

  return (
    <div className="h-full flex t-bg">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b t-border-s t-surface px-4 py-2 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm t-text-2">
              <Bot size={16} className="t-accent" />
              <span className="font-semibold">Operational Chat</span>
              {messages.length > 0 && (
                <Badge color="neutral">{messages.length} messages</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {/* Model selector - always visible */}
              <Select
                value={config.model}
                onChange={e => persistConfig({ ...config, model: e.target.value })}
                className="text-xs py-1 max-w-[180px]"
              >
                {(models || []).map((m) => (
                  <option key={m.name || m} value={m.name || m}>{m.name || m}</option>
                ))}
              </Select>

              {/* Speed/Quality presets */}
              <Button variant="ghost" size="xs" onClick={() => applyPreset('speed')} title="Speed mode: fast, shorter responses">
                <Zap size={13} />
              </Button>
              <Button variant="ghost" size="xs" onClick={() => applyPreset('quality')} title="Quality mode: thorough responses">
                <Gauge size={13} />
              </Button>

              <Button variant="ghost" size="xs" onClick={() => setShowSettings(v => !v)} title="LLM Settings">
                <Settings2 size={14} />
              </Button>

              <div className="w-px h-5 t-border-s" />

              <Button variant="ghost" size="xs" onClick={() => setShowWorkspace(v => !v)} title="Workspace tags">
                {showWorkspace ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
              </Button>

              {messages.length > 0 && (
                <>
                  <Button variant="ghost" size="xs" onClick={exportChat} title="Export chat">
                    <Download size={14} />
                  </Button>
                  <Button variant="ghost" size="xs" onClick={clearChat} title="Clear chat">
                    <Trash2 size={14} />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Expandable settings */}
          {showSettings && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs pb-1">
              <div>
                <label className="t-text-m block mb-0.5">Temperature</label>
                <input type="number" step="0.1" min="0" max="1" value={config.temperature} onChange={e => persistConfig({ ...config, temperature: Number(e.target.value) })} className="w-full border t-border-s rounded px-2 py-1 t-field-bg t-field-fg t-field-border" />
              </div>
              <div>
                <label className="t-text-m block mb-0.5">Max Tokens</label>
                <input type="number" min="64" max="2048" value={config.numPredict} onChange={e => persistConfig({ ...config, numPredict: Number(e.target.value) })} className="w-full border t-border-s rounded px-2 py-1 t-field-bg t-field-fg t-field-border" />
              </div>
              <div>
                <label className="t-text-m block mb-0.5">Tool Iterations</label>
                <input type="number" min="1" max="6" value={config.maxIterations} onChange={e => persistConfig({ ...config, maxIterations: Number(e.target.value) })} className="w-full border t-border-s rounded px-2 py-1 t-field-bg t-field-fg t-field-border" />
              </div>
              <label className="inline-flex items-center gap-2 border t-border-s rounded px-2 py-1 t-surface t-text-2 self-end cursor-pointer">
                <input type="checkbox" checked={config.enableRagContext} onChange={e => persistConfig({ ...config, enableRagContext: e.target.checked })} />
                RAG Context
              </label>
              <div className="self-end t-text-m">
                Session: {sessionIdRef.current.slice(0, 16)}...
              </div>
            </div>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Connection error banner */}
          {connectionError && (
            <div className="flex items-start gap-3 px-4 py-3 t-warn-soft border t-warn-border rounded-lg t-warn">
              <WifiOff size={18} className="shrink-0 mt-0.5 t-warn" />
              <div className="flex-1 text-sm">
                <div className="font-medium mb-1">Connection Issue</div>
                <div className="mb-2">{connectionError}</div>
                <div className="text-xs t-text-m space-y-0.5">
                  <div>1. Ensure backend server is running (npm run dev)</div>
                  <div>2. Ensure Ollama is running (ollama serve)</div>
                  <div>3. Pull a model if needed (ollama pull llama3.2:3b)</div>
                </div>
              </div>
              <Button variant="outline" size="xs" onClick={loadModelsAndConfig}>
                <RotateCcw size={12} /> Retry
              </Button>
            </div>
          )}

          {messages.length === 0 && !connectionError && (
            <EmptyState
              icon={Bot}
              title="Ask Operational Questions"
              description="Use workspace tags, run diagnostics, and inspect tool evidence. Responses stream in real-time."
              action={
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-w-3xl w-full">
                  {quickActions.map((qa, i) => (
                    <button key={i} onClick={() => { setInput(qa.prompt); setTimeout(() => inputRef.current?.focus(), 50); }} className="px-3 py-2 text-sm t-surface hover:t-surface-h border t-border-s rounded-lg text-left t-text-2 transition-colors cursor-pointer">
                      {qa.label}
                    </button>
                  ))}
                </div>
              }
            />
          )}

          {messages.map((msg, i) => {
            // Skip the empty streaming assistant — the Thinking indicator below handles it
            if (
              msg.role === 'assistant' && msg.streaming &&
              !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0)
            ) return null;
            return (
              <MessageBubble
                key={i}
                msg={msg}
                onShowChart={onShowChart}
                onAddTag={(path) => onAddWorkspaceTags?.([path])}
              />
            );
          })}

          {streaming && messages[messages.length - 1]?.streaming && messages[messages.length - 1]?.content === '' && messages[messages.length - 1]?.toolCalls?.length === 0 && (
            <ThinkingIndicator onCancel={stopStreaming} />
          )}

          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div className="border-t t-border-s p-4 t-surface shrink-0">
          <div className="flex gap-2 max-w-5xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value.slice(0, MAX_INPUT_LENGTH))}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="Ask about tags, alarms, diagnostics, scripts, or paste tag paths..."
              className="flex-1 t-field-bg border t-field-border rounded-lg px-4 py-2.5 t-field-fg placeholder:t-text-m focus:outline-none focus:t-accent-border focus:ring-1 focus:ring-[var(--color-accent)] transition-colors min-h-[52px] text-sm"
              maxLength={MAX_INPUT_LENGTH}
              disabled={streaming}
            />
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="xs" onClick={addFromInput} disabled={!hasTagPaths} title="Add tag paths from input to workspace">
                <Plus size={13} />
                Add Tags
              </Button>
              {streaming ? (
                <Button variant="danger" size="sm" onClick={stopStreaming}>
                  <StopCircle size={14} />
                  Stop
                </Button>
              ) : (
                <Button variant="primary" size="sm" onClick={send} disabled={!input.trim()}>
                  <Send size={14} />
                  Send
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Workspace sidebar */}
      {showWorkspace && (
        <aside className="w-72 border-l t-border-s t-surface shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b t-border-s">
            <span className="text-xs font-semibold t-text-2 inline-flex items-center gap-1">
              <Tag size={13} />
              Workspace Tags
              <Badge color="neutral">{workspaceTags.length}</Badge>
            </span>
            <button onClick={() => setShowWorkspace(false)} className="t-text-m hover:t-text-2 cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {workspaceTags.length === 0 && (
              <p className="text-xs t-text-m text-center py-4">No workspace tags. Add from Tag Explorer or paste paths.</p>
            )}
            {workspaceTags.map(tag => {
              const val = tagValues.values[tag];
              return (
                <div
                  key={tag}
                  className="group flex items-center gap-1 px-2 py-1.5 rounded border t-border-s hover:t-surface-h transition-colors cursor-pointer"
                  onClick={() => insertTagToInput(tag)}
                  title="Click to insert into chat"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono t-text-2 truncate">{tag.split('/').pop()}</div>
                    {val && (
                      <div className="text-[10px] t-text-m">
                        <span className="font-mono t-text">{typeof val.value === 'number' ? val.value.toFixed(2) : String(val.value).slice(0, 12)}</span>
                        <span className={`ml-1 ${val.quality === 'Good' ? 't-ok' : 't-warn'}`}>{val.quality}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveWorkspaceTag?.(tag); }}
                    className="opacity-0 group-hover:opacity-100 t-text-m hover:t-err transition-opacity cursor-pointer"
                    title="Remove"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
          {workspaceTags.length > 0 && tagValues.lastUpdated && (
            <div className="px-3 py-1.5 border-t t-border-s flex items-center gap-1 text-[10px] t-text-m">
              <RefreshCw size={10} />
              {new Date(tagValues.lastUpdated).toLocaleTimeString()}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function MessageBubble({ msg, onShowChart, onAddTag }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${isUser ? 't-surface t-text-2' : 't-accent-bg text-white'}`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>
      <div className={`max-w-4xl min-w-0 ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-lg px-4 py-3 t-shadow ${
          isUser ? 't-accent-bg text-white' :
          msg.error ? 't-err-soft border t-err-border t-err' :
          't-surface border t-border-s t-text'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
          ) : (
            <MarkdownRenderer text={msg.content} onAddTag={onAddTag} />
          )}
          {msg.streaming && msg.content && (
            <span className="inline-block w-1.5 h-4 t-accent-bg animate-pulse ml-0.5 align-text-bottom rounded-sm" />
          )}
        </div>

        {/* Performance badge */}
        {msg.perf && !isUser && (
          <div className="mt-1 inline-flex items-center gap-2 text-[11px] t-text-m t-bg-alt rounded px-2 py-0.5">
            <Clock3 size={11} />
            <span>{msg.perf.totalMs}ms</span>
            <span>{msg.perf.llmCalls || 0} LLM</span>
            <span>{msg.perf.toolCalls || 0} tools</span>
          </div>
        )}

        {/* Tool calls */}
        {msg.toolCalls?.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </div>
        )}

        {/* Inline chart */}
        {msg.chartData?.series && (
          <ChartBlock data={msg.chartData} onExpand={onShowChart} />
        )}

        {/* Model info */}
        {msg.model && !isUser && !msg.streaming && (
          <div className="text-[11px] t-text-m mt-1">Model: {msg.model}</div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator({ onCancel }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);
  const timedOut = elapsed > 30;
  return (
    <div className="flex gap-3 items-start">
      <div className="w-8 h-8 rounded-full t-accent-bg flex items-center justify-center text-xs text-white shrink-0">
        <Bot size={14} />
      </div>
      <div className="t-surface border t-border-s rounded-lg px-4 py-3 t-text-m t-shadow space-y-2">
        <div className="flex items-center gap-2">
          <LoadingSpinner size={14} label={timedOut ? 'Still waiting...' : 'Thinking...'} />
          <span className="text-[11px] t-text-m">{elapsed}s</span>
        </div>
        {timedOut && (
          <div className="flex items-center gap-2 text-xs t-warn">
            <AlertTriangle size={12} />
            <span>Taking longer than expected — the LLM may be slow or unavailable.</span>
          </div>
        )}
        <button onClick={onCancel} className="text-xs t-text-m hover:t-err transition-colors cursor-pointer flex items-center gap-1">
          <StopCircle size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}

function formatChartDataFromHistory(historyData) {
  const series = [];
  for (const [tagPath, info] of Object.entries(historyData)) {
    const records = info.records || [];
    const tagName = tagPath.split('/').pop();
    series.push({
      name: tagName,
      fullPath: tagPath,
      data: records.filter(r => r.value != null).map(r => ({
        timestamp: r.timestamp,
        value: typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0,
      })),
    });
  }
  return series.length > 0 ? { series, type: 'timeSeries' } : null;
}
