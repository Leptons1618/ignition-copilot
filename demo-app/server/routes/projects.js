/**
 * Ignition Project Management Routes.
 * Reads projects and views from the actual Ignition installation directory.
 * Supports browsing, editing, creating, and deleting Perspective views.
 */

import { Router } from 'express';
import { readdir, readFile, writeFile, mkdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, sep, dirname } from 'path';
import { chat as llmChat } from '../services/ollama.js';

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

// ─── AI View Generator ──────────────────────────────────

const VIEW_GEN_SYSTEM = `You are an Ignition Perspective view generator. You MUST output ONLY valid JSON — no markdown, no code fences, no explanation text.

Generate a complete Ignition Perspective view.json structure following this EXACT schema:
{
  "custom": {
    "pageConfig": {
      "title": "Page Title",
      "url": "/page-url",
      "loginRequired": false
    }
  },
  "params": {},
  "props": {
    "defaultSize": { "width": 1200, "height": 800 }
  },
  "root": {
    "type": "ia.container.flex",
    "meta": { "name": "root" },
    "position": {},
    "props": { "direction": "column", "style": { "padding": "16px", "gap": "12px" } },
    "children": [ ... ]
  }
}

AVAILABLE COMPONENT TYPES:
Containers:
  ia.container.flex     — flexbox (direction, justify, align, wrap, gap).  Always wrap children.
  ia.container.coord    — absolute-positioned children.

Display:
  ia.display.label      — text label.  Props: text, style.
  ia.display.icon       — icon.  Props: path (material icon name), style.
  ia.display.image      — image.  Props: src, style.
  ia.display.markdown   — rich markdown.  Props: source.
  ia.display.gauge      — semicircular gauge.  Props: value, min, max, style.
  ia.display.led        — LED indicator.  Props: color, style.
  ia.display.progress-bar — bar.  Props: value (0-100), style.

Input:
  ia.input.text-field   — text input.  Props: value, placeholder.
  ia.input.numeric-field — number input.  Props: value, min, max.
  ia.input.dropdown     — dropdown.  Props: options, value.
  ia.input.toggle-switch — toggle.  Props: value (boolean).
  ia.input.button       — button.  Props: text, style.

Charts:
  ia.chart.easy-chart   — time-series trend chart.  Props: tag paths, style.
  ia.chart.pie          — pie chart.  Props: data, style.
  ia.chart.bar          — bar chart.  Props: data, style.

Tables:
  ia.display.table      — data table.  Props: data, columns.
  ia.alarm.status-table — active alarms.  Props: style.
  ia.alarm.journal-table — alarm history.  Props: style.

Navigation:
  ia.navigation.link    — navigation link.  Props: text, href, style.

STYLE RULES:
- Use style objects: { "padding": "16px", "gap": "12px", "backgroundColor": "#f8f9fa", "borderRadius": "8px" }
- For KPI cards use: { "flex": "1 1 200px", "padding": "16px", "backgroundColor": "#ffffff", "borderRadius": "8px", "boxShadow": "0 1px 3px rgba(0,0,0,0.08)", "textAlign": "center" }
- For headers: { "fontSize": "22px", "fontWeight": "bold", "marginBottom": "4px" }
- For chart containers: { "height": "300px", "backgroundColor": "#ffffff", "borderRadius": "8px", "padding": "12px" }

TAG BINDINGS:
When tags are provided, bind them to component props using this exact structure:
{
  "value": {
    "binding": {
      "type": "tag",
      "config": {
        "path": "[default]DemoPlant/MotorM12/Speed"
      }
    }
  }
}
— Use "text" prop for labels, "value" prop for gauges/inputs/LEDs.

COMPONENT RULES:
- Every component MUST have: type, props, meta: { "name": "unique-kebab-name" }
- Every container MUST have: children (array)
- Give every component a descriptive meta.name

CRITICAL: Output ONLY the JSON object, nothing else. No markdown fences. No commentary.`;

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
    // Check for tag bindings anywhere in props
    if (node.props) {
      const propsStr = JSON.stringify(node.props);
      const bindMatches = propsStr.match(/"binding"\s*:\s*\{/g);
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

/** Generate a view using the configured LLM */
router.post('/:project/generate-view', async (req, res) => {
  try {
    const { name, prompt, tags } = req.body;
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
    if (await dirExists(viewDir)) {
      return res.status(409).json({ success: false, error: `View "${name}" already exists. Choose a different name.` });
    }

    console.log(`[projects] Generating view "${name}" for ${req.params.project} via LLM...`);
    const tagList = Array.isArray(tags) && tags.length > 0 ? tags : [];

    // Build user message
    let userMsg = `Create an Ignition Perspective view for: ${prompt}\n\nThe view path will be: ${name}`;
    if (tagList.length > 0) {
      userMsg += `\n\nBind these tags to the relevant components:\n${tagList.map(t => `- ${t}`).join('\n')}`;
    }
    userMsg += `\n\nOutput ONLY the complete view.json — no markdown, no commentary.`;

    // Call the LLM
    const result = await llmChat(
      [
        { role: 'system', content: VIEW_GEN_SYSTEM },
        { role: 'user', content: userMsg },
      ],
      { maxIterations: 1, enableRagContext: false, noTools: true, numPredict: 4096 }
    );

    // Extract JSON from the response
    let viewContent;
    const responseText = (result.content || '').trim();
    // Handle potential markdown fences from LLM
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = (jsonMatch ? jsonMatch[1] : responseText).trim();

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

    // Write the view to disk
    let savedToDisk = false;
    try {
      await mkdir(viewDir, { recursive: true });
      await writeJsonSafe(join(viewDir, 'view.json'), viewContent);

      // Create resource.json metadata
      const resourceMeta = {
        scope: 'G',
        version: 1,
        restricted: false,
        overridable: true,
        files: ['view.json'],
        attributes: {
          lastModification: {
            actor: 'copilot-ai',
            timestamp: new Date().toISOString(),
          },
        },
      };
      await writeJsonSafe(join(viewDir, 'resource.json'), resourceMeta);
      savedToDisk = true;
    } catch (writeErr) {
      console.warn(`[projects] Could not write to Ignition dir (${writeErr.code || writeErr.message}), view returned in response only`);
    }

    console.log(`[projects] Generated view "${name}" — ${validation.componentCount} components, ${validation.tagBindings} tag bindings${savedToDisk ? '' : ' (not saved to disk)'}`);

    res.json({
      success: true,
      name,
      validation,
      view: viewContent,
      savedToDisk,
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

export default router;
