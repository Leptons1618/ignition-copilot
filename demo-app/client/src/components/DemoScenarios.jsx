import React, { useState, useEffect } from 'react';
import { getScenarios, runScenario } from '../api.js';

export default function DemoScenarios() {
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState({});

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
    setResults(prev => ({ ...prev, [id]: { status: 'running', steps: [] } }));

    try {
      const startedAt = Date.now();
      const result = await runScenario(id);
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
      <div className="h-full flex items-center justify-center text-gray-500">
        Loading scenarios...
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Demo Scenarios</h2>
          <p className="text-gray-500">
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
                className={`bg-white border rounded-xl p-5 transition-all shadow-sm ${
                  result?.status === 'success' ? 'border-green-300'
                  : result?.status === 'error' ? 'border-red-300'
                  : isRunning ? 'border-blue-300 animate-pulse'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow'
                }`}
              >
                <div className="mb-3">
                  <h3 className="text-gray-900 font-semibold">{title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{scenario.description}</p>
                </div>

                {scenario.businessValue && (
                  <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <div className="text-xs text-blue-700 font-medium mb-1">Business Value</div>
                    <div className="text-xs text-blue-600">{short(scenario.businessValue, 140)}</div>
                  </div>
                )}

                <button
                  onClick={() => run(scenario)}
                  disabled={isRunning || running !== null}
                  className={`w-full py-2 rounded-lg font-medium text-sm transition-colors ${
                    isRunning ? 'bg-blue-600 text-white cursor-wait'
                    : result?.status === 'success' ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                  }`}
                >
                  {isRunning ? 'Running...' : result ? 'Re-run' : 'Run Scenario'}
                </button>
              </div>
            );
          })}
        </div>

        {Object.entries(results).filter(([, r]) => r.status !== 'running').map(([id, result]) => {
          const scenario = scenarios.find(s => s.id === id);
          if (!scenario) return null;

          return (
            <div key={id} className="mb-6 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className={`px-5 py-3 flex items-center gap-3 ${
                result.status === 'success' ? 'bg-green-50 border-b border-green-100'
                : 'bg-red-50 border-b border-red-100'
              }`}>
                <span className="text-gray-900 font-medium">{scenario.title || scenario.name || id}</span>
                <span className={`ml-auto text-xs px-2 py-1 rounded-full font-medium ${
                  result.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {result.status === 'success' ? 'Complete' : 'Failed'}
                </span>
                {result.duration && (
                  <span className="text-xs text-gray-400">{(result.duration / 1000).toFixed(1)}s</span>
                )}
              </div>

              <div className="p-5">
                {result.content && (
                  <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                    {result.content}
                  </div>
                )}

                {result.toolCalls && result.toolCalls.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">Tool Calls ({result.toolCalls.length})</div>
                    <div className="space-y-1">
                      {result.toolCalls.map((tc, i) => (
                        <details key={i} className="group">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 px-2 py-1 bg-gray-50 rounded border border-gray-100">
                            Tool: {tc.tool}({JSON.stringify(tc.args).slice(0, 80)})
                          </summary>
                          <pre className="mt-1 p-2 bg-gray-50 rounded border border-gray-100 text-xs text-gray-600 overflow-x-auto max-h-40 overflow-y-auto">
                            {JSON.stringify(tc.result, null, 2)}
                          </pre>
                        </details>
                      ))}
                    </div>
                  </div>
                )}

                {result.steps && result.steps.length > 0 && (
                  <div className="mt-4">
                    <div className="text-xs text-gray-500 mb-2">Execution Steps</div>
                    <div className="space-y-1">
                      {result.steps.map((step, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                          <span className="text-green-600">OK</span>
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
      </div>
    </div>
  );
}
