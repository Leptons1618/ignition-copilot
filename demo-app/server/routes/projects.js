/**
 * Ignition Project Management Routes.
 * Reads projects and views from the actual Ignition installation directory.
 * Supports browsing, editing, creating, and deleting Perspective views.
 */

import { Router } from 'express';
import { readdir, readFile, writeFile, mkdir, rm, stat, cp } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, sep, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ignition from '../services/ignition.js';
import { getChatConfig } from '../services/ollama.js';

const router = Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Configuration ───────────────────────────────────────

const DEFAULT_IGNITION_DIRS = {
  win32: [
    'C:\\Program Files\\Inductive Automation\\Ignition',
    'C:\\Program Files (x86)\\Inductive Automation\\Ignition',
  ],
  linux: [
    '/usr/local/ignition',
    '/opt/ignition',
    '/usr/lib/ignition',
    '/usr/local/bin/ignition',
  ],
  darwin: [
    '/usr/local/ignition',
    '/Applications/Ignition.app/Contents/Resources/app',
  ],
};

function detectDefaultIgnitionDir() {
  const candidates = DEFAULT_IGNITION_DIRS[process.platform] || DEFAULT_IGNITION_DIRS.win32;
  for (const dir of candidates) {
    if (existsSync(join(dir, 'data', 'projects'))) return dir;
  }
  return candidates[0];
}

let IGNITION_DIR = process.env.IGNITION_DIR
  || detectDefaultIgnitionDir();

let PROJECTS_DIR = join(IGNITION_DIR, 'data', 'projects');
let GATEWAY_URL = process.env.IGNITION_URL || 'http://localhost:8088';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const AI_PLAN_TTL_MS = 15 * 60 * 1000;
const REVISION_ROOT = join(__dirname, '..', 'data', 'project-revisions');
const aiPlans = new Map();

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

function normalizeResourcePath(input, field = 'path') {
  const normalized = String(input || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.includes('..')) throw new Error(`Invalid ${field}`);
  return normalized;
}

function sanitizeProjectName(name) {
  const cleaned = String(name || '').trim().replace(/[^a-zA-Z0-9_-]/g, '');
  if (!cleaned) throw new Error('Invalid project name');
  return cleaned;
}

function getProjectDir(project) {
  return safePath(PROJECTS_DIR, sanitizeProjectName(project));
}

function getViewsDir(project) {
  return safePath(getProjectDir(project), PERSPECTIVE_MODULE, 'views');
}

function getScriptsDir(project) {
  return safePath(getProjectDir(project), IGNITION_CORE, 'script-python');
}

function getQueriesDir(project) {
  return safePath(getProjectDir(project), IGNITION_CORE, 'named-query');
}

function buildResourceMeta(fileName, actor = 'copilot') {
  return {
    scope: 'G',
    version: 1,
    restricted: false,
    overridable: true,
    files: [fileName],
    attributes: { lastModification: { actor, timestamp: new Date().toISOString() } },
  };
}

async function readProjectMeta(project) {
  const projectJson = join(getProjectDir(project), 'project.json');
  return await readJsonSafe(projectJson) || {};
}

async function writeProjectMeta(project, patch = {}) {
  const current = await readProjectMeta(project);
  const next = {
    title: patch.title ?? current.title ?? project,
    description: patch.description ?? current.description ?? '',
    enabled: patch.enabled ?? current.enabled ?? true,
    inheritable: patch.inheritable ?? current.inheritable ?? false,
    parent: patch.parent ?? current.parent ?? '',
  };
  await writeJsonSafe(join(getProjectDir(project), 'project.json'), next);
  return next;
}

async function ensureProjectStructure(project) {
  const projectDir = getProjectDir(project);
  await mkdir(projectDir, { recursive: true });
  await mkdir(join(projectDir, PERSPECTIVE_MODULE, 'views'), { recursive: true });
  await mkdir(join(projectDir, IGNITION_CORE, 'script-python'), { recursive: true });
  await mkdir(join(projectDir, IGNITION_CORE, 'named-query'), { recursive: true });
}

async function resolveScriptTarget(project, scriptPath, createIfMissing = false) {
  const normalized = normalizeResourcePath(scriptPath, 'script path');
  const scriptsDir = getScriptsDir(project);
  const packageFile = safePath(scriptsDir, normalized, 'code.py');
  const directFile = safePath(scriptsDir, normalized);

  if (await fileExists(packageFile)) return { normalized, filePath: packageFile, kind: 'package' };
  if (await fileExists(directFile)) return { normalized, filePath: directFile, kind: 'file' };
  if (!createIfMissing) throw new Error('Script not found');

  const createAsDirectFile = normalized.endsWith('.py');
  return {
    normalized,
    filePath: createAsDirectFile ? directFile : packageFile,
    kind: createAsDirectFile ? 'file' : 'package',
  };
}

