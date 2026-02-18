/**
 * Search and logging routes.
 * Provides global search across tags, projects, docs, and event ingestion.
 */

import { Router } from 'express';
import ignition from '../services/ignition.js';
import { searchDocs } from '../services/rag.js';
import { getRecentLogs, storeFrontendEvents, getFrontendEvents } from '../middleware/logger.js';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECTS_DIR = process.env.IGNITION_PROJECTS_DIR
  || join(__dirname, '..', 'data', 'projects');

const router = Router();

/* ─── Global Search ───────────────────────────────────── */

router.get('/', async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.json({ results: [] });
  }

  const results = [];
  const pattern = query.toLowerCase();

  // 1. Search tags
  try {
    const tagResult = await ignition.searchTags(`*${query}*`, '[default]', '', 20);
    for (const tag of (tagResult.matches || []).slice(0, 10)) {
      results.push({
        type: 'tag',
        name: tag.name || tag.fullPath,
        path: tag.fullPath || tag.path || tag.name,
        description: `${tag.dataType || tag.tagType || 'Tag'} — ${tag.fullPath || ''}`,
      });
    }
  } catch {}

  // 2. Search project resources (views, scripts)
  try {
    if (existsSync(PROJECTS_DIR)) {
      const projects = await readdir(PROJECTS_DIR, { withFileTypes: true });
      for (const proj of projects) {
        if (!proj.isDirectory()) continue;
        const viewsDir = join(PROJECTS_DIR, proj.name, 'views');
        if (existsSync(viewsDir)) {
          await searchDir(viewsDir, '', pattern, 'view', proj.name, results);
        }
        const scriptsDir = join(PROJECTS_DIR, proj.name, 'scripts');
        if (existsSync(scriptsDir)) {
          await searchDir(scriptsDir, '', pattern, 'script', proj.name, results);
        }
      }
    }
  } catch {}

  // 3. Search docs
  try {
    const docs = await searchDocs(query, 5);
    for (const doc of (docs.results || []).slice(0, 5)) {
      results.push({
        type: 'doc',
        name: doc.source || 'Documentation',
        path: doc.source,
        description: (doc.text || '').slice(0, 100),
      });
    }
  } catch {}

  res.json({ results: results.slice(0, 20) });
});

async function searchDir(dir, prefix, pattern, type, projectName, results) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.name.toLowerCase().includes(pattern)) {
        results.push({
          type,
          name: entry.name,
          path: relPath,
          description: `${projectName} / ${type} / ${relPath}`,
          project: projectName,
        });
      }
      if (entry.isDirectory() && results.length < 20) {
        await searchDir(join(dir, entry.name), relPath, pattern, type, projectName, results);
      }
    }
  } catch {}
}

export default router;

/* ─── Logging endpoints (mounted separately) ──────────── */

export const logRoutes = Router();

/** Receive frontend events */
logRoutes.post('/events', (req, res) => {
  const events = req.body?.events;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: 'events array required' });
  }
  storeFrontendEvents(events);
  res.json({ success: true, received: events.length });
});

/** Get recent API request logs */
logRoutes.get('/requests', (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 50, 200);
  res.json({ logs: getRecentLogs(count) });
});

/** Get recent frontend events */
logRoutes.get('/frontend', (req, res) => {
  const count = Math.min(parseInt(req.query.count) || 50, 200);
  res.json({ events: getFrontendEvents(count) });
});
