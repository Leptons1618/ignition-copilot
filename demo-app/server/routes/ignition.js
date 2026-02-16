/**
 * Ignition proxy routes - Direct access to Ignition WebDev.
 */

import { Router } from 'express';
import ignition from '../services/ignition.js';

const router = Router();

// Connection test
router.get('/status', async (req, res) => {
  try {
    const connected = await ignition.testConnection();
    const info = connected ? await ignition.getSystemInfo().catch(() => null) : null;
    res.json({ connected, info });
  } catch (err) {
    res.json({ connected: false, error: err.message });
  }
});

// Browse tags
router.get('/browse', async (req, res) => {
  try {
    const { path = '[default]', recursive = 'false' } = req.query;
    const data = await ignition.browseTags(path, recursive === 'true');
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Read tags
router.get('/read', async (req, res) => {
  try {
    const { paths } = req.query;
    if (!paths) return res.status(400).json({ error: 'paths required' });
    const data = await ignition.readTags(paths);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Write tags
router.post('/write', async (req, res) => {
  try {
    const { writes } = req.body;
    if (!writes) return res.status(400).json({ error: 'writes array required' });
    const data = await ignition.writeTags(writes);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search tags
router.get('/search', async (req, res) => {
  try {
    const { pattern = '*', root = '[default]', tagType = '', max = '200' } = req.query;
    const data = await ignition.searchTags(pattern, root, tagType, parseInt(max));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query history
router.post('/history', async (req, res) => {
  try {
    const { paths, startTime = '-1h', endTime = '', returnSize = 500 } = req.body;
    if (!paths) return res.status(400).json({ error: 'paths required' });
    const data = await ignition.queryHistory(paths, startTime, endTime, returnSize);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Active alarms
router.get('/alarms', async (req, res) => {
  try {
    const { source = '', priority = '' } = req.query;
    const data = await ignition.getActiveAlarms(source, priority);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// System info
router.get('/system', async (req, res) => {
  try {
    const data = await ignition.getSystemInfo();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tag config
router.get('/tag-config', async (req, res) => {
  try {
    const { path } = req.query;
    if (!path) return res.status(400).json({ error: 'path required' });
    const data = await ignition.getTagConfig(path);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create tag
router.post('/create-tag', async (req, res) => {
  try {
    const { basePath, name, tagType, dataType, value } = req.body;
    if (!basePath || !name) return res.status(400).json({ error: 'basePath and name required' });
    const data = await ignition.createTag(basePath, name, tagType, dataType, value);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
