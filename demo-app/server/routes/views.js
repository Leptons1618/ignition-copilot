/**
 * View builder routes — create, edit, list, and AI-generate Perspective views.
 *
 * Routes:
 *   GET    /api/views              — list all views
 *   GET    /api/views/:path(*)     — read a view
 *   POST   /api/views              — create a new view
 *   PUT    /api/views/:path(*)     — update existing view
 *   DELETE /api/views/:path(*)     — delete a view
 *   POST   /api/views/validate     — validate a view
 *   POST   /api/views/generate     — AI-generate a dashboard from tags
 */

import { Router } from 'express';
import * as viewBuilder from '../services/view-builder.js';
import ignition from '../services/ignition.js';

const router = Router();

/* List all views */
router.get('/', async (req, res) => {
  try {
    const result = await viewBuilder.listViews();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Validate a view */
router.post('/validate', async (req, res) => {
  try {
    const { viewPath } = req.body;
    if (!viewPath) return res.status(400).json({ error: 'viewPath required' });
    const result = await viewBuilder.validateView(viewPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* AI-generate a dashboard from tags */
router.post('/generate', async (req, res) => {
  try {
    const { viewName, tagPaths, title, columns, autoCreate } = req.body;
    if (!viewName) return res.status(400).json({ error: 'viewName required' });

    // Resolve tags — either from provided paths or browse all
    let tags = [];
    if (tagPaths && tagPaths.length > 0) {
      // Read tag values & metadata for the given paths
      try {
        const readResult = await ignition.readTags(tagPaths);
        const results = readResult.results || readResult || [];
        tags = (Array.isArray(results) ? results : []).map((r, i) => ({
          path: tagPaths[i],
          name: tagPaths[i].split('/').pop(),
          dataType: r.dataType || r.type || 'Float4',
          value: r.value,
        }));
      } catch {
        // Fallback: just use the paths without metadata
        tags = tagPaths.map(p => ({
          path: p,
          name: p.split('/').pop(),
          dataType: 'Float4',
          value: 0,
        }));
      }
    } else {
      // Browse tags from default provider
      try {
        const browseResult = await ignition.browseTags('[default]', true);
        const allTags = browseResult.tags || browseResult || [];
        tags = allTags
          .filter(t => t.tagType !== 'Folder' && t.tagType !== 'UdtType')
          .slice(0, 20) // Limit to 20 tags for dashboard
          .map(t => ({
            path: t.fullPath || t.path,
            name: t.name,
            dataType: t.dataType || 'Float4',
            value: t.value,
          }));
      } catch {
        return res.status(400).json({ error: 'No tagPaths provided and unable to browse tags' });
      }
    }

    if (tags.length === 0) {
      return res.status(400).json({ error: 'No tags found to generate dashboard' });
    }

    // Generate the view JSON
    const viewJson = viewBuilder.generateDashboardView(viewName, tags, { title, columns });

    // Optionally write it to the project filesystem
    if (autoCreate !== false) {
      try {
        const result = await viewBuilder.createView(viewName, viewJson);
        return res.json({
          ...result,
          viewJson,
          tags: tags.map(t => t.path),
          note: 'View created on disk. Ignition will pick it up on next project scan or designer save.',
        });
      } catch (err) {
        // If filesystem write fails, still return the JSON
        return res.json({
          status: 'generated',
          viewJson,
          tags: tags.map(t => t.path),
          writeError: err.message,
          note: 'View JSON generated but could not write to disk. Check IGNITION_PROJECT_PATH.',
        });
      }
    }

    res.json({ status: 'generated', viewJson, tags: tags.map(t => t.path) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Read a view */
router.get('/*', async (req, res) => {
  try {
    const viewPath = req.params[0];
    if (!viewPath) return res.status(400).json({ error: 'view path required' });
    const data = await viewBuilder.getView(viewPath);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/* Create a new view */
router.post('/', async (req, res) => {
  try {
    const { viewPath, viewJson } = req.body;
    if (!viewPath || !viewJson) return res.status(400).json({ error: 'viewPath and viewJson required' });
    const result = await viewBuilder.createView(viewPath, viewJson);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Update existing view */
router.put('/*', async (req, res) => {
  try {
    const viewPath = req.params[0];
    const { viewJson, backup } = req.body;
    if (!viewPath || !viewJson) return res.status(400).json({ error: 'viewPath and viewJson required' });
    const result = await viewBuilder.updateView(viewPath, viewJson, backup !== false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* Delete a view */
router.delete('/*', async (req, res) => {
  try {
    const viewPath = req.params[0];
    if (!viewPath) return res.status(400).json({ error: 'view path required' });
    const result = await viewBuilder.deleteView(viewPath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
