import React, { useEffect, useState } from 'react';
import { getIgnitionStatus, getChatModels, getRAGStats } from '../api.js';

const PRACTICAL_WORKFLOWS = [
  {
    title: 'Fault Detection',
    value: 'Spot anomalies and warn before a trip.',
    prompt: 'Read MotorM12 values for temperature, speed, vibration, load, and current. Identify any anomalies and likely causes.',
  },
  {
    title: 'Predictive Maintenance',
    value: 'Use trends to plan maintenance windows.',
    prompt: 'Query the last 1 hour history for MotorM12 temperature, vibration, and speed. Summarize trend risk and recommended maintenance.',
  },
  {
    title: 'Operator Support',
    value: 'Guide L1/L2 operators through troubleshooting.',
    prompt: 'MotorM12 temperature is high. Give me a step-by-step operator checklist using current readings and Ignition best practices.',
  },
];

export default function DemoGuide({ onOpenChatPrompt, onOpenCharts, onOpenScenarios, onOpenDashboard }) {
  const [status, setStatus] = useState({ loading: true });

  const refresh = async () => {
    setStatus({ loading: true });
    const [ignition, models, rag] = await Promise.allSettled([
      getIgnitionStatus(),
      getChatModels(),
      getRAGStats(),
    ]);
    setStatus({
      loading: false,
      ignition: ignition.status === 'fulfilled' ? ignition.value : null,
      models: models.status === 'fulfilled' ? (models.value.models || []) : [],
      rag: rag.status === 'fulfilled' ? rag.value : null,
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="h-full overflow-y-auto p-4 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Demo Readiness</h2>
              <p className="text-sm text-gray-500">Pre-flight checks and practical workflows for a live demonstration.</p>
            </div>
            <button
              onClick={refresh}
              disabled={status.loading}
              className="px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm transition-colors shadow-sm"
            >
              {status.loading ? 'Checking...' : 'Refresh'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            <CheckCard
              label="Ignition Gateway"
              ok={Boolean(status.ignition?.connected)}
              detail={status.ignition?.connected ? 'Connected' : 'Not connected'}
            />
            <CheckCard
              label="LLM Models"
              ok={(status.models || []).length > 0}
              detail={(status.models || []).length > 0 ? `${status.models.length} available` : 'No model found'}
            />
            <CheckCard
              label="RAG Documents"
              ok={Boolean(status.rag?.initialized)}
              detail={status.rag ? `${status.rag.documentCount || 0} chunks loaded` : 'Unavailable'}
            />
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Practical Usage Workflows</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRACTICAL_WORKFLOWS.map((item) => (
              <div key={item.title} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-sm font-semibold text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-500 mt-1 mb-3">{item.value}</div>
                <button
                  onClick={() => onOpenChatPrompt(item.prompt)}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
                >
                  Open in Chat
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Suggested Demo Flow (5-8 min)</h3>
          <div className="space-y-2 text-sm text-gray-700">
            <Step line="1. Show System tab for connectivity and available tools." />
            <Step line="2. Run a practical workflow prompt in AI Chat (Fault Detection)." />
            <Step line="3. Open Charts tab and trend MotorM12 tags for visual proof." />
            <Step line="4. Run Demo Scenarios tab to show repeatable business outcomes." />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => onOpenChatPrompt(PRACTICAL_WORKFLOWS[0].prompt)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm transition-colors"
            >
              Start in Chat
            </button>
            <button
              onClick={() => onOpenCharts([
                '[default]/DemoPlant/MotorM12/Temperature',
                '[default]/DemoPlant/MotorM12/Vibration',
                '[default]/DemoPlant/MotorM12/Speed',
              ], '-1h')}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm transition-colors"
            >
              Open Starter Charts
            </button>
            <button
              onClick={onOpenScenarios}
              className="px-3 py-2 bg-gray-700 hover:bg-gray-800 rounded-lg text-white text-sm transition-colors"
            >
              Run Scenarios
            </button>
            {onOpenDashboard && (
              <button
                onClick={onOpenDashboard}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm transition-colors"
              >
                Open Dashboard Builder
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function CheckCard({ label, ok, detail }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <div className="text-sm font-medium text-gray-900">{label}</div>
      <div className={`text-xs mt-1 ${ok ? 'text-green-700' : 'text-red-700'}`}>{detail}</div>
    </div>
  );
}

function Step({ line }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs bg-blue-100 text-blue-700">i</span>
      <span>{line}</span>
    </div>
  );
}