async function resolveNamedQueryTarget(project, queryPath, createIfMissing = false) {
  const normalized = normalizeResourcePath(queryPath, 'named query path');
  const queriesDir = getQueriesDir(project);
  const queryDir = safePath(queriesDir, normalized);
  const sqlFile = join(queryDir, 'query.sql');
  if (createIfMissing || await fileExists(sqlFile)) return { normalized, queryDir, sqlFile };
  throw new Error('Named query not found');
}

function splitTagPath(fullPath) {
  const normalized = String(fullPath || '').trim();
  const idx = normalized.lastIndexOf('/');
  if (idx <= 0) throw new Error(`Invalid tag path: ${fullPath}`);
  return { basePath: normalized.slice(0, idx), name: normalized.slice(idx + 1) };
}

function parseJsonPayload(text) {
  if (!text) return null;
  const raw = String(text).trim();
  try { return JSON.parse(raw); } catch {}
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch {}
  }
  return null;
}

function pruneAiPlans() {
  const now = Date.now();
  for (const [id, entry] of aiPlans.entries()) {
    if (entry.expiresAt <= now) aiPlans.delete(id);
  }
}

function normalizeAiOperations(operations = [], defaultProject = '') {
  const allowed = new Set([
    'create_project', 'update_project', 'delete_project',
    'create_view', 'update_view', 'modify_view', 'delete_view',
    'create_script', 'update_script', 'delete_script',
    'create_query', 'update_query', 'delete_query',
    'create_tag', 'write_tag', 'delete_tags',
  ]);

  if (!Array.isArray(operations) || operations.length === 0) {
    throw new Error('No operations were generated.');
  }

  return operations.map((raw, idx) => {
    const type = String(raw?.type || '').trim();
    if (!allowed.has(type)) throw new Error(`Unsupported operation type at index ${idx}: ${type}`);

    const op = { type };
    const project = raw.project || defaultProject;

    if (type === 'create_project' || type === 'delete_project') {
      op.project = sanitizeProjectName(raw.project || raw.name || defaultProject);
      if (!op.project) throw new Error(`${type} requires project name`);
      if (type === 'create_project') {
        op.title = raw.title;
        op.description = raw.description;
      }
      return op;
    }

    if (!project) throw new Error(`Operation ${type} requires a project`);
    op.project = sanitizeProjectName(project);

    if (type === 'update_project') {
      op.patch = {
        title: raw.title,
        description: raw.description,
        enabled: raw.enabled,
        inheritable: raw.inheritable,
        parent: raw.parent,
      };
      return op;
    }

    if (type === 'create_view' || type === 'update_view' || type === 'modify_view' || type === 'delete_view') {
      op.path = normalizeResourcePath(raw.path, 'view path');
      if (type === 'create_view') {
        op.template = String(raw.template || 'blank');
        if (raw.content && typeof raw.content === 'object') op.content = raw.content;
      }
      if (type === 'update_view') {
        if (typeof raw.content !== 'object' || !raw.content?.root) {
          throw new Error('update_view requires a full view JSON object with root');
        }
        op.content = raw.content;
      }
      if (type === 'modify_view') {
        op.modifications = {
          tagReplacements: raw.tagReplacements || raw.tag_replacements || {},
          propertyUpdates: raw.propertyUpdates || raw.property_updates || {},
          addComponents: Array.isArray(raw.addComponents || raw.add_components) ? (raw.addComponents || raw.add_components) : [],
        };
      }
      return op;
    }

    if (type === 'create_script' || type === 'update_script' || type === 'delete_script') {
      op.path = normalizeResourcePath(raw.path, 'script path');
      if (type !== 'delete_script') {
        op.content = String(raw.content ?? '');
      }
      return op;
    }

    if (type === 'create_query' || type === 'update_query' || type === 'delete_query') {
      op.path = normalizeResourcePath(raw.path, 'named query path');
      if (type !== 'delete_query') {
        op.sql = String(raw.sql ?? '');
      }
      return op;
    }

    if (type === 'create_tag') {
      op.basePath = String(raw.basePath || '').trim();
      op.name = String(raw.name || '').trim();
      op.dataType = String(raw.dataType || 'Float8');
      op.value = raw.value ?? 0;
      if (!op.basePath || !op.name) throw new Error('create_tag requires basePath and name');
      return op;
    }

    if (type === 'write_tag') {
      op.path = String(raw.path || '').trim();
      op.value = raw.value;
      if (!op.path) throw new Error('write_tag requires path');
      return op;
    }

    if (type === 'delete_tags') {
      op.paths = (Array.isArray(raw.paths) ? raw.paths : []).map(v => String(v).trim()).filter(Boolean);
      if (op.paths.length === 0) throw new Error('delete_tags requires paths array');
      return op;
    }

    return op;
  });
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function replaceTagsInObject(data, replacements = {}) {
  if (Array.isArray(data)) return data.map(v => replaceTagsInObject(v, replacements));
  if (data && typeof data === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'path' && typeof value === 'string') {
        let nextPath = value;
        for (const [oldTag, newTag] of Object.entries(replacements)) {
          if (oldTag && newTag) nextPath = nextPath.replaceAll(oldTag, newTag);
        }
        out[key] = nextPath;
      } else {
        out[key] = replaceTagsInObject(value, replacements);
      }
    }
    return out;
  }
  return data;
}

