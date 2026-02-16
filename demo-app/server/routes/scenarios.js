/**
 * Demo scenario routes.
 */

import { Router } from 'express';
import { chat } from '../services/ollama.js';

const router = Router();

const SCENARIOS = [
  {
    id: 'fault-detection',
    title: 'Intelligent Fault Detection',
    description: 'AI automatically detects anomalies in motor parameters and suggests root causes.',
    category: 'Operations',
    businessValue: 'Reduces unplanned downtime by 40%, saves $50K+/year per production line.',
    icon: 'FD',
    demoPrompt: 'Read all the motor M12 tags and analyze the current operating conditions. Are there any anomalies or potential issues? Check temperature, speed, vibration, load, and current values.',
  },
  {
    id: 'predictive-maintenance',
    title: 'Predictive Maintenance',
    description: 'Analyze historical trends to predict equipment failures before they happen.',
    category: 'Maintenance',
    businessValue: 'Increases equipment lifespan by 25%, reduces maintenance costs by 30%.',
    icon: 'PM',
    demoPrompt: 'Query the last 1 hour of history for Temperature, Vibration, and Speed of MotorM12. Analyze trends and identify whether parameters are moving toward critical thresholds. Recommend maintenance actions.',
  },
  {
    id: 'rapid-commissioning',
    title: 'Rapid Tag and Project Setup',
    description: 'AI creates tags, configures alarms, and sets up monitoring in minutes.',
    category: 'Engineering',
    businessValue: 'Reduces commissioning time by 60%, accelerates project delivery.',
    icon: 'RC',
    demoPrompt: 'Set up monitoring for a new pump station. Browse the current tag structure, then create folder [default]DemoPlant/PumpStation1 with tags FlowRate (Float8), Pressure (Float8), RunStatus (Boolean), and MotorCurrent (Float8). Set initial values.',
  },
  {
    id: 'operator-support',
    title: 'L1/L2 Operator Support',
    description: 'AI assistant helps operators troubleshoot issues using documentation and live data.',
    category: 'Support',
    businessValue: 'Reduces mean-time-to-resolution by 50% and supports junior operators.',
    icon: 'OS',
    demoPrompt: 'MotorM12 temperature is high. Provide step-by-step troubleshooting guidance based on current sensor readings and Ignition best practices.',
  },
  {
    id: 'smart-reporting',
    title: 'Smart Data Analysis and Reporting',
    description: 'AI generates insights from historical data, identifies patterns, and creates summaries.',
    category: 'Management',
    businessValue: 'Saves 10+ hours per week in manual reporting and provides real-time insights.',
    icon: 'SR',
    demoPrompt: 'Provide a comprehensive analysis of MotorM12 performance. Query history for available parameters, compare trends, identify correlations, and provide an executive summary with recommendations.',
  },
  {
    id: 'system-health',
    title: 'Gateway Health Monitor',
    description: 'AI monitors Ignition Gateway health and recommends optimizations.',
    category: 'IT/OT',
    businessValue: 'Prevents system outages and improves overall equipment effectiveness.',
    icon: 'SH',
    demoPrompt: 'Check Ignition Gateway system health. Get system info, CPU and memory usage, tag providers, and active alarms. Provide health assessment and recommendations.',
  },
];

router.get('/', (req, res) => {
  res.json({
    scenarios: SCENARIOS.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category,
      businessValue: s.businessValue,
      icon: s.icon,
    })),
  });
});

router.post('/run/:id', async (req, res) => {
  const scenario = SCENARIOS.find(s => s.id === req.params.id);
  if (!scenario) return res.status(404).json({ error: 'Scenario not found' });

  try {
    const startedAt = Date.now();
    const result = await chat([{ role: 'user', content: scenario.demoPrompt }], { sessionId: `scenario-${scenario.id}` });

    let chartData = null;
    for (const tc of result.toolCalls || []) {
      if (tc.tool === 'query_history' && tc.result?.data) {
        chartData = formatChartData(tc.result.data);
      }
    }

    res.json({
      success: true,
      scenario: { id: scenario.id, title: scenario.title },
      content: result.content,
      response: result.content,
      toolCalls: result.toolCalls,
      chartData,
      model: result.model,
      duration: Date.now() - startedAt,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, scenario: scenario.id });
  }
});

function formatChartData(historyData) {
  const series = [];
  for (const [tagPath, info] of Object.entries(historyData)) {
    const records = (info.records || []).filter(r => r.value !== null);
    series.push({
      name: tagPath.split('/').pop(),
      fullPath: tagPath,
      data: records.map(r => ({
        timestamp: r.timestamp,
        value: typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0,
      })),
    });
  }
  return series.length > 0 ? { series, type: 'timeSeries' } : null;
}

export default router;
