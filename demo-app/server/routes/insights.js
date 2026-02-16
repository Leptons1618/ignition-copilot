/**
 * Insights routes for asset health and alarm summary.
 */

import { Router } from 'express';
import { getAssetHealth, summarizeAlarms } from '../services/insights.js';

const router = Router();

router.get('/asset-health', async (req, res) => {
  try {
    const assetPath = req.query.assetPath || '[default]/DemoPlant/MotorM12';
    const data = await getAssetHealth(assetPath);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/alarm-summary', async (req, res) => {
  try {
    const startTime = req.query.startTime || '-24h';
    const priority = req.query.priority || '';
    const data = await summarizeAlarms(startTime, priority);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