function applyPropertyUpdates(view, updates = {}) {
  if (!updates || typeof updates !== 'object') return view;
  for (const [propPath, value] of Object.entries(updates)) {
    const keys = String(propPath || '').split('.').filter(Boolean);
    if (keys.length === 0) continue;
    let target = view.root?.props;
    if (!target) continue;
    for (const key of keys.slice(0, -1)) {
      target[key] = target[key] && typeof target[key] === 'object' ? target[key] : {};
      target = target[key];
    }
    target[keys[keys.length - 1]] = value;
  }
  return view;
}

function addComponentsToView(view, components = []) {
  if (!Array.isArray(components) || components.length === 0) return view;
  const root = view.root || {};
  root.children = Array.isArray(root.children) ? root.children : [];
  for (const component of components) {
    if (component && typeof component === 'object' && component.type) {
      root.children.push(component);
    }
  }
  view.root = root;
  return view;
}

async function createProjectResource(project, patch = {}) {
  const projectName = sanitizeProjectName(project);
  const projectDir = getProjectDir(projectName);
  if (await dirExists(projectDir)) throw new Error(`Project already exists: ${projectName}`);
  await ensureProjectStructure(projectName);
  const meta = await writeProjectMeta(projectName, patch);
  return { name: projectName, ...meta };
}

async function updateProjectResource(project, patch = {}) {
  const projectName = sanitizeProjectName(project);
  const projectDir = getProjectDir(projectName);
  if (!await dirExists(projectDir)) throw new Error('Project not found');
  const meta = await writeProjectMeta(projectName, patch);
  return { name: projectName, ...meta };
}

async function deleteProjectResource(project) {
  const projectName = sanitizeProjectName(project);
  const projectDir = getProjectDir(projectName);
  if (!await dirExists(projectDir)) throw new Error('Project not found');
  await rm(projectDir, { recursive: true, force: true });
  return { deleted: projectName };
}

async function createViewResource(project, viewPath, template = 'blank', content = null) {
  const normalized = normalizeResourcePath(viewPath, 'view path');
  const viewDir = safePath(getViewsDir(project), normalized);
  if (await dirExists(viewDir)) throw new Error('View already exists');
  await mkdir(viewDir, { recursive: true });
  const templateFn = VIEW_TEMPLATES[template] || VIEW_TEMPLATES.blank;
  const viewContent = content && typeof content === 'object' ? content : templateFn();
  if (!viewContent?.root) throw new Error('Invalid view content');
  await writeJsonSafe(join(viewDir, 'view.json'), viewContent);
  await writeJsonSafe(join(viewDir, 'resource.json'), buildResourceMeta('view.json'));
  return { path: normalized };
}

async function updateViewResource(project, viewPath, content) {
  const normalized = normalizeResourcePath(viewPath, 'view path');
  const viewDir = safePath(getViewsDir(project), normalized);
  if (!await dirExists(viewDir)) throw new Error('View not found');
  if (typeof content !== 'object' || !content?.root) throw new Error('Invalid view content');
  await writeJsonSafe(join(viewDir, 'view.json'), content);
  const resourcePath = join(viewDir, 'resource.json');
  const meta = await readJsonSafe(resourcePath) || buildResourceMeta('view.json');
  meta.attributes = meta.attributes || {};
  meta.attributes.lastModification = { actor: 'copilot', timestamp: new Date().toISOString() };
  await writeJsonSafe(resourcePath, meta);
  return { path: normalized };
}

