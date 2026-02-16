/**
 * Chat routes for Ollama tool-calling.
 */

import { Router } from 'express';
import { chat, chatStream, listModels, TOOLS, getChatConfig, updateChatConfig } from '../services/ollama.js';

const router = Router();

/* SSE streaming chat endpoint */
router.post('/stream', async (req, res) => {
  try {
    const { messages, sessionId = 'default', options = {} } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event, data) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let closed = false;
    req.on('close', () => { closed = true; });

    for await (const event of chatStream(messages, { sessionId, ...options })) {
      if (closed) break;
      send(event.type, event.data);
    }

    if (!closed) res.end();
  } catch (err) {
    console.error('Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
      res.end();
    }
  }
});

router.post('/', async (req, res) => {
  try {
    const { messages, sessionId = 'default', options = {} } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    const result = await chat(messages, { sessionId, ...options });

    let chartData = null;
    for (const tc of result.toolCalls || []) {
      if (tc.tool === 'query_history' && tc.result?.data) {
        chartData = formatChartData(tc.result.data);
      }
    }

    res.json({
      content: result.content,
      toolCalls: result.toolCalls,
      chartData,
      model: result.model,
      perf: result.perf,
    });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/tools', (req, res) => {
  res.json({ tools: TOOLS.map(t => ({ name: t.function.name, description: t.function.description })) });
});

router.get('/models', async (req, res) => {
  try {
    const models = await listModels(req.query.url || null);
    res.json({ models: models.map(m => ({ name: m.name, size: m.size, family: m.details?.family })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/config', (req, res) => {
  res.json(getChatConfig());
});

router.post('/config', (req, res) => {
  try {
    const next = updateChatConfig(req.body || {});
    res.json(next);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

function formatChartData(historyData) {
  const series = [];
  for (const [tagPath, info] of Object.entries(historyData)) {
    const records = info.records || [];
    const tagName = tagPath.split('/').pop();
    series.push({
      name: tagName,
      fullPath: tagPath,
      data: records
        .filter(r => r.value !== null && r.value !== undefined)
        .map(r => ({
          timestamp: r.timestamp,
          value: typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0,
        })),
    });
  }
  return series.length > 0 ? { series, type: 'timeSeries' } : null;
}

export default router;
