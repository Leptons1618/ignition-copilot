/**
 * Ignition Project Management Routes.
 * Reads projects and views from the actual Ignition installation directory.
 * Supports browsing, editing, creating, and deleting Perspective views.
 */

import { Router } from 'express';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, sep, dirname } from 'path';
import { createHash } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { chat as llmChat } from '../services/ollama.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

/** Ignition can't parse ISO timestamps with milliseconds — strip them. */
function ignitionTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Notify the Ignition Gateway that a project resource has changed.
 * Touches project.json to trigger the file watcher and calls requestProjectScan.
 */
async function notifyProjectChanged(projectName) {
  try {
    const projectJsonPath = join(PROJECTS_DIR, projectName, 'project.json');
    const meta = await readJsonSafe(projectJsonPath);
    if (meta) {
      meta.lastModified = ignitionTimestamp();
      await writeFile(projectJsonPath, JSON.stringify(meta, null, 2), 'utf-8');
      console.log(`[projects] Notified Gateway — touched project.json for ${projectName}`);
    }
  } catch (err) {
    console.warn(`[projects] Could not touch project.json: ${err.message}`);
  }
  // Trigger Gateway project scan via WebDev GET endpoint (calls system.util.requestProjectScan inside Gateway)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(`${GATEWAY_URL}/system/webdev/${projectName}/project_scan`, {
      signal: controller.signal,
    }).then(r => {
      if (r.ok) console.log(`[projects] Triggered requestProjectScan via WebDev`);
      else console.warn(`[projects] WebDev project_scan returned ${r.status}`);
    }).catch(() => null);
    clearTimeout(timer);
  } catch {}
}

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

/**
 * Register a view in the Perspective page-config so it gets a routable URL.
 * Adds an entry like: { "/ViewPath": { "viewPath": "ViewPath" } }
 */
async function registerPageRoute(projectName, viewPath) {
  try {
    const configPath = safePath(PROJECTS_DIR, projectName, PERSPECTIVE_MODULE, 'page-config', 'config.json');
    const config = await readJsonSafe(configPath) || { pages: {}, sharedDocks: { cornerPriority: 'top-bottom' } };
    if (!config.pages) config.pages = {};
    const urlKey = '/' + viewPath;
    if (!config.pages[urlKey]) {
      config.pages[urlKey] = {
        mounts: {
          center: { viewPath }
        }
      };
      await writeJsonSafe(configPath, config);
      await touchResourceJson(join(dirname(configPath), 'resource.json'));
      console.log(`[projects] Registered page route ${urlKey} → ${viewPath}`);
    }
  } catch (err) {
    console.warn(`[projects] Could not register page route: ${err.message}`);
  }
}

/**
 * Unregister a view from the Perspective page-config.
 */
async function unregisterPageRoute(projectName, viewPath) {
  try {
    const configPath = safePath(PROJECTS_DIR, projectName, PERSPECTIVE_MODULE, 'page-config', 'config.json');
    const config = await readJsonSafe(configPath);
    if (!config?.pages) return;
    const urlKey = '/' + viewPath;
    if (config.pages[urlKey]) {
      delete config.pages[urlKey];
      await writeJsonSafe(configPath, config);
      await touchResourceJson(join(dirname(configPath), 'resource.json'));
      console.log(`[projects] Unregistered page route ${urlKey}`);
    }
  } catch (err) {
    console.warn(`[projects] Could not unregister page route: ${err.message}`);
  }
}

/**
 * Touch a resource.json — update timestamp and generate a lastModificationSignature
 * so the Gateway's file-change detection picks up the change.
 */
