/**
 * Ignition Project Management Routes.
 * Reads projects and views from the actual Ignition installation directory.
 * Supports browsing, editing, creating, and deleting Perspective views.
 */

import { Router } from 'express';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, sep, dirname } from 'path';

const router = Router();

// ─── Configuration ───────────────────────────────────────

const DEFAULT_IGNITION_DIRS = {
  win32: 'C:\\Program Files\\Inductive Automation\\Ignition',
  linux: '/usr/local/bin/ignition',
  darwin: '/usr/local/ignition',
};

let IGNITION_DIR = process.env.IGNITION_DIR
  || DEFAULT_IGNITION_DIRS[process.platform]
  || DEFAULT_IGNITION_DIRS.win32;

let PROJECTS_DIR = join(IGNITION_DIR, 'data', 'projects');
let GATEWAY_URL = process.env.IGNITION_URL || 'http://localhost:8088';

const PERSPECTIVE_MODULE = 'com.inductiveautomation.perspective';
const VISION_MODULE = 'com.inductiveautomation.vision';
const IGNITION_CORE = 'ignition';

// ─── Helpers ─────────────────────────────────────────────

function safePath(base, ...segments) {
  const resolved = join(base, ...segments);
  const rel = relative(base, resolved);
  if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
    throw new Error('Invalid path: directory traversal detected');
  }
  return resolved;
}

