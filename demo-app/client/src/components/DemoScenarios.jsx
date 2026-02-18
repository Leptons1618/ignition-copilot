import React, { useState, useEffect } from 'react';
import {
  PlaySquare, Play, RefreshCw, CheckCircle2, XCircle, Clock3, Wrench, ChevronDown, Loader2,
} from 'lucide-react';
import { getScenarios, runScenario } from '../api.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import Collapsible from './ui/Collapsible.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';
import EmptyState from './ui/EmptyState.jsx';
import MarkdownRenderer from './chat/MarkdownRenderer.jsx';
import ToolCallCard from './chat/ToolCallCard.jsx';

const SCENARIO_STAGES = [
  'Initializing scenario...',
  'Connecting to Ignition Gateway...',
  'Reading tag data...',
  'Running AI analysis...',
  'Processing results...',
];

export default function DemoScenarios() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});
  const [progressStage, setProgressStage] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const data = await getScenarios();
        setScenarios(data.scenarios || data || []);
      } catch (err) {
        console.error('Failed to load scenarios:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const run = async (scenario) => {
    const id = scenario.id;
    setRunning(id);
    setProgressStage(0);
    setResults(prev => ({ ...prev, [id]: { status: 'running', steps: [] } }));

    const stageTimer = setInterval(() => {
      setProgressStage(prev => Math.min(prev + 1, SCENARIO_STAGES.length - 1));
    }, 2500);

    try {
      const startedAt = Date.now();
      const result = await runScenario(id);
      clearInterval(stageTimer);
      const duration = result.duration ?? (Date.now() - startedAt);
      const newResult = {
        status: result.success === false || result.error ? 'error' : 'success',
        content: result.content || result.response || result.message || result.error,
        toolCalls: result.toolCalls || [],
        chartData: result.chartData,
        duration,
        steps: result.steps || [],
      };
      setResults(prev => ({ ...prev, [id]: newResult }));
    } catch (err) {
      clearInterval(stageTimer);
      setResults(prev => ({ ...prev, [id]: { status: 'error', content: err.message } }));
    } finally {
      setRunning(null);
    }
  };

  const short = (text, max = 120) => {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner label="Loading scenarios..." />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 t-bg">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold t-text mb-2 flex items-center gap-2">
            <PlaySquare size={22} className="t-accent" />
            Demo Scenarios
          </h2>
          <p className="t-text-m">
            Run repeatable business-value scenarios against your configured services.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {scenarios.map((scenario) => {
            const result = results[scenario.id];
            const isRunning = running === scenario.id;
            const title = scenario.title || scenario.name || scenario.id;

            return (
              <div
                key={scenario.id}
                className={`t-surface border rounded-xl p-5 transition-all t-shadow ${
                  result?.status === 'success' ? 't-ok-border'
                  : result?.status === 'error' ? 't-err-border'
                  : isRunning ? 't-accent-border animate-pulse'
                  : 't-border-s hover:t-border hover:shadow'
                }`}
              >
                <div className="mb-3">
                  <h3 className="t-text font-semibold">{title}</h3>
                  <p className="t-text-m text-sm mt-1">{scenario.description}</p>
                </div>

                {scenario.businessValue && (
                  <div className="mb-3 px-3 py-2 t-accent-soft border t-accent-border rounded-lg">
                    <div className="text-xs t-accent font-medium mb-1">Business Value</div>
                    <div className="text-xs t-accent opacity-80">{short(scenario.businessValue, 140)}</div>
                  </div>
                )}

                <button
                  onClick={() => run(scenario)}
                  disabled={isRunning || running !== null}
                  className={`w-full py-2 rounded-lg font-medium text-sm transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                    isRunning ? 't-accent-bg text-white cursor-wait'
                    : result?.status === 'success' ? 't-ok-fill hover:opacity-90 text-white'
                    : 't-bg-alt hover:t-surface-h t-text-2 border t-border-s'
                  }`}
                >
                  {isRunning ? <><LoadingSpinner size={14} /> Running...</> : result ? <><RefreshCw size={14} /> Re-run</> : <><Play size={14} /> Run Scenario</>}
                </button>
              </div>
            );
          })}
        </div>

        {Object.entries(results).filter(([, r]) => r.status !== 'running').map(([id, result]) => {
          const scenario = scenarios.find(s => s.id === id);
          if (!scenario) return null;

          return (
            <div key={id} className="mb-6 t-surface border t-border-s rounded-xl overflow-hidden t-shadow">
              <div className={`px-5 py-3 flex items-center gap-3 ${
                result.status === 'success' ? 't-ok-soft border-b t-ok-border'
                : 't-err-soft border-b t-err-border'
              }`}>
                {result.status === 'success'
                  ? <CheckCircle2 size={16} className="t-ok" />
                  : <XCircle size={16} className="t-err" />}
                <span className="t-text font-medium">{scenario.title || scenario.name || id}</span>
                <span className="ml-auto">
                  {result.status === 'success' ? <Badge color="success">Complete</Badge> : <Badge color="error">Failed</Badge>}
                </span>
                {result.duration && (
                  <span className="text-xs t-text-m inline-flex items-center gap-1">
                    <Clock3 size={12} />
                    {(result.duration / 1000).toFixed(1)}s
                  </span>
                )}
              </div>

              <div className="p-5">
                {result.content && (
                  <MarkdownRenderer text={result.content} />
                )}

                {result.toolCalls && result.toolCalls.length > 0 && (
                  <div className="mt-4 space-y-1">
                    <div className="text-xs t-text-m mb-2 flex items-center gap-1">
                      <Wrench size={12} />
                      Tool Calls ({result.toolCalls.length})
                    </div>
                    {result.toolCalls.map((tc, i) => (
                      <ToolCallCard key={i} toolCall={{ ...tc, status: tc.result?.error ? 'error' : 'success' }} />
                    ))}
                  </div>
                )}

                {result.steps && result.steps.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs t-text-m mb-2">Execution Steps</div>
                    <div className="space-y-1">
                      {result.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs t-text-2">
                          <CheckCircle2 size={12} className="t-ok" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Scenario Progress Modal */}
        {running !== null && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="t-surface rounded-xl t-shadow-lg border t-border-s max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full t-accent-bg flex items-center justify-center shrink-0">
                  <PlaySquare size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold t-text">
                    {scenarios.find(s => s.id === running)?.title || running}
                  </h3>
                  <p className="text-xs t-text-m">Running scenario...</p>
                </div>
              </div>

              <div className="space-y-3">
                {SCENARIO_STAGES.map((stage, i) => (
                  <div key={i} className={`flex items-center gap-3 text-sm transition-all ${
                    i < progressStage ? 't-ok' : i === progressStage ? 't-text' : 't-text-m opacity-40'
                  }`}>
                    {i < progressStage
                      ? <CheckCircle2 size={16} className="shrink-0" />
                      : i === progressStage
                        ? <Loader2 size={16} className="animate-spin shrink-0 t-accent" />
                        : <div className="w-4 h-4 rounded-full border-2 t-border shrink-0" />
                    }
                    <span>{stage}</span>
                  </div>
                ))}
              </div>

              <div className="mt-5 w-full t-bg-alt rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full t-accent-bg rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${((progressStage + 1) / SCENARIO_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