async function touchResourceJson(resourcePath) {
  try {
    const meta = await readJsonSafe(resourcePath);
    if (!meta) return;
    meta.attributes = meta.attributes || {};
    meta.attributes.lastModification = { actor: 'copilot', timestamp: ignitionTimestamp() };
    // Generate a signature from the sibling data files so the Gateway sees a change
    const dir = dirname(resourcePath);
    const files = meta.files || [];
    let content = '';
    for (const f of files) {
      try { content += await readFile(join(dir, f), 'utf-8'); } catch {}
    }
    if (content) {
      meta.attributes.lastModificationSignature = createHash('sha256').update(content).digest('hex');
    }
    await writeJsonSafe(resourcePath, meta);
  } catch {}
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
      // Skip internal/hidden directories like .resources
      if (entry.name.startsWith('.')) continue;
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
    meta.attributes.lastModification = { actor: 'copilot', timestamp: ignitionTimestamp() };
    await writeJsonSafe(resourcePath, meta);
    await notifyProjectChanged(req.params.project);
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
    const viewJson = templateFn();
    const viewStr = JSON.stringify(viewJson, null, 2);
    await writeJsonSafe(join(viewDir, 'view.json'), viewJson);
    await writeJsonSafe(join(viewDir, 'resource.json'), {
      scope: 'G', version: 1, restricted: false, overridable: true, files: ['view.json'],
      attributes: {
        lastModification: { actor: 'copilot', timestamp: ignitionTimestamp() },
        lastModificationSignature: createHash('sha256').update(viewStr).digest('hex'),
      },
    });
    await registerPageRoute(req.params.project, sanitized);
    await notifyProjectChanged(req.params.project);
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
    await unregisterPageRoute(req.params.project, viewPath);
    await notifyProjectChanged(req.params.project);
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

// ─── AI View Generator ──────────────────────────────────

const VIEW_GEN_SYSTEM = `You are an Ignition Perspective view generator. Output ONLY valid JSON — no markdown fences, no explanation, no commentary.

Generate a complete Perspective view.json with this exact top-level structure:
{
  "custom": {},
  "params": {},
  "props": { "defaultSize": { "width": 1200, "height": 800 } },
  "root": {
    "type": "ia.container.flex",
    "meta": { "name": "root" },
    "position": {},
    "props": { "direction": "column" },
    "children": [ ... ]
  }
}

COMPONENT TYPES (use these exact identifiers):
Containers:
  ia.container.flex — flexbox. Props: direction ("row"|"column"), justify, alignItems, wrap, style.

Display:
  ia.display.label — text. Props: text, textStyle, style.
  ia.display.icon — icon. Props: path ("material/speed"), style.
  ia.display.markdown — markdown. Props: source.
  ia.display.led-display — LED indicator. Props: color ("green"), size (integer, 20-30).
  ia.display.progress — progress bar. Props: value (0-100), bar: {color}, style.
  ia.chart.status-chart — alarm status chart. Props: alarms: { source: { path: "..." } }.

Input:
  ia.input.text-field — text. Props: value, placeholder, style.
  ia.input.dropdown — dropdown. Props: options [{label, value}], value, style.
  ia.input.toggle-switch — toggle. Props: value (bool).
  ia.input.button — button. Props: text, style.

Charts:
  ia.chart.timeseries — time-series chart. Props: pens (see below), style.
  ia.chart.pie — pie. Props: data [{label, value}], style.

Symbols:
  ia.symbol.motor — motor. Props: state (0=stopped, 1=running, 2=faulted).
  ia.symbol.pump — pump. Props: state.
  ia.symbol.valve — valve. Props: state.

TIME-SERIES CHART pens format (CRITICAL — must match exactly):
{
  "type": "ia.chart.timeseries",
  "props": {
    "pens": [
      {
        "name": "Temperature",
        "source": { "type": "tag", "config": { "tagPath": "[default]Path/To/Tag" } },
        "style": { "color": "#FF6B6B", "lineWidth": 2 }
      }
    ]
  }
}
Each pen needs: name, source.type ("tag"), source.config.tagPath, style.color. Do NOT use a flat "tagPath" key — use nested source object.

LAYOUT RULES:
- Every child MUST have a "position" object. Use "basis" for sizing.
- Header: { "basis": "50px", "shrink": 0 }
- KPI card row: { "basis": "120px", "shrink": 0 }
- Individual card: { "basis": "200px", "grow": 1 }
- Chart area: { "basis": "400px", "grow": 1 }
- Use "gap" in parent flex style instead of margins between children: "style": { "gap": "16px" }

STYLE RULES:
- Set textStyle DIRECTLY in props as a static object. NEVER bind textStyle via propConfig expression.
  Example: "props": { "text": "--", "textStyle": { "fontSize": 20, "fontWeight": "bold", "color": "#333" } }
- Layout properties go in "style": { "padding": "16px", "backgroundColor": "#fff", "borderRadius": "8px" }
- NEVER put fontSize, fontWeight, or color in "style" for labels.
- KPI card style: { "padding": "16px", "backgroundColor": "#ffffff", "borderRadius": "8px", "boxShadow": "0 1px 3px rgba(0,0,0,0.08)", "textAlign": "center" }

TAG BINDINGS (propConfig):
Add "propConfig" as sibling to "props". Keys MUST start with "props." prefix.
CRITICAL: "transforms" array goes INSIDE the "binding" object, NOT as a sibling.

Label bound to tag (with format transform):
{
  "type": "ia.display.label",
  "meta": { "name": "TempValue" },
  "position": { "basis": "40px" },
  "props": { "text": "--", "textStyle": { "fontSize": 20, "fontWeight": "bold", "color": "#333" } },
  "propConfig": {
    "props.text": {
      "binding": {
        "type": "tag",
        "config": { "tagPath": "[default]Path/To/Tag" },
        "transforms": [
          { "type": "expression", "expression": "value + ' °C'" }
        ]
      }
    }
  }
}

Label bound to tag (simple, no transform):
  "propConfig": { "props.text": { "binding": { "type": "tag", "config": { "tagPath": "..." } } } }

Gauge/progress bound to tag:
  "propConfig": { "props.value": { "binding": { "type": "tag", "config": { "tagPath": "..." } } } }

LED color bound to expression:
  "propConfig": { "props.color": { "binding": { "type": "expr", "config": { "expression": "if({[default]Path/To/Tag} > 80, 'red', 'green')" } } } }

Motor/pump/valve state bound to tag:
  "propConfig": { "props.state": { "binding": { "type": "expr", "config": { "expression": "if({[default]Path/To/BoolTag}, 1, 0)" } } } }

CRITICAL RULES:
1. propConfig keys MUST start with "props." — e.g. "props.text", "props.value"
2. Only bind to tag paths explicitly provided. NEVER invent tag paths.
3. If no tag matches a component, use a static value in props — no binding.
4. Every component MUST have: type, props, meta: { "name": "UniquePascalName" }, position. Component names MUST use PascalCase (e.g. "TempValue", "KpiRow", "HeaderContainer", "AlarmTable", "MainChart").
5. Every container MUST have children array.
6. Default text for unbound labels: "--" or "N/A" (not empty string).
7. Output ONLY the JSON object. No markdown fences. No commentary.
8. Set textStyle DIRECTLY in "props" — NEVER use propConfig expression for textStyle.
9. "transforms" MUST be INSIDE the "binding" object — never as sibling to "binding".
10. For numeric display with units, use expression transform: { "type": "expression", "expression": "value + ' RPM'" }
11. Do NOT use script transforms. Use expression transforms or format transforms only.
12. Tag bindings MUST use "tagPath" in config, NOT "path". Example: { "type": "tag", "config": { "tagPath": "[default]Path/To/Tag" } }. The "path" key is ONLY for "property" type bindings.
13. Valid binding types: "property", "expr", "tag", "expr-struct", "query", "tag-history". Do NOT invent other binding types.
14. Valid transform types: "expression", "map", "script", "format". Prefer "expression" transforms.
15. Valid expression functions: abs, ceil, floor, round, max, min, sqrt, now, dateFormat, dateParse, dateExtract, dateAdd, dateDiff, toStr, toInt, toFloat, toBool, len, substring, indexOf, replace, trim, upper, lower, concat, split, if, coalesce, isNull, isEmpty, forExpression, forEach, hasChanged, previousValue, objectAt, typeOf, toJson, fromJson, isNumeric.
16. For time-series charts, use "ia.chart.timeseries" with pens array. Also valid: "ia.chart.powerchart" for more advanced charts.
17. Binding scopes must start with: "props.", "position.", "custom.", "meta.", or "params.".`;

function validateViewJson(content) {
  const result = {
    valid: true,
    errors: [],
    hasRoot: false,
    hasPageConfig: false,
    componentCount: 0,
    tagBindings: 0,
  };

  if (!content || typeof content !== 'object') {
    result.valid = false;
    result.errors.push('Content is not a valid object');
    return result;
  }

  if (!content.root) {
    result.valid = false;
    result.errors.push('Missing root property');
  } else {
    result.hasRoot = true;
    if (!content.root.type) result.errors.push('Root missing type');
    if (!content.root.meta) result.errors.push('Root missing meta');
  }

  result.hasPageConfig = !!(content.custom?.pageConfig);

  // Count components and tag bindings recursively
  function walkNodes(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type) result.componentCount++;
    // Count tag bindings in propConfig (where Perspective stores bindings)
    if (node.propConfig) {
      const configStr = JSON.stringify(node.propConfig);
      const bindMatches = configStr.match(/"binding"\s*:\s*\{/g);
      if (bindMatches) result.tagBindings += bindMatches.length;
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walkNodes(child);
    }
  }
  walkNodes(content.root);

  // Ensure basic structure exists (auto-fix missing fields)
  if (!content.custom) content.custom = {};
  if (!content.params) content.params = {};
  if (!content.props) content.props = {};
  if (!content.root?.position) {
    if (content.root) content.root.position = {};
  }

  if (result.errors.length > 0 && !result.hasRoot) result.valid = false;
  return result;
}

/**
 * Fix propConfig keys that lack the required "props." scope prefix.
 * Ignition's PropertyConfigCollection requires scoped keys like "props.text".
 * LLMs often produce bare keys like "text" — this auto-fixes them in-place.
 */
function fixPropConfigScopes(node) {
  if (!node || typeof node !== 'object') return;
  if (node.propConfig && typeof node.propConfig === 'object') {
    const fixed = {};
    for (const [key, val] of Object.entries(node.propConfig)) {
      fixed[key.includes('.') ? key : `props.${key}`] = val;
    }
    node.propConfig = fixed;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) fixPropConfigScopes(child);
  }
}