async function modifyViewResource(project, viewPath, modifications = {}) {
  const normalized = normalizeResourcePath(viewPath, 'view path');
  const viewDir = safePath(getViewsDir(project), normalized);
  if (!await dirExists(viewDir)) throw new Error('View not found');
  const viewJsonPath = join(viewDir, 'view.json');
  const current = await readJsonSafe(viewJsonPath);
  if (!current?.root) throw new Error('Invalid existing view JSON');

  let next = cloneJson(current);
  next = replaceTagsInObject(next, modifications.tagReplacements || {});
  next = applyPropertyUpdates(next, modifications.propertyUpdates || {});
  next = addComponentsToView(next, modifications.addComponents || []);

  await writeJsonSafe(viewJsonPath, next);
  const resourcePath = join(viewDir, 'resource.json');
  const meta = await readJsonSafe(resourcePath) || buildResourceMeta('view.json');
  meta.attributes = meta.attributes || {};
  meta.attributes.lastModification = { actor: 'copilot', timestamp: new Date().toISOString() };
  await writeJsonSafe(resourcePath, meta);
  return { path: normalized };
}

async function deleteViewResource(project, viewPath) {
  const normalized = normalizeResourcePath(viewPath, 'view path');
  const viewDir = safePath(getViewsDir(project), normalized);
  if (!await dirExists(viewDir)) throw new Error('View not found');
  await rm(viewDir, { recursive: true, force: true });
  return { path: normalized };
}

async function createOrUpdateScriptResource(project, scriptPath, content, createOnly = false) {
  const scriptsDir = getScriptsDir(project);
  await mkdir(scriptsDir, { recursive: true });
  const target = await resolveScriptTarget(project, scriptPath, true);
  if (createOnly && await fileExists(target.filePath)) throw new Error('Script already exists');
  if (!createOnly && !await fileExists(target.filePath)) throw new Error('Script not found');
  await mkdir(dirname(target.filePath), { recursive: true });
  await writeFile(target.filePath, String(content ?? ''), 'utf-8');
  const resourceFile = join(dirname(target.filePath), 'resource.json');
  const meta = await readJsonSafe(resourceFile) || buildResourceMeta(basename(target.filePath));
  meta.files = [basename(target.filePath)];
  meta.attributes = meta.attributes || {};
  meta.attributes.lastModification = { actor: 'copilot', timestamp: new Date().toISOString() };
  await writeJsonSafe(resourceFile, meta);
  return { path: target.normalized };
}

async function deleteScriptResource(project, scriptPath) {
  const target = await resolveScriptTarget(project, scriptPath, false);
  if (target.kind === 'package') {
    await rm(dirname(target.filePath), { recursive: true, force: true });
  } else {
    await rm(target.filePath, { force: true });
  }
  return { path: target.normalized };
}

async function createOrUpdateNamedQueryResource(project, queryPath, sql, createOnly = false) {
  const queriesDir = getQueriesDir(project);
  await mkdir(queriesDir, { recursive: true });
  const target = await resolveNamedQueryTarget(project, queryPath, true);
  const alreadyExists = await fileExists(target.sqlFile);
  if (createOnly && alreadyExists) throw new Error('Named query already exists');
  if (!createOnly && !alreadyExists) throw new Error('Named query not found');
  await mkdir(target.queryDir, { recursive: true });
  await writeFile(target.sqlFile, String(sql ?? ''), 'utf-8');
  const resourceJson = join(target.queryDir, 'resource.json');
  const meta = await readJsonSafe(resourceJson) || buildResourceMeta('query.sql');
  meta.attributes = meta.attributes || {};
  meta.attributes.lastModification = { actor: 'copilot', timestamp: new Date().toISOString() };
  await writeJsonSafe(resourceJson, meta);
  return { path: target.normalized };
}

async function deleteNamedQueryResource(project, queryPath) {
  const target = await resolveNamedQueryTarget(project, queryPath, false);
  await rm(target.queryDir, { recursive: true, force: true });
  return { path: target.normalized };
}

async function collectProjectContext(project) {
  const projectName = sanitizeProjectName(project);
  const projectDir = getProjectDir(projectName);
  const exists = await dirExists(projectDir);
  if (!exists) return { project: projectName, exists: false, views: [], scripts: [], queries: [] };

  const views = await scanViews(getViewsDir(projectName)).catch(() => []);
  const scripts = await scanScripts(getScriptsDir(projectName)).catch(() => []);
  const queries = await scanNamedQueries(getQueriesDir(projectName)).catch(() => []);
  return {
    project: projectName,
    exists: true,
    views: views.filter(v => v.isView).map(v => v.path).slice(0, 40),
    scripts: scripts.map(v => v.path).slice(0, 40),
    queries: queries.map(v => v.path).slice(0, 40),
  };
}

