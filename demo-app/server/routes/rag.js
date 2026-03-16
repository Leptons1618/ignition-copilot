/**
 * RAG routes - Query Ignition documentation.
 */

import { Router } from 'express';
import { initRAG, searchDocs, getRAGStats } from '../services/rag.js';

const router = Router();

// Initialize RAG on first request or startup
let ragReady = false;
router.use(async (req, res, next) => {
  if (!ragReady) {
    try {
      await initRAG();
      ragReady = true;
    } catch (err) {
      console.warn('RAG init warning:', err.message);
      ragReady = true; // Don't block, just warn
    }
  }
  next();
});

// POST /api/rag/search - Search documentation
router.post('/search', async (req, res) => {
  try {
    const { query, topK = 5, minScore = -1, maxChars = 1000 } = req.body;
    if (!query) return res.status(400).json({ error: 'query required' });
    const started = Date.now();
    const results = await searchDocs(query, topK, { minScore, maxChars });
    if (Date.now() - started > 500) {
      console.warn('[rag:route] slow search', { query, ms: Date.now() - started });
    }
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/rag/stats - RAG system stats
router.get('/stats', (req, res) => {
  res.json(getRAGStats());
});

export default router;