/**
 * Fix transforms that are placed as siblings to "binding" instead of inside it.
 * Also removes any expression bindings on textStyle (these should be static props).
 */
function fixBindingStructure(node) {
  if (!node || typeof node !== 'object') return;
  if (node.propConfig && typeof node.propConfig === 'object') {
    for (const [key, entry] of Object.entries(node.propConfig)) {
      if (!entry || typeof entry !== 'object') continue;
      // Move transforms inside binding if they are siblings
      if (entry.transforms && entry.binding && !entry.binding.transforms) {
        entry.binding.transforms = entry.transforms;
        delete entry.transforms;
      }
      // Remove expression bindings on textStyle (they produce strings, not objects)
      if (key === 'props.textStyle' && entry.binding?.type === 'expr') {
        delete node.propConfig[key];
      }
    }
    // Clean up empty propConfig
    if (Object.keys(node.propConfig).length === 0) delete node.propConfig;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) fixBindingStructure(child);
  }
}

/**
 * Fix tag bindings that use "path" instead of "tagPath" in config.
 * Tag-type bindings require "tagPath"; "path" is only for property-type bindings.
 * Discovered via ignition-lint MISSING_TAG_PATH validation.
 */
function fixTagBindingPaths(node) {
  if (!node || typeof node !== 'object') return;
  if (node.propConfig && typeof node.propConfig === 'object') {
    for (const entry of Object.values(node.propConfig)) {
      if (!entry?.binding) continue;
      const b = entry.binding;
      if (b.type === 'tag' && b.config) {
        if (b.config.path && !b.config.tagPath) {
          b.config.tagPath = b.config.path;
          delete b.config.path;
        }
      }
      // Also fix tag-history bindings
      if (b.type === 'tag-history' && b.config) {
        if (b.config.path && !b.config.tagPath) {
          b.config.tagPath = b.config.path;
          delete b.config.path;
        }
      }
    }
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) fixTagBindingPaths(child);
  }
}

