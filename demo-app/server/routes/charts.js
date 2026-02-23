/**
 * Chart routes - Dynamic chart data generation.
 */

import { Router } from 'express';
import ignition from '../services/ignition.js';

const router = Router();

// POST /api/charts/timeseries - Get chart-ready time series data
router.post('/timeseries', async (req, res) => {
  try {
    const { paths, startTime = '-1h', endTime = '', returnSize = 500 } = req.body;
    if (!paths || paths.length === 0) {
      return res.status(400).json({ error: 'paths array required' });
    }

    const historyData = await ignition.queryHistory(paths, startTime, endTime, returnSize);

    // Format for chart rendering
    const series = [];
    const stats = {};

    for (const [tagPath, info] of Object.entries(historyData?.data || historyData || {})) {
      const records = (info.records || []).filter(r => r.value !== null && r.value !== undefined);
      const tagName = tagPath.split('/').pop();
      const values = records.map(r => typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0);

      series.push({
        name: tagName,
        fullPath: tagPath,
        data: records.map(r => ({
          x: r.timestamp,
          y: typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0,
        })),
        stats: values.length > 0 ? {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
          count: values.length,
          current: values[values.length - 1],
        } : null,
      });

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        stats[tagName] = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(avg * 100) / 100,
          count: values.length,
          current: values[values.length - 1],
        };
      }
    }

    res.json({ series, stats, timeRange: { startTime, endTime: endTime || 'now' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/charts/compare - Compare multiple tags
router.post('/compare', async (req, res) => {
  try {
    const { paths, startTime = '-1h', endTime = '' } = req.body;
    if (!paths || paths.length < 2) {
      return res.status(400).json({ error: 'At least 2 paths required for comparison' });
    }

    const historyData = await ignition.queryHistory(paths, startTime, endTime, 500);

    const comparison = {};
    for (const [tagPath, info] of Object.entries(historyData?.data || historyData || {})) {
      const records = (info.records || []).filter(r => r.value !== null);
      const values = records.map(r => typeof r.value === 'number' ? r.value : parseFloat(r.value) || 0);
      const tagName = tagPath.split('/').pop();

      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const mid = Math.floor(values.length / 2);
        const firstHalfAvg = values.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
        const secondHalfAvg = values.slice(mid).reduce((a, b) => a + b, 0) / (values.length - mid);
        const trend = secondHalfAvg > firstHalfAvg + 0.01 ? 'increasing'
          : secondHalfAvg < firstHalfAvg - 0.01 ? 'decreasing' : 'stable';

        comparison[tagName] = {
          fullPath: tagPath,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: Math.round(avg * 100) / 100,
          range: Math.max(...values) - Math.min(...values),
          trend,
          dataPoints: values.length,
        };
      }
    }

    res.json({ comparison, timeRange: { startTime, endTime: endTime || 'now' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/charts/live - Get current values for live dashboard
router.get('/live', async (req, res) => {
  try {
    const { paths } = req.query;
    if (!paths) return res.status(400).json({ error: 'paths required' });
    const pathList = paths.split(',');
    const data = await ignition.readTags(pathList);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
