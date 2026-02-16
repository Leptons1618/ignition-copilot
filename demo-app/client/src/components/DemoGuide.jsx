import React, { useEffect, useState } from 'react';
import {
  Compass, RefreshCw, CheckCircle2, XCircle, MessageSquare, LineChart,
  PlaySquare, LayoutDashboard, AlertTriangle, Zap, Wrench, BookOpen,
} from 'lucide-react';
import { getIgnitionStatus, getChatModels, getRAGStats } from '../api.js';
import Button from './ui/Button.jsx';
import Badge from './ui/Badge.jsx';
import LoadingSpinner from './ui/LoadingSpinner.jsx';

const PRACTICAL_WORKFLOWS = [
  {
    title: 'Fault Detection',
    icon: AlertTriangle,
    value: 'Spot anomalies and warn before a trip.',
    prompt: 'Read MotorM12 values for temperature, speed, vibration, load, and current. Identify any anomalies and likely causes.',
  },
  {
    title: 'Predictive Maintenance',
    icon: Zap,
    value: 'Use trends to plan maintenance windows.',
    prompt: 'Query the last 1 hour history for MotorM12 temperature, vibration, and speed. Summarize trend risk and recommended maintenance.',
  },
  {
    title: 'Operator Support',
    icon: Wrench,
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
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Compass size={22} className="text-blue-600" />
                Demo Readiness
              </h2>
              <p className="text-sm text-gray-500">Pre-flight checks and practical workflows for a live demonstration.</p>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} disabled={status.loading}>
              {status.loading ? <LoadingSpinner size={14} /> : <RefreshCw size={14} />}
              {status.loading ? 'Checking...' : 'Refresh'}
            </Button>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpen size={18} className="text-blue-600" />
            Practical Usage Workflows
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRACTICAL_WORKFLOWS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="border border-gray-200 rounded-lg p-4 bg-gray-50 hover:border-gray-300 transition-colors">
                  <div className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    <Icon size={15} className="text-blue-600" />
                    {item.title}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 mb-3">{item.value}</div>
                  <Button variant="primary" size="sm" className="w-full" onClick={() => onOpenChatPrompt(item.prompt)}>
                    <MessageSquare size={14} /> Open in Chat
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <PlaySquare size={18} className="text-blue-600" />
            Suggested Demo Flow (5-8 min)
          </h3>
          <div className="space-y-2 text-sm text-gray-700">
            <Step num="1" line="Show System tab for connectivity and available tools." />
            <Step num="2" line="Run a practical workflow prompt in AI Chat (Fault Detection)." />
            <Step num="3" line="Open Charts tab and trend MotorM12 tags for visual proof." />
            <Step num="4" line="Run Demo Scenarios tab to show repeatable business outcomes." />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="primary" size="sm" onClick={() => onOpenChatPrompt(PRACTICAL_WORKFLOWS[0].prompt)}>
              <MessageSquare size={14} /> Start in Chat
            </Button>
            <Button variant="success" size="sm" onClick={() => onOpenCharts([
                '[default]/DemoPlant/MotorM12/Temperature',
                '[default]/DemoPlant/MotorM12/Vibration',
                '[default]/DemoPlant/MotorM12/Speed',
              ], '-1h')}>
              <LineChart size={14} /> Open Starter Charts
            </Button>
            <Button variant="secondary" size="sm" onClick={onOpenScenarios}>
              <PlaySquare size={14} /> Run Scenarios
            </Button>
            {onOpenDashboard && (
              <Button variant="outline" size="sm" onClick={onOpenDashboard}>
                <LayoutDashboard size={14} /> Open Dashboard Builder
              </Button>
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
      <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
        {ok ? <CheckCircle2 size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-600" />}
        {label}
      </div>
      <div className={`text-xs mt-1 ${ok ? 'text-green-700' : 'text-red-700'}`}>{detail}</div>
    </div>
  );
}

function Step({ num, line }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs bg-blue-100 text-blue-700 font-semibold shrink-0">
        {num}
      </span>
      <span>{line}</span>
    </div>
  );
}