/**
 * Convert kebab-case component names to PascalCase.
 * Ignition Perspective convention requires PascalCase for component names.
 */
function fixComponentNames(node) {
  if (!node || typeof node !== 'object') return;
  if (node.meta?.name && node.meta.name.includes('-')) {
    node.meta.name = node.meta.name
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) fixComponentNames(child);
  }
}

/**
 * Fix invalid component types to valid Perspective types.
 */
function fixComponentTypes(node) {
  if (!node || typeof node !== 'object') return;
  // ia.chart.easyChart is not valid — use ia.chart.timeseries instead
  if (node.type === 'ia.chart.easyChart') {
    node.type = 'ia.chart.timeseries';
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) fixComponentTypes(child);
  }
}

/**
 * Run ignition-lint on a view directory and return parsed JSON results.
 * Requires ignition-lint-toolkit pip package installed in the mcp-server venv.
 */
async function lintView(viewDir) {
  const lintCli = join(__dirname, '..', '..', '..', 'mcp-server', '.venv', 'Scripts', 'ignition-lint.exe');
  try {
    const { stdout } = await execFileAsync(lintCli, [
      '--target', viewDir, '--report-format', 'json'
    ], { timeout: 30000 });
    return JSON.parse(stdout);
  } catch (err) {
    // ignition-lint exits non-zero when there are findings — parse stdout anyway
    if (err.stdout) {
      try { return JSON.parse(err.stdout); } catch { /* fall through */ }
    }
    return { error: err.message, findings: [] };
  }
}