async function requestAiPlan(project, instruction, modelOverride = '') {
  const context = await collectProjectContext(project);
  const systemPrompt = `You produce STRICT JSON plans for Ignition project edits.
Return only JSON with this schema:
{
  "summary": "short text",
  "questions": ["optional clarification question"],
  "operations": [
    {
      "type": "create_project|update_project|delete_project|create_view|update_view|modify_view|delete_view|create_script|update_script|delete_script|create_query|update_query|delete_query|create_tag|write_tag|delete_tags",
      "...": "fields required by operation"
    }
  ]
}
Rules:
- Prefer modify_view over update_view when only partial changes are needed.
- For create_view include "path" and optional "template" (blank|kpi|detail|alarm|navigation).
- For scripts use "path" and "content".
- For named queries use "path" and "sql".
- Use project "${project}" unless explicitly requested otherwise.
- Keep operations minimal and safe.`;

  async function requestWithModel(modelName) {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        stream: false,
        options: { temperature: 0.1, num_predict: 1200 },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Instruction:\n${instruction}\n\nProject context:\n${JSON.stringify(context, null, 2)}` },
        ],
      }),
    });
    const bodyText = await response.text();
    return { ok: response.ok, status: response.status, bodyText, payload: response.ok ? JSON.parse(bodyText) : null };
  }

  const requestedModel = modelOverride || getChatConfig().defaultModel || OLLAMA_MODEL;
  let result = await requestWithModel(requestedModel);

  if (!result.ok && result.status === 404 && result.bodyText.includes('model')) {
    const tagsResp = await fetch(`${OLLAMA_URL}/api/tags`).catch(() => null);
    if (tagsResp?.ok) {
      const tags = await tagsResp.json().catch(() => ({}));
      const fallbackModel = tags?.models?.[0]?.name;
      if (fallbackModel && fallbackModel !== requestedModel) {
        result = await requestWithModel(fallbackModel);
      }
    }
  }

  if (!result.ok || !result.payload) {
    throw new Error(`Ollama planning failed (${result.status}): ${result.bodyText}`);
  }
  const payload = result.payload;
  const parsed = parseJsonPayload(payload?.message?.content || '');
  if (!parsed?.operations) throw new Error('AI planner returned invalid JSON');
  return parsed;
}

async function previewAiOperations(operations = []) {
  const preview = [];
  for (const op of operations) {
    if (op.type === 'create_project') {
      preview.push({ type: op.type, target: op.project, action: 'create project' });
      continue;
    }
    if (op.type === 'update_project') {
      preview.push({ type: op.type, target: op.project, action: 'update project metadata' });
      continue;
    }
    if (op.type === 'delete_project') {
      preview.push({ type: op.type, target: op.project, action: 'delete project' });
      continue;
    }
    if (op.type.endsWith('_view') || op.type === 'modify_view') {
      const viewDir = safePath(getViewsDir(op.project), op.path);
      preview.push({
        type: op.type,
        target: `${op.project}/view:${op.path}`,
        action: op.type.replaceAll('_', ' '),
        exists: await dirExists(viewDir),
      });
      continue;
    }
    if (op.type.endsWith('_script')) {
      const scriptExists = await resolveScriptTarget(op.project, op.path, true).then(async target => await fileExists(target.filePath)).catch(() => false);
      preview.push({
        type: op.type,
        target: `${op.project}/script:${op.path}`,
        action: op.type.replaceAll('_', ' '),
        exists: scriptExists,
      });
      continue;
    }
    if (op.type.endsWith('_query')) {
      const queryExists = await resolveNamedQueryTarget(op.project, op.path, true).then(async target => await fileExists(target.sqlFile)).catch(() => false);
      preview.push({
        type: op.type,
        target: `${op.project}/query:${op.path}`,
        action: op.type.replaceAll('_', ' '),
        exists: queryExists,
      });
      continue;
    }
    if (op.type === 'create_tag' || op.type === 'write_tag' || op.type === 'delete_tags') {
      preview.push({
        type: op.type,
        target: op.path || op.basePath || (op.paths || []).join(','),
        action: op.type.replaceAll('_', ' '),
      });
    }
  }
  return preview;
}

async function rollbackTagActions(actions = []) {
  for (let i = actions.length - 1; i >= 0; i--) {
    const action = actions[i];
    try {
      if (action.type === 'write_tag') {
        await ignition.writeTags([{ path: action.path, value: action.value }]);
      } else if (action.type === 'delete_tags') {
        await ignition.deleteTags(action.paths || []);
      } else if (action.type === 'restore_tags') {
        for (const tag of action.tags || []) {
          const { basePath, name } = splitTagPath(tag.path);
          await ignition.createTag(basePath, name, tag.config?.tagType || 'AtomicTag', tag.config?.dataType || 'Float8', tag.config?.value ?? 0);
          if (tag.config?.value !== undefined) {
            await ignition.writeTags([{ path: tag.path, value: tag.config.value }]);
          }
        }
      }
    } catch (err) {
      console.warn(`[projects] Tag rollback warning: ${err.message}`);
    }
  }
}

async function snapshotProjects(projectNames = [], revisionDir) {
  const snapshots = {};
  for (const name of projectNames) {
    const project = sanitizeProjectName(name);
    const projectDir = getProjectDir(project);
    const backupDir = join(revisionDir, 'projects', project);
    const existed = await dirExists(projectDir);
    snapshots[project] = { existed };
    if (existed) {
      await mkdir(dirname(backupDir), { recursive: true });
      await cp(projectDir, backupDir, { recursive: true });
    }
  }
  return snapshots;
}

async function restoreProjectSnapshots(snapshots = {}, revisionDir) {
  for (const [project, state] of Object.entries(snapshots)) {
    const projectDir = getProjectDir(project);
    const backupDir = join(revisionDir, 'projects', project);
    if (await dirExists(projectDir)) {
      await rm(projectDir, { recursive: true, force: true });
    }
    if (state.existed && await dirExists(backupDir)) {
      await mkdir(dirname(projectDir), { recursive: true });
      await cp(backupDir, projectDir, { recursive: true });
    }
  }
}

async function executeOperation(op, tagRollback = []) {
  switch (op.type) {
    case 'create_project':
      return await createProjectResource(op.project, { title: op.title, description: op.description });
    case 'update_project':
      return await updateProjectResource(op.project, op.patch || {});
    case 'delete_project':
      return await deleteProjectResource(op.project);
    case 'create_view':
      return await createViewResource(op.project, op.path, op.template, op.content);
    case 'update_view':
      return await updateViewResource(op.project, op.path, op.content);
    case 'modify_view':
      return await modifyViewResource(op.project, op.path, op.modifications || {});
    case 'delete_view':
      return await deleteViewResource(op.project, op.path);
    case 'create_script':
      return await createOrUpdateScriptResource(op.project, op.path, op.content, true);
    case 'update_script':
      return await createOrUpdateScriptResource(op.project, op.path, op.content, false);
    case 'delete_script':
      return await deleteScriptResource(op.project, op.path);
    case 'create_query':
      return await createOrUpdateNamedQueryResource(op.project, op.path, op.sql, true);
    case 'update_query':
      return await createOrUpdateNamedQueryResource(op.project, op.path, op.sql, false);
    case 'delete_query':
      return await deleteNamedQueryResource(op.project, op.path);
    case 'create_tag': {
      await ignition.createTag(op.basePath, op.name, 'AtomicTag', op.dataType || 'Float8', op.value ?? 0);
      tagRollback.push({ type: 'delete_tags', paths: [`${op.basePath}/${op.name}`] });
      return { path: `${op.basePath}/${op.name}` };
    }
    case 'write_tag': {
      const previous = await ignition.readTags([op.path]).catch(() => ({ results: [] }));
      const prevValue = previous?.results?.[0]?.value;
      tagRollback.push({ type: 'write_tag', path: op.path, value: prevValue });
      await ignition.writeTags([{ path: op.path, value: op.value }]);
      return { path: op.path, value: op.value };
    }
    case 'delete_tags': {
      const backups = [];
      for (const path of op.paths) {
        const cfg = await ignition.getTagConfig(path).catch(() => null);
        if (cfg) backups.push({ path, config: cfg });
      }
      if (backups.length > 0) tagRollback.push({ type: 'restore_tags', tags: backups });
      await ignition.deleteTags(op.paths);
      return { deleted: op.paths };
    }
    default:
      throw new Error(`Unsupported operation: ${op.type}`);
  }
}

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
      if (entry.name.startsWith('.')) continue;
      const projectDir = join(PROJECTS_DIR, entry.name);
      const meta = await readJsonSafe(join(projectDir, 'project.json'));
      if (!meta) continue;
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

/** Create a project */
router.post('/', async (req, res) => {
  try {
    const project = req.body?.name || req.body?.project;
    if (!project) return res.status(400).json({ success: false, error: 'Project name is required' });
    const created = await createProjectResource(project, {
      title: req.body?.title,
      description: req.body?.description,
      enabled: req.body?.enabled,
      inheritable: req.body?.inheritable,
      parent: req.body?.parent,
    });
    res.status(201).json({ success: true, project: created });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** AI plan changes for a project */
router.post('/ai/plan', async (req, res) => {
  try {
    pruneAiPlans();
    const project = req.body?.project;
    const instruction = req.body?.instruction;
    const model = req.body?.model;
    const directOps = req.body?.operations;
    if (!project) return res.status(400).json({ success: false, error: 'project is required' });

    const generated = Array.isArray(directOps)
      ? { summary: 'Plan generated from provided operations.', operations: directOps, questions: [] }
      : await requestAiPlan(project, instruction, model);
    const operations = normalizeAiOperations(generated.operations, project);
    const preview = await previewAiOperations(operations);
    const planId = `plan-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const expiresAt = Date.now() + AI_PLAN_TTL_MS;
    aiPlans.set(planId, {
      id: planId,
      project: sanitizeProjectName(project),
      operations,
      summary: generated.summary || '',
      questions: Array.isArray(generated.questions) ? generated.questions : [],
      createdAt: Date.now(),
      expiresAt,
    });

    res.json({
      success: true,
      requiresConfirmation: true,
      planId,
      project: sanitizeProjectName(project),
      summary: generated.summary || '',
      questions: Array.isArray(generated.questions) ? generated.questions : [],
      operations,
      preview,
      expiresAt: new Date(expiresAt).toISOString(),
      nextStep: 'Ask user for confirmation before calling /api/projects/ai/apply with this planId.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/** Apply an approved AI plan */
router.post('/ai/apply', async (req, res) => {
  try {
    pruneAiPlans();
    const planId = req.body?.planId;
    if (!planId) return res.status(400).json({ success: false, error: 'planId is required' });
    const plan = aiPlans.get(planId);
    if (!plan) return res.status(404).json({ success: false, error: 'Plan not found or expired' });

    const revisionId = `rev-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const revisionDir = join(REVISION_ROOT, revisionId);
    const impactedProjects = [...new Set(plan.operations.filter(op => op.project).map(op => op.project))];
    const tagRollback = [];

    await mkdir(revisionDir, { recursive: true });
    const snapshots = await snapshotProjects(impactedProjects, revisionDir);

    const results = [];
    try {
      for (const op of plan.operations) {
        const result = await executeOperation(op, tagRollback);
        results.push({ type: op.type, project: op.project, result });
      }
    } catch (applyErr) {
      await restoreProjectSnapshots(snapshots, revisionDir);
      await rollbackTagActions(tagRollback);
      throw applyErr;
    }

    await writeJsonSafe(join(revisionDir, 'metadata.json'), {
      revisionId,
      planId,
      project: plan.project,
      createdAt: new Date().toISOString(),
      operations: plan.operations,
      snapshots,
      tagRollback,
      results,
    });

    aiPlans.delete(planId);
    res.json({
      success: true,
      revisionId,
      appliedCount: results.length,
      results,
      message: 'Changes applied. Use /api/projects/ai/revert with revisionId to roll back.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Revert a previously applied AI revision */
router.post('/ai/revert', async (req, res) => {
  try {
    const revisionId = req.body?.revisionId;
    if (!revisionId) return res.status(400).json({ success: false, error: 'revisionId is required' });
    const revisionDir = join(REVISION_ROOT, basename(String(revisionId)));
    const metadataPath = join(revisionDir, 'metadata.json');
    const metadata = await readJsonSafe(metadataPath);
    if (!metadata) return res.status(404).json({ success: false, error: 'Revision metadata not found' });

    await restoreProjectSnapshots(metadata.snapshots || {}, revisionDir);
    await rollbackTagActions(metadata.tagRollback || []);

    res.json({
      success: true,
      revertedRevision: revisionId,
      projectsRestored: Object.keys(metadata.snapshots || {}),
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Get project details with resource counts */
router.get('/:project', async (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.params.project);
    const projectDir = getProjectDir(projectName);
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
      project: { name: projectName, ...meta, viewCount: views.filter(v => v.isView).length, scriptCount: scripts.length, queryCount: queries.length },
      perspectiveUrl: `${GATEWAY_URL}/data/perspective/client/${projectName}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Update project metadata */
router.put('/:project', async (req, res) => {
  try {
    const updated = await updateProjectResource(req.params.project, {
      title: req.body?.title,
      description: req.body?.description,
      enabled: req.body?.enabled,
      inheritable: req.body?.inheritable,
      parent: req.body?.parent,
    });
    res.json({ success: true, project: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Delete a project */
router.delete('/:project', async (req, res) => {
  try {
    const result = await deleteProjectResource(req.params.project);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** List Perspective views */
router.get('/:project/views', async (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.params.project);
    const viewsDir = getViewsDir(projectName);
    if (!await dirExists(viewsDir)) return res.json({ success: true, views: [] });
    const views = await scanViews(viewsDir);
    res.json({
      success: true, views,
      perspectiveUrl: `${GATEWAY_URL}/data/perspective/client/${projectName}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Read a specific view */
router.get('/:project/view', async (req, res) => {
  try {
    const viewPath = normalizeResourcePath(req.query.path, 'view path');
    if (!viewPath) return res.status(400).json({ success: false, error: 'path query parameter required' });
    const viewDir = safePath(getViewsDir(req.params.project), viewPath);
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
    await updateViewResource(req.params.project, viewPath, content);
    console.log(`[projects] Updated view ${viewPath} in ${req.params.project}`);
    res.json({ success: true, message: 'View updated' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Apply partial view modifications (tag replacements/property updates/components). */
router.post('/:project/view/modify', async (req, res) => {
  try {
    const viewPath = req.body?.path;
    const modifications = req.body?.modifications || {};
    if (!viewPath) return res.status(400).json({ success: false, error: 'path is required' });
    const result = await modifyViewResource(req.params.project, viewPath, modifications);
    res.json({ success: true, ...result, message: 'View modified' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Create a new view */
router.post('/:project/views', async (req, res) => {
  try {
    const { name, template = 'blank', content = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: 'View name required' });
    const created = await createViewResource(req.params.project, name, template, content);
    console.log(`[projects] Created view ${created.path} in ${req.params.project}`);
    res.json({ success: true, name: created.path, message: 'View created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Delete a view */
router.delete('/:project/view', async (req, res) => {
  try {
    const viewPath = req.query.path || req.body?.path;
    if (!viewPath) return res.status(400).json({ success: false, error: 'path required' });
    await deleteViewResource(req.params.project, viewPath);
    console.log(`[projects] Deleted view ${viewPath} from ${req.params.project}`);
    res.json({ success: true, message: 'View deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** List scripts */
router.get('/:project/scripts', async (req, res) => {
  try {
    const scriptsDir = getScriptsDir(req.params.project);
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
    const target = await resolveScriptTarget(req.params.project, scriptPath, false);
    const content = await readFile(target.filePath, 'utf-8');
    res.json({ success: true, path: target.normalized, content, language: 'python' });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** Create a script */
router.post('/:project/scripts', async (req, res) => {
  try {
    const scriptPath = req.body?.path || req.body?.name;
    if (!scriptPath) return res.status(400).json({ success: false, error: 'path is required' });
    const created = await createOrUpdateScriptResource(req.params.project, scriptPath, req.body?.content ?? '', true);
    res.status(201).json({ success: true, ...created, message: 'Script created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Update an existing script */
router.put('/:project/script', async (req, res) => {
  try {
    const scriptPath = req.body?.path;
    if (!scriptPath) return res.status(400).json({ success: false, error: 'path is required' });
    const updated = await createOrUpdateScriptResource(req.params.project, scriptPath, req.body?.content ?? '', false);
    res.json({ success: true, ...updated, message: 'Script updated' });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** Delete script */
router.delete('/:project/script', async (req, res) => {
  try {
    const scriptPath = req.query.path || req.body?.path;
    if (!scriptPath) return res.status(400).json({ success: false, error: 'path is required' });
    const deleted = await deleteScriptResource(req.params.project, scriptPath);
    res.json({ success: true, ...deleted, message: 'Script deleted' });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** List named queries */
router.get('/:project/named-queries', async (req, res) => {
  try {
    const queriesDir = getQueriesDir(req.params.project);
    if (!await dirExists(queriesDir)) return res.json({ success: true, queries: [] });
    res.json({ success: true, queries: await scanNamedQueries(queriesDir) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Read a named query */
router.get('/:project/named-query', async (req, res) => {
  try {
    const queryPath = req.query.path;
    if (!queryPath) return res.status(400).json({ success: false, error: 'path is required' });
    const target = await resolveNamedQueryTarget(req.params.project, queryPath, false);
    const sql = await readFile(target.sqlFile, 'utf-8');
    const meta = await readJsonSafe(join(target.queryDir, 'resource.json'));
    res.json({ success: true, path: target.normalized, sql, meta });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** Create named query */
router.post('/:project/named-queries', async (req, res) => {
  try {
    const queryPath = req.body?.path || req.body?.name;
    if (!queryPath) return res.status(400).json({ success: false, error: 'path is required' });
    const created = await createOrUpdateNamedQueryResource(req.params.project, queryPath, req.body?.sql ?? '', true);
    res.status(201).json({ success: true, ...created, message: 'Named query created' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/** Update named query */
router.put('/:project/named-query', async (req, res) => {
  try {
    const queryPath = req.body?.path;
    if (!queryPath) return res.status(400).json({ success: false, error: 'path is required' });
    const updated = await createOrUpdateNamedQueryResource(req.params.project, queryPath, req.body?.sql ?? '', false);
    res.json({ success: true, ...updated, message: 'Named query updated' });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/** Delete named query */
router.delete('/:project/named-query', async (req, res) => {
  try {
    const queryPath = req.query.path || req.body?.path;
    if (!queryPath) return res.status(400).json({ success: false, error: 'path is required' });
    const deleted = await deleteNamedQueryResource(req.params.project, queryPath);
    res.json({ success: true, ...deleted, message: 'Named query deleted' });
  } catch (err) {
    const status = err.message?.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

export default router;
