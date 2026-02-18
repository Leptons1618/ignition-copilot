/**
 * Ignition Copilot Demo - Express server.
 * Provides chat, Ignition proxy, RAG, charts, project management, search, and logging APIs.
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
import configRoutes from './routes/config.js';
import projectRoutes from './routes/projects.js';
import searchRoutes, { logRoutes } from './routes/search.js';
import { requestLogger } from './middleware/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

const clientDist = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));

// API routes
app.use('/api/chat', chatRoutes);
app.use('/api/ignition', ignitionRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/charts', chartRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/config', configRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/logs', logRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`[error] ${req.method} ${req.url}:`, err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    path: req.originalUrl,
  });
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
