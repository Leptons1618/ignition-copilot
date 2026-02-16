import { useState, useRef, useCallback } from 'react';
import { streamChat, getChatModels, getChatConfig, setChatConfig } from '../api.js';

/**
 * Hook encapsulating chat session state, streaming, and LLM config.
 */
export default function useChatSession() {
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [models, setModels] = useState([]);
  const [config, setConfigState] = useState({
    model: '',
    temperature: 0.2,
    numPredict: 900,
    maxIterations: 4,
    enableRagContext: true,
  });

  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const abortRef = useRef(null);

  const loadConfig = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([getChatModels(), getChatConfig()]);
      setModels(m.models || []);
      setConfigState(prev => ({
        ...prev,
        model: c.defaultModel || prev.model || (m.models?.[0]?.name ?? ''),
        temperature: c.temperature ?? prev.temperature,
        numPredict: c.numPredict ?? prev.numPredict,
        maxIterations: c.maxIterations ?? prev.maxIterations,
        enableRagContext: c.enableRagContext ?? prev.enableRagContext,
      }));
    } catch {}
  }, []);

  const persistConfig = useCallback(async (next) => {
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
  }, []);

  const send = useCallback((text) => {
    if (!text.trim() || streaming) return;

    const userMsg = { role: 'user', content: text.trim() };
    setMessages(prev => {
      const newMsgs = [...prev, userMsg];
      // Start streaming
      doStream(newMsgs);
      return newMsgs;
    });
  }, [streaming, config]);

  const doStream = useCallback((allMessages) => {
    setStreaming(true);

    // Add placeholder assistant message
    const assistantIdx = allMessages.length;
    setMessages([...allMessages, {
      role: 'assistant',
      content: '',
      toolCalls: [],
      streaming: true,
      perf: null,
      model: config.model,
    }]);

    const startedAt = performance.now();

    const abort = streamChat(
      allMessages.map(m => ({ role: m.role, content: m.content })),
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
              msg.content += (typeof event.data === 'string' ? event.data : event.data || '');
              break;
            case 'tool_start':
              msg.toolCalls = [...(msg.toolCalls || []), {
                tool: event.data.tool,
                args: event.data.args,
                result: null,
                status: 'running',
              }];
              break;
            case 'tool_result': {
              const tcs = [...(msg.toolCalls || [])];
              const idx = tcs.findLastIndex(tc => tc.tool === event.data.tool && tc.status === 'running');
              if (idx >= 0) {
                tcs[idx] = { ...tcs[idx], result: event.data.result, status: event.data.result?.error ? 'error' : 'success' };
              }
              msg.toolCalls = tcs;
              break;
            }
            case 'done':
              msg.content = event.data.content || msg.content;
              msg.toolCalls = event.data.toolCalls || msg.toolCalls;
              msg.model = event.data.model || msg.model;
              msg.perf = event.data.perf || { totalMs: Math.round(performance.now() - startedAt) };
              msg.streaming = false;
              setStreaming(false);
              break;
            case 'error':
              msg.content = msg.content || `Error: ${event.data?.message || 'Unknown error'}`;
              msg.error = true;
              msg.streaming = false;
              setStreaming(false);
              break;
          }

          msgs[assistantIdx] = msg;
          return msgs;
        });
      }
    );

    abortRef.current = abort;
  }, [config]);

  const stop = useCallback(() => {
    abortRef.current?.();
    setStreaming(false);
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  const exportMarkdown = useCallback(() => {
    return messages.map(m => {
      const prefix = m.role === 'user' ? '**User:**' : '**Assistant:**';
      return `${prefix}\n\n${m.content}`;
    }).join('\n\n---\n\n');
  }, [messages]);

  return {
    messages,
    streaming,
    models,
    config,
    send,
    stop,
    clearMessages,
    loadConfig,
    persistConfig,
    exportMarkdown,
    sessionId: sessionIdRef.current,
  };
}