async function dirExists(dirPath) {
  try {
    return (await stat(dirPath)).isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeJsonSafe(filePath, data) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Recursively list Perspective views */
async function scanViews(viewsDir, prefix = '') {
  const views = [];
  try {
    const entries = await readdir(viewsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(viewsDir, entry.name);
      const viewPath = prefix ? `${prefix}/${entry.name}` : entry.name;

      const hasView = await fileExists(join(fullPath, 'view.json'));
      const hasMeta = await fileExists(join(fullPath, 'resource.json'));

      if (hasView) {
        const meta = hasMeta ? await readJsonSafe(join(fullPath, 'resource.json')) : null;
        const fileStat = await stat(join(fullPath, 'view.json')).catch(() => null);
        views.push({
          name: entry.name,
          path: viewPath,
          isView: true,
          lastModified: meta?.attributes?.lastModification?.timestamp || fileStat?.mtime?.toISOString(),
          modifiedBy: meta?.attributes?.lastModification?.actor || 'unknown',
        });
      }

      // Recurse into subdirectories
      const subViews = await scanViews(fullPath, viewPath);
      if (subViews.length > 0 && !hasView) {
        views.push({ name: entry.name, path: viewPath, isFolder: true, children: subViews.length });
      }
      views.push(...subViews);
    }
  } catch {}
  return views;
}

/** Recursively list scripts */
async function scanScripts(scriptsDir, prefix = '') {
  const scripts = [];
  try {
    const entries = await readdir(scriptsDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(scriptsDir, entry.name);
      const scriptPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (await fileExists(join(fullPath, 'code.py'))) {
          const fileStat = await stat(join(fullPath, 'code.py')).catch(() => null);
          scripts.push({ name: entry.name, path: scriptPath, type: 'package', lastModified: fileStat?.mtime?.toISOString() });
        }
        scripts.push(...await scanScripts(fullPath, scriptPath));
      } else if (entry.name.endsWith('.py')) {
        const fileStat = await stat(fullPath).catch(() => null);
        scripts.push({ name: entry.name, path: scriptPath, type: 'script', lastModified: fileStat?.mtime?.toISOString() });
      }
    }
  } catch {}
  return scripts;
}

/** Recursively list named queries */
async function scanNamedQueries(queriesDir, prefix = '') {
  const queries = [];
  try {
    const entries = await readdir(queriesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = join(queriesDir, entry.name);
      const queryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (await fileExists(join(fullPath, 'query.sql'))) {
        const fileStat = await stat(join(fullPath, 'query.sql')).catch(() => null);
        queries.push({ name: entry.name, path: queryPath, lastModified: fileStat?.mtime?.toISOString() });
      }
      queries.push(...await scanNamedQueries(fullPath, queryPath));
    }
  } catch {}
  return queries;
}

// ─── View Templates ──────────────────────────────────────

const VIEW_TEMPLATES = {
  blank: () => ({
    custom: {}, params: {}, props: {},
    root: {
      type: 'ia.container.flex', children: [],
      meta: { name: 'root' }, position: {},
      props: { direction: 'column' },
    },
  }),
  kpi: () => ({
    custom: {}, params: {}, props: {},
    root: {
      type: 'ia.container.flex',
      props: { direction: 'column', style: { gap: '16px', padding: '16px' } },
      meta: { name: 'root' }, position: {},
      children: [
        {
          type: 'ia.container.flex',
          props: { direction: 'row', justify: 'space-between', wrap: 'wrap', style: { gap: '12px' } },
          meta: { name: 'kpi-row' },
          children: Array.from({ length: 4 }, (_, i) => ({
            type: 'ia.display.label',
            props: {
              text: `KPI ${i + 1}`,
              style: { flex: '1 1 200px', padding: '16px', backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '24px', fontWeight: 'bold', textAlign: 'center' },
            },
            meta: { name: `kpi-${i + 1}` },
          })),
        },
        { type: 'ia.chart.easy-chart', props: { style: { height: '300px', backgroundColor: '#ffffff', borderRadius: '8px', padding: '12px' } }, meta: { name: 'trend-chart' } },
      ],
    },
  }),
  detail: () => ({
    custom: {}, params: { assetPath: '' }, props: {},
    root: {
      type: 'ia.container.flex',
      props: { direction: 'column', style: { gap: '12px', padding: '16px' } },
      meta: { name: 'root' }, position: {},
      children: [
        { type: 'ia.display.label', props: { text: 'Detail View', style: { fontSize: '20px', fontWeight: 'bold' } }, meta: { name: 'header' } },
        {
          type: 'ia.container.flex', props: { direction: 'row', style: { gap: '12px' } }, meta: { name: 'content-row' },
          children: [
            { type: 'ia.container.flex', props: { direction: 'column', style: { flex: '1' } }, meta: { name: 'properties-panel' }, children: [] },
            { type: 'ia.chart.easy-chart', props: { style: { flex: '2', height: '300px' } }, meta: { name: 'chart' } },
          ],
        },
      ],
    },
  }),
  alarm: () => ({
    custom: {}, params: { alarmSource: '' }, props: {},
    root: {
      type: 'ia.container.flex',
      props: { direction: 'column', style: { gap: '12px', padding: '16px' } },
      meta: { name: 'root' }, position: {},
      children: [
        { type: 'ia.display.label', props: { text: 'Alarm Overview', style: { fontSize: '20px', fontWeight: 'bold' } }, meta: { name: 'header' } },
        { type: 'ia.alarm.status-table', props: { style: { flex: '1', minHeight: '400px' } }, meta: { name: 'alarm-table' } },
      ],
    },
  }),
  navigation: () => ({
    custom: {}, params: {}, props: {},
    root: {
      type: 'ia.container.flex',
      props: { direction: 'column', style: { height: '100%', backgroundColor: '#1e293b' } },
      meta: { name: 'root' }, position: {},
      children: [
        { type: 'ia.display.label', props: { text: 'Navigation', style: { color: '#fff', padding: '16px', fontSize: '18px', fontWeight: 'bold' } }, meta: { name: 'nav-header' } },
        {
          type: 'ia.container.flex', props: { direction: 'column', style: { gap: '4px', padding: '8px' } }, meta: { name: 'nav-links' },
          children: [
            { type: 'ia.navigation.link', props: { text: 'Home', href: '/home', style: { color: '#94a3b8', padding: '8px 12px' } }, meta: { name: 'link-home' } },
            { type: 'ia.navigation.link', props: { text: 'Dashboard', href: '/dashboard', style: { color: '#94a3b8', padding: '8px 12px' } }, meta: { name: 'link-dashboard' } },
          ],
        },
      ],
    },
  }),
};

// ─── Routes ──────────────────────────────────────────────

/** Get / update Ignition directory configuration */
router.get('/config', (req, res) => {
  res.json({ ignitionDir: IGNITION_DIR, projectsDir: PROJECTS_DIR, gatewayUrl: GATEWAY_URL, exists: existsSync(PROJECTS_DIR) });
});

router.post('/config', (req, res) => {
  const { ignitionDir, gatewayUrl } = req.body;
  if (ignitionDir) {
    IGNITION_DIR = ignitionDir;
    PROJECTS_DIR = join(IGNITION_DIR, 'data', 'projects');
  }
  if (gatewayUrl) GATEWAY_URL = gatewayUrl;
  console.log(`[projects] Config updated — dir: ${IGNITION_DIR}, gateway: ${GATEWAY_URL}`);
  res.json({ ignitionDir: IGNITION_DIR, projectsDir: PROJECTS_DIR, gatewayUrl: GATEWAY_URL, exists: existsSync(PROJECTS_DIR) });
});

/** List all projects */
router.get('/', async (req, res) => {
  try {
    const exists = await dirExists(PROJECTS_DIR);
    if (!exists) {
      return res.json({
        success: true, projects: [], ignitionDir: IGNITION_DIR, gatewayUrl: GATEWAY_URL, exists: false,
        message: `Ignition projects directory not found at ${PROJECTS_DIR}. Update the path in settings.`,
      });
    }
    const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projectDir = join(PROJECTS_DIR, entry.name);
      const meta = await readJsonSafe(join(projectDir, 'project.json'));
      projects.push({
        name: entry.name,
        title: meta?.title || entry.name,
        description: meta?.description || '',
        enabled: meta?.enabled ?? true,
        inheritable: meta?.inheritable ?? false,
        parent: meta?.parent || '',
        hasPerspective: await dirExists(join(projectDir, PERSPECTIVE_MODULE)),
        hasVision: await dirExists(join(projectDir, VISION_MODULE)),
        hasScripts: await dirExists(join(projectDir, IGNITION_CORE, 'script-python')),
        hasNamedQueries: await dirExists(join(projectDir, IGNITION_CORE, 'named-query')),
      });
    }
    res.json({ success: true, projects, ignitionDir: IGNITION_DIR, gatewayUrl: GATEWAY_URL, exists: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Get project details with resource counts */
router.get('/:project', async (req, res) => {
  try {
    const projectDir = safePath(PROJECTS_DIR, req.params.project);
    if (!await dirExists(projectDir)) return res.status(404).json({ success: false, error: 'Project not found' });
    const meta = await readJsonSafe(join(projectDir, 'project.json')) || {};
    const viewsDir = join(projectDir, PERSPECTIVE_MODULE, 'views');
    const views = await dirExists(viewsDir) ? await scanViews(viewsDir) : [];
    const scriptsDir = join(projectDir, IGNITION_CORE, 'script-python');
    const scripts = await dirExists(scriptsDir) ? await scanScripts(scriptsDir) : [];
    const queriesDir = join(projectDir, IGNITION_CORE, 'named-query');
    const queries = await dirExists(queriesDir) ? await scanNamedQueries(queriesDir) : [];
    res.json({
      success: true,
      project: { name: req.params.project, ...meta, viewCount: views.filter(v => v.isView).length, scriptCount: scripts.length, queryCount: queries.length },
      perspectiveUrl: `${GATEWAY_URL}/data/perspective/client/${req.params.project}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** List Perspective views */
router.get('/:project/views', async (req, res) => {
  try {
    const viewsDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views');
    if (!await dirExists(viewsDir)) return res.json({ success: true, views: [] });
    const views = await scanViews(viewsDir);
    res.json({
      success: true, views,
      perspectiveUrl: `${GATEWAY_URL}/data/perspective/client/${req.params.project}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Read a specific view */
router.get('/:project/view', async (req, res) => {
  try {
    const viewPath = req.query.path;
    if (!viewPath) return res.status(400).json({ success: false, error: 'path query parameter required' });
    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', viewPath);
    if (!await dirExists(viewDir)) return res.status(404).json({ success: false, error: 'View not found' });
    const viewJsonPath = join(viewDir, 'view.json');
    if (!await fileExists(viewJsonPath)) return res.status(404).json({ success: false, error: 'view.json not found' });
    const content = await readJsonSafe(viewJsonPath);
    const meta = await readJsonSafe(join(viewDir, 'resource.json'));
    res.json({ success: true, path: viewPath, content, meta });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Update a view */
router.put('/:project/view', async (req, res) => {
  try {
    const { path: viewPath, content } = req.body;
    if (!viewPath || content === undefined) return res.status(400).json({ success: false, error: 'path and content required' });
    if (typeof content !== 'object' || !content.root) return res.status(400).json({ success: false, error: 'Invalid view: must have a root property' });
    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', viewPath);
    await writeJsonSafe(join(viewDir, 'view.json'), content);
    const resourcePath = join(viewDir, 'resource.json');
    const meta = await readJsonSafe(resourcePath) || { scope: 'G', version: 1, restricted: false, overridable: true, files: ['view.json'] };
    meta.attributes = meta.attributes || {};
    meta.attributes.lastModification = { actor: 'copilot', timestamp: new Date().toISOString() };
    await writeJsonSafe(resourcePath, meta);
    console.log(`[projects] Updated view ${viewPath} in ${req.params.project}`);
    res.json({ success: true, message: 'View updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Create a new view */
router.post('/:project/views', async (req, res) => {
  try {
    const { name, template = 'blank' } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'View name required' });
    const sanitized = name.trim().replace(/[^a-zA-Z0-9_/\-]/g, '');
    if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid view name' });
    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sanitized);
    if (await dirExists(viewDir)) return res.status(409).json({ success: false, error: 'View already exists' });
    await mkdir(viewDir, { recursive: true });
    const templateFn = VIEW_TEMPLATES[template] || VIEW_TEMPLATES.blank;
    await writeJsonSafe(join(viewDir, 'view.json'), templateFn());
    await writeJsonSafe(join(viewDir, 'resource.json'), {
      scope: 'G', version: 1, restricted: false, overridable: true, files: ['view.json'],
      attributes: { lastModification: { actor: 'copilot', timestamp: new Date().toISOString() } },
    });
    console.log(`[projects] Created view ${sanitized} in ${req.params.project}`);
    res.json({ success: true, name: sanitized, message: 'View created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Delete a view */
router.delete('/:project/view', async (req, res) => {
  try {
    const viewPath = req.query.path || req.body?.path;
    if (!viewPath) return res.status(400).json({ success: false, error: 'path required' });
    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', viewPath);
    if (!await dirExists(viewDir)) return res.status(404).json({ success: false, error: 'View not found' });
    await rm(viewDir, { recursive: true, force: true });
    console.log(`[projects] Deleted view ${viewPath} from ${req.params.project}`);
    res.json({ success: true, message: 'View deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** List scripts */
router.get('/:project/scripts', async (req, res) => {
  try {
    const scriptsDir = safePath(PROJECTS_DIR, req.params.project, IGNITION_CORE, 'script-python');
    if (!await dirExists(scriptsDir)) return res.json({ success: true, scripts: [] });
    res.json({ success: true, scripts: await scanScripts(scriptsDir) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Read a script */
router.get('/:project/script', async (req, res) => {
  try {
    const scriptPath = req.query.path;
    if (!scriptPath) return res.status(400).json({ success: false, error: 'path required' });
    const scriptsDir = safePath(PROJECTS_DIR, req.params.project, IGNITION_CORE, 'script-python');
    const packagePy = join(scriptsDir, scriptPath, 'code.py');
    const directFile = join(scriptsDir, scriptPath);
    let content;
    if (await fileExists(packagePy)) {
      content = await readFile(packagePy, 'utf-8');
    } else if (await fileExists(directFile)) {
      content = await readFile(directFile, 'utf-8');
    } else {
      return res.status(404).json({ success: false, error: 'Script not found' });
    }
    res.json({ success: true, path: scriptPath, content, language: 'python' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** List named queries */
router.get('/:project/named-queries', async (req, res) => {
  try {
    const queriesDir = safePath(PROJECTS_DIR, req.params.project, IGNITION_CORE, 'named-query');
    if (!await dirExists(queriesDir)) return res.json({ success: true, queries: [] });
    res.json({ success: true, queries: await scanNamedQueries(queriesDir) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
