import React, { useState, useRef, useEffect } from 'react';
import { sendChat } from '../api.js';
import ChartEmbed from './ChartEmbed.jsx';

export default function Chat({ onShowChart, seedPrompt }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const sessionIdRef = useRef(`session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (seedPrompt?.prompt) {
      setInput(seedPrompt.prompt);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [seedPrompt]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const result = await sendChat(
        newMessages.map(m => ({ role: m.role, content: m.content })),
        sessionIdRef.current
      );

      const assistantMsg = {
        role: 'assistant',
        content: result.content,
        toolCalls: result.toolCalls,
        chartData: result.chartData,
        model: result.model,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const quickActions = [
    { label: 'Browse Tags', prompt: 'Browse all tags at [default] and show me the structure' },
    { label: 'Temperature Trend', prompt: 'Show me the temperature trend for MotorM12 over the last hour' },
    { label: 'Read Motor Data', prompt: 'Read all current values for MotorM12 - temperature, speed, vibration, load, current' },
    { label: 'Search Tags', prompt: 'Search for all tags containing "Temp" in [default]' },
    { label: 'System Health', prompt: 'Check the Ignition Gateway system health and give me a summary' },
    { label: 'Create Alarms', prompt: 'How do I configure alarms in Ignition? Give me step-by-step instructions.' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-lg font-semibold text-blue-700">AI</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Ignition Copilot</h2>
            <p className="text-gray-500 mb-6 max-w-lg">
              AI assistant connected to your live Ignition Gateway. Ask about tags, trends, alarms, or get help with Ignition development.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
              {quickActions.map((qa, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(qa.prompt); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="px-3 py-2 text-sm bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-left text-gray-700 transition-colors shadow-sm hover:shadow"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onShowChart={onShowChart} />
        ))}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs text-white shrink-0">AI</div>
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-500 shadow-sm">
              <div className="flex gap-1">
                <span className="animate-bounce delay-0">.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>.</span>
              </div>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-200 p-4 bg-white shrink-0">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about tags, trends, alarms, or Ignition help..."
            className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 rounded-lg font-medium transition-colors text-white"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onShowChart }) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs shrink-0 ${
        isUser ? 'bg-gray-200 text-gray-700' : 'bg-blue-600 text-white'
      }`}>
        {isUser ? 'YOU' : 'AI'}
      </div>
      <div className={`max-w-3xl ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-lg px-4 py-3 shadow-sm ${
          isUser ? 'bg-blue-600 text-white'
          : msg.error ? 'bg-red-50 border border-red-200 text-red-700'
          : 'bg-white border border-gray-200 text-gray-800'
        }`}>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</div>
        </div>

        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="mt-2 space-y-1">
            {msg.toolCalls.map((tc, i) => (
              <details key={i} className="group">
                <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 transition-colors">
                  Tool: {tc.tool}({JSON.stringify(tc.args).slice(0, 60)})
                </summary>
                <pre className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-xs text-gray-600 overflow-x-auto max-h-48 overflow-y-auto">
                  {JSON.stringify(tc.result, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        )}

        {msg.chartData && msg.chartData.series && (
          <div className="mt-3">
            <ChartEmbed data={msg.chartData} />
            {onShowChart && (
              <button
                onClick={() => onShowChart(msg.chartData.series.map(s => s.fullPath), '-1h')}
                className="mt-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
              >
                Open in Charts tab
              </button>
            )}
          </div>
        )}

        {msg.model && !isUser && (
          <div className="text-xs text-gray-400 mt-1">via {msg.model}</div>
        )}
      </div>
    </div>
  );
}