/** Generate a view using the configured LLM */
router.post('/:project/generate-view', async (req, res) => {
  try {
    const { name, prompt, tags, model, overwrite } = req.body;
    if (!name || !prompt) {
      return res.status(400).json({ success: false, error: 'name and prompt are required' });
    }

    // Validate project exists
    const projectDir = safePath(PROJECTS_DIR, req.params.project);
    if (!await dirExists(projectDir)) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // Check if view already exists
    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', name);
    if (await dirExists(viewDir) && !overwrite) {
      return res.status(409).json({ success: false, error: `View "${name}" already exists. Send overwrite:true to replace it.` });
    }

    console.log(`[projects] Generating view "${name}" for ${req.params.project} via LLM...`);
    const tagList = Array.isArray(tags) && tags.length > 0 ? tags : [];

    // Build user message
    let userMsg = `Create an Ignition Perspective view for: ${prompt}\n\nThe view path will be: ${name}`;
    if (tagList.length > 0) {
      userMsg += `\n\nAVAILABLE TAGS — use ONLY these exact paths (do NOT invent or guess any tag paths):\n${tagList.map(t => `- ${t}`).join('\n')}`;
      userMsg += `\nEvery tag binding MUST reference one of the paths above verbatim. If no matching tag exists for a component, use a static value instead of a binding.`;
    } else {
      userMsg += `\n\nNo tags were provided. Use static placeholder values in props. Do NOT add any tag bindings.`;
    }
    userMsg += `\n\nOutput ONLY the complete view.json — no markdown, no commentary.`;

    // Call the LLM
    const llmOpts = { maxIterations: 1, enableRagContext: false, noTools: true, numPredict: 8192, temperature: 0.2, numCtx: 16384 };
    if (model) llmOpts.model = model;
    const result = await llmChat(
      [
        { role: 'system', content: VIEW_GEN_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      llmOpts
    );

    // Extract JSON from the response
    let viewContent;
    const responseText = (result.content || '').trim();
    // Handle potential markdown fences from LLM
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    let jsonStr = (jsonMatch ? jsonMatch[1] : responseText).trim();

    // Handle models that include thinking/reasoning text before the JSON
    // Find the first '{' that starts a JSON object
    if (!jsonStr.startsWith('{')) {
      const firstBrace = jsonStr.indexOf('{');
      if (firstBrace !== -1) {
        jsonStr = jsonStr.substring(firstBrace);
        // Find matching closing brace by counting depth
        let depth = 0;
        let endIdx = -1;
        for (let i = 0; i < jsonStr.length; i++) {
          if (jsonStr[i] === '{') depth++;
          else if (jsonStr[i] === '}') { depth--; if (depth === 0) { endIdx = i; break; } }
        }
        if (endIdx !== -1) jsonStr = jsonStr.substring(0, endIdx + 1);
      }
    }

    try {
      viewContent = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[projects] LLM returned invalid JSON:', responseText.substring(0, 500));
      return res.status(422).json({
        success: false,
        error: 'LLM returned invalid JSON. Try simplifying your prompt or choosing a different model.',
        raw: responseText.substring(0, 1000),
      });
    }

    // Validate the generated view
    const validation = validateViewJson(viewContent);
    if (!validation.valid) {
      return res.status(422).json({
        success: false,
        error: `Invalid view structure: ${validation.errors.join(', ')}`,
        validation,
      });
    }

    // Auto-fix propConfig keys missing "props." scope prefix
    if (viewContent.root) fixPropConfigScopes(viewContent.root);
    // Fix transforms placement and remove bad textStyle bindings
    if (viewContent.root) fixBindingStructure(viewContent.root);
    // Fix tag bindings: config.path → config.tagPath (ignition-lint MISSING_TAG_PATH)
    if (viewContent.root) fixTagBindingPaths(viewContent.root);
    // Fix component names: kebab-case → PascalCase
    if (viewContent.root) fixComponentNames(viewContent.root);
    // Fix invalid component types (e.g. ia.chart.timeseries → ia.chart.easyChart)
    if (viewContent.root) fixComponentTypes(viewContent.root);

    // Write the view to disk
    let savedToDisk = false;
    try {
      await mkdir(viewDir, { recursive: true });
      await writeJsonSafe(join(viewDir, 'view.json'), viewContent);

      // Create resource.json metadata
      const viewStr = JSON.stringify(viewContent, null, 2);
      const resourceMeta = {
        scope: 'G',
        version: 1,
        restricted: false,
        overridable: true,
        files: ['view.json'],
        attributes: {
          lastModification: {
            actor: 'copilot-ai',
            timestamp: ignitionTimestamp(),
          },
          lastModificationSignature: createHash('sha256').update(viewStr).digest('hex'),
        },
      };
      await writeJsonSafe(join(viewDir, 'resource.json'), resourceMeta);
      savedToDisk = true;
      await registerPageRoute(req.params.project, name);
      await notifyProjectChanged(req.params.project);
    } catch (writeErr) {
      console.warn(`[projects] Could not write to Ignition dir (${writeErr.code || writeErr.message}), view returned in response only`);
    }

    console.log(`[projects] Generated view "${name}" — ${validation.componentCount} components, ${validation.tagBindings} tag bindings${savedToDisk ? '' : ' (not saved to disk)'}`);

    // Run ignition-lint if saved to disk
    let lintResults = null;
    if (savedToDisk) {
      try {
        lintResults = await lintView(viewDir);
        const issueCount = lintResults?.findings?.length || lintResults?.issues?.length || 0;
        console.log(`[projects] Lint: ${issueCount} findings for "${name}"`);
      } catch (lintErr) {
        console.warn(`[projects] Lint failed: ${lintErr.message}`);
      }
    }

    res.json({
      success: true,
      name,
      validation,
      view: viewContent,
      savedToDisk,
      lintResults,
      pageConfig: viewContent.custom?.pageConfig || null,
      componentCount: validation.componentCount,
      tagBindings: validation.tagBindings,
      model: result.model,
    });
  } catch (err) {
    console.error('[projects] View generation error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Lint View ──────────────────────────────────────────

router.post('/:project/lint-view', async (req, res) => {
  try {
    const { viewPath } = req.body;
    if (!viewPath) return res.status(400).json({ success: false, error: 'viewPath is required' });

    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', viewPath);
    if (!await dirExists(viewDir)) {
      return res.status(404).json({ success: false, error: `View "${viewPath}" not found` });
    }

    const results = await lintView(viewDir);
    res.json({ success: true, viewPath, results });
  } catch (err) {
    console.error('[projects] Lint error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Duplicate View ──────────────────────────────────────

router.post('/:project/duplicate-view', async (req, res) => {
  try {
    const { sourcePath, newName } = req.body;
    if (!sourcePath || !newName?.trim()) return res.status(400).json({ success: false, error: 'sourcePath and newName are required' });

    const sanitized = newName.trim().replace(/[^a-zA-Z0-9_/\-]/g, '');
    if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid view name' });

    const sourceDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sourcePath);
    if (!await dirExists(sourceDir)) return res.status(404).json({ success: false, error: 'Source view not found' });

    const destDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sanitized);
    if (await dirExists(destDir)) return res.status(409).json({ success: false, error: 'Destination view already exists' });

    await mkdir(destDir, { recursive: true });

    // Copy view.json
    const viewContent = await readJsonSafe(join(sourceDir, 'view.json'));
    if (viewContent) await writeJsonSafe(join(destDir, 'view.json'), viewContent);

    // Create fresh resource.json
    const dupStr = JSON.stringify(viewContent, null, 2);
    await writeJsonSafe(join(destDir, 'resource.json'), {
      scope: 'G', version: 1, restricted: false, overridable: true, files: ['view.json'],
      attributes: {
        lastModification: { actor: 'copilot', timestamp: ignitionTimestamp() },
        lastModificationSignature: createHash('sha256').update(dupStr).digest('hex'),
      },
    });

    await registerPageRoute(req.params.project, sanitized);
    await notifyProjectChanged(req.params.project);
    console.log(`[projects] Duplicated view ${sourcePath} → ${sanitized} in ${req.params.project}`);
    res.json({ success: true, name: sanitized, message: 'View duplicated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Rename / Move View ──────────────────────────────────

router.post('/:project/rename-view', async (req, res) => {
  try {
    const { sourcePath, newName } = req.body;
    if (!sourcePath || !newName?.trim()) return res.status(400).json({ success: false, error: 'sourcePath and newName are required' });

    const sanitized = newName.trim().replace(/[^a-zA-Z0-9_/\-]/g, '');
    if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid view name' });

    const sourceDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sourcePath);
    if (!await dirExists(sourceDir)) return res.status(404).json({ success: false, error: 'Source view not found' });

    const destDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sanitized);
    if (await dirExists(destDir)) return res.status(409).json({ success: false, error: 'Destination view already exists' });

    // Ensure parent directory exists
    await mkdir(dirname(destDir), { recursive: true });

    // Move via copy + delete (cross-device safe)
    const viewContent = await readJsonSafe(join(sourceDir, 'view.json'));
    const resourceContent = await readJsonSafe(join(sourceDir, 'resource.json'));

    await mkdir(destDir, { recursive: true });
    if (viewContent) await writeJsonSafe(join(destDir, 'view.json'), viewContent);
    if (resourceContent) {
      resourceContent.attributes = resourceContent.attributes || {};
      resourceContent.attributes.lastModification = { actor: 'copilot', timestamp: ignitionTimestamp() };
      await writeJsonSafe(join(destDir, 'resource.json'), resourceContent);
    }

    await rm(sourceDir, { recursive: true, force: true });

    await unregisterPageRoute(req.params.project, sourcePath);
    await registerPageRoute(req.params.project, sanitized);
    await notifyProjectChanged(req.params.project);
    console.log(`[projects] Renamed view ${sourcePath} → ${sanitized} in ${req.params.project}`);
    res.json({ success: true, name: sanitized, message: 'View renamed' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Request Project Scan ────────────────────────────────

router.post('/:project/scan', async (req, res) => {
  try {
    const projectDir = safePath(PROJECTS_DIR, req.params.project);
    if (!await dirExists(projectDir)) return res.status(404).json({ success: false, error: 'Project not found' });

    await notifyProjectChanged(req.params.project);

    // Also try the Gateway's internal scan endpoint (Ignition 8.1+)
    let gatewayNotified = false;
    try {
      const scanUrl = `${GATEWAY_URL}/data/status/requestProjectScan`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const scanRes = await fetch(scanUrl, { method: 'POST', signal: controller.signal }).catch(() => null);
      clearTimeout(timer);
      if (scanRes?.ok) gatewayNotified = true;
    } catch {}

    res.json({
      success: true,
      message: 'Project scan requested. Changes should appear in Perspective within a few seconds.',
      gatewayNotified,
      perspectiveUrl: `${GATEWAY_URL}/data/perspective/client/${req.params.project}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Export View JSON ────────────────────────────────────

router.get('/:project/export-view', async (req, res) => {
  try {
    const viewPath = req.query.path;
    if (!viewPath) return res.status(400).json({ success: false, error: 'path query required' });

    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', viewPath);
    if (!await dirExists(viewDir)) return res.status(404).json({ success: false, error: 'View not found' });

    const content = await readJsonSafe(join(viewDir, 'view.json'));
    const meta = await readJsonSafe(join(viewDir, 'resource.json'));

    const exportData = {
      exportedAt: ignitionTimestamp(),
      exportedBy: 'copilot',
      project: req.params.project,
      viewPath,
      resource: meta,
      view: content,
    };

    res.setHeader('Content-Disposition', `attachment; filename="${viewPath.replace(/\//g, '_')}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(exportData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Import View JSON ────────────────────────────────────

router.post('/:project/import-view', async (req, res) => {
  try {
    const { name, view } = req.body;
    if (!name?.trim() || !view) return res.status(400).json({ success: false, error: 'name and view are required' });

    const sanitized = name.trim().replace(/[^a-zA-Z0-9_/\-]/g, '');
    if (!sanitized) return res.status(400).json({ success: false, error: 'Invalid view name' });

    // Accept either a raw view or an export bundle
    const viewContent = view.view || view;
    const validation = validateViewJson(viewContent);
    if (!validation.valid) {
      return res.status(422).json({ success: false, error: `Invalid view: ${validation.errors.join(', ')}` });
    }

    const viewDir = safePath(PROJECTS_DIR, req.params.project, PERSPECTIVE_MODULE, 'views', sanitized);
    if (await dirExists(viewDir)) return res.status(409).json({ success: false, error: 'View already exists' });

    await mkdir(viewDir, { recursive: true });
    await writeJsonSafe(join(viewDir, 'view.json'), viewContent);
    const impStr = JSON.stringify(viewContent, null, 2);
    await writeJsonSafe(join(viewDir, 'resource.json'), {
      scope: 'G', version: 1, restricted: false, overridable: true, files: ['view.json'],
      attributes: {
        lastModification: { actor: 'copilot', timestamp: ignitionTimestamp() },
        lastModificationSignature: createHash('sha256').update(impStr).digest('hex'),
      },
    });

    await registerPageRoute(req.params.project, sanitized);
    await notifyProjectChanged(req.params.project);
    console.log(`[projects] Imported view ${sanitized} into ${req.params.project}`);
    res.json({ success: true, name: sanitized, validation, message: 'View imported' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
