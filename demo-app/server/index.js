/**
 * Ignition Copilot Demo - Express server.
 * Provides chat, Ignition proxy, RAG, and charts APIs.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chatRoutes from './routes/chat.js';
import ignitionRoutes from './routes/ignition.js';
import ragRoutes from './routes/rag.js';
import chartRoutes from './routes/charts.js';
import scenarioRoutes from './routes/scenarios.js';
import dashboardRoutes from './routes/dashboard.js';
import insightsRoutes from './routes/insights.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const clientDist = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

app.use('/api/chat', chatRoutes);
app.use('/api/ignition', ignitionRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/charts', chartRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/insights', insightsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nIgnition Copilot Demo Server running on http://localhost:${PORT}`);
  console.log('Ignition Gateway: http://localhost:8088');
  console.log('Ollama: http://localhost:11434');
  console.log('React UI: http://localhost:3000 (dev mode)\n');
});
