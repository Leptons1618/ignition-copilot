/**
 * View Builder service — create, edit, list, and validate Ignition Perspective views.
 *
 * Writes directly to the Ignition project filesystem so changes are picked up
 * live by the Ignition Designer / Gateway (auto-sync or manual project scan).
 *
 * Environment:
 *   IGNITION_PROJECT_PATH — absolute path to the Ignition project directory
 *                           e.g. C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot
 *
 * The typical Ignition project layout for Perspective views:
 *   {project}/com.inductiveautomation.perspective/views/{viewPath}/view.json
 *   {project}/com.inductiveautomation.perspective/views/{viewPath}/resource.json
 */

import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_PATH = process.env.IGNITION_PROJECT_PATH || '';

function getViewsRoot() {
  if (!PROJECT_PATH) {
    throw new Error(
      'IGNITION_PROJECT_PATH env var not set. Point it to your Ignition project directory, e.g. ' +
      'C:\\Program Files\\Inductive Automation\\Ignition\\data\\projects\\ignition-copilot'
    );
  }
  // Perspective views live under com.inductiveautomation.perspective/views/
  return path.join(PROJECT_PATH, 'com.inductiveautomation.perspective', 'views');
}

// ────────────────────────────────────────────────────────────────────────────
//  Perspective component templates for AI-driven page generation
// ────────────────────────────────────────────────────────────────────────────

const COMPONENT_TEMPLATES = {
  label: (text, style = {}) => ({
    type: 'ia.display.label',
    version: 0,
    props: { text, style: { fontSize: '14px', ...style } },
  }),

  numericDisplay: (tagPath, label, style = {}) => ({
    type: 'ia.display.label',
    version: 0,
    props: {
      text: `{bindings}`,
      style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', ...style },
    },
    custom: {},
    propConfig: {
      props: {
        text: {
          binding: {
            type: 'tag',
            config: { path: tagPath, mode: 'direct' },
          },
        },
      },
    },
    meta: { name: label || tagPath.split('/').pop() },
  }),

  flexContainer: (children = [], direction = 'column', style = {}) => ({
    type: 'ia.container.flex',
    version: 0,
    props: {
      direction,
      style: { padding: '10px', gap: '8px', ...style },
    },
    children,
  }),

  card: (title, children = [], style = {}) => ({
    type: 'ia.container.flex',
    version: 0,
    props: {
      direction: 'column',
      style: {
        background: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        padding: '16px',
        gap: '8px',
        ...style,
      },
    },
    children: [
      {
        type: 'ia.display.label',
        version: 0,
        props: {
          text: title,
          style: { fontSize: '18px', fontWeight: '600', color: '#1a1a2e', marginBottom: '8px' },
        },
        meta: { name: `${title}_header` },
      },
      ...children,
    ],
    meta: { name: `card_${title.replace(/\s+/g, '_')}` },
  }),

  tagBinding: (tagPath) => ({
    binding: {
      type: 'tag',
      config: { path: tagPath, mode: 'direct' },
    },
  }),

  ledDisplay: (tagPath, label, trueColor = '#00e676', falseColor = '#757575') => ({
    type: 'ia.display.icon',
    version: 0,
    props: {
      path: 'material/fiber_manual_record',
      style: { fontSize: '24px', color: `{bindings}` },
    },
    propConfig: {
      props: {
        style: {
          color: {
            binding: {
              type: 'expr',
              config: {
                expression: `if({[default]${tagPath}}, '${trueColor}', '${falseColor}')`,
              },
            },
          },
        },
      },
    },
    meta: { name: label || 'led' },
  }),

  gauge: (tagPath, label, min = 0, max = 100) => ({
    type: 'ia.chart.gauge',
    version: 0,
    props: {
      value: 0,
      min,
      max,
      style: { width: '200px', height: '200px' },
    },
    propConfig: {
      props: {
        value: {
          binding: {
            type: 'tag',
            config: { path: tagPath, mode: 'direct' },
          },
        },
      },
    },
    meta: { name: label || tagPath.split('/').pop() },
  }),

  sparkline: (tagPath, label) => ({
    type: 'ia.chart.timeseries',
    version: 0,
    props: {
      style: { height: '120px' },
      pens: [
        {
          name: label || tagPath.split('/').pop(),
          visible: true,
          selectable: true,
          source: { type: 'tag-history', config: { tagPaths: [tagPath], range: { hours: 1 } } },
        },
      ],
    },
    meta: { name: `sparkline_${label || 'chart'}` },
  }),
};

// ────────────────────────────────────────────────────────────────────────────
//  Core operations
// ────────────────────────────────────────────────────────────────────────────

/**
 * List all views in the project.
 * @returns {{ views: string[] }}
 */
export async function listViews() {
  const root = getViewsRoot();
  try {
    await fs.access(root);
  } catch {
    return { views: [], root, note: 'Views directory not found — check IGNITION_PROJECT_PATH' };
  }

  const views = [];
  async function walk(dir, prefix = '') {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      const viewPath = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) {
        // Check if this directory contains view.json
        try {
          await fs.access(path.join(fullPath, 'view.json'));
          views.push(viewPath);
        } catch {
          // Not a view leaf — recurse
        }
        await walk(fullPath, viewPath);
      }
    }
  }
  await walk(root);
  return { views, root };
}

/**
 * Read a view's JSON.
 */
export async function getView(viewPath) {
  const viewFile = path.join(getViewsRoot(), viewPath, 'view.json');
  const data = await fs.readFile(viewFile, 'utf-8');
  return JSON.parse(data);
}

/**
 * Create a new Perspective view with given JSON structure.
 * Creates the directory + view.json + resource.json.
 */
export async function createView(viewPath, viewJson) {
  const root = getViewsRoot();
  const viewDir = path.join(root, viewPath);

  await fs.mkdir(viewDir, { recursive: true });

  await fs.writeFile(
    path.join(viewDir, 'view.json'),
    JSON.stringify(viewJson, null, 2),
    'utf-8'
  );

  const resource = {
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
      lastModificationSignature: 'copilot-generated',
    },
  };
  await fs.writeFile(
    path.join(viewDir, 'resource.json'),
    JSON.stringify(resource, null, 2),
    'utf-8'
  );

  return { status: 'created', viewPath, fullPath: viewDir };
}

/**
 * Update an existing view's JSON (with optional backup).
 */
export async function updateView(viewPath, viewJson, backup = true) {
  const root = getViewsRoot();
  const viewFile = path.join(root, viewPath, 'view.json');

  // Ensure view exists
  await fs.access(viewFile);

  if (backup) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(root, '..', 'ai-backups', `${viewPath.replace(/\//g, '_')}_${ts}`);
    await fs.mkdir(backupDir, { recursive: true });
    const original = await fs.readFile(viewFile, 'utf-8');
    await fs.writeFile(path.join(backupDir, 'view.json'), original, 'utf-8');
  }

  await fs.writeFile(viewFile, JSON.stringify(viewJson, null, 2), 'utf-8');

  // Touch resource.json timestamp
  const resFile = path.join(root, viewPath, 'resource.json');
  try {
    const resData = JSON.parse(await fs.readFile(resFile, 'utf-8'));
    resData.attributes = resData.attributes || {};
    resData.attributes.lastModification = {
      actor: 'copilot-ai',
      timestamp: new Date().toISOString(),
    };
    await fs.writeFile(resFile, JSON.stringify(resData, null, 2), 'utf-8');
  } catch {
    // resource.json may not exist — not fatal
  }

  return { status: 'updated', viewPath };
}

/**
 * Delete a view.
 */
export async function deleteView(viewPath) {
  const viewDir = path.join(getViewsRoot(), viewPath);
  await fs.rm(viewDir, { recursive: true, force: true });
  return { status: 'deleted', viewPath };
}

/**
 * Validate a view's JSON structure.
 */
export async function validateView(viewPath) {
  const errors = [];
  const warnings = [];

  try {
    const data = await getView(viewPath);
    if (!data.root) errors.push("Missing 'root' element");
    if (!data.root?.type) warnings.push("Root missing 'type' — will default to ia.container.flex");

    // Check bindings
    const bindings = collectBindings(data);
    for (const b of bindings) {
      if (b.type === 'tag' && !b.config?.path) {
        warnings.push(`Tag binding missing path`);
      }
    }

    return { valid: errors.length === 0, errors, warnings, bindingCount: bindings.length };
  } catch (err) {
    return { valid: false, errors: [err.message], warnings };
  }
}

function collectBindings(obj, bindings = []) {
  if (!obj || typeof obj !== 'object') return bindings;
  if (obj.binding) bindings.push(obj.binding);
  for (const val of Object.values(obj)) {
    collectBindings(val, bindings);
  }
  return bindings;
}

// ────────────────────────────────────────────────────────────────────────────
//  AI-driven page generation helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Generate a dashboard view from a list of tag paths.
 * Creates a card-based layout with gauges, values, and status indicators.
 *
 * @param {string} viewName
 * @param {object[]} tags - [{ path, name, dataType, value }]
 * @param {object} opts - { title, columns }
 */
export function generateDashboardView(viewName, tags, opts = {}) {
  const title = opts.title || viewName.replace(/[/_]/g, ' ');
  const columns = opts.columns || 3;

  const cards = [];
  for (const tag of tags) {
    const tagPath = tag.path.startsWith('[') ? tag.path : `[default]${tag.path}`;
    const label = tag.name || tag.path.split('/').pop();
    const dataType = (tag.dataType || '').toLowerCase();

    let cardChildren;
    if (dataType.includes('bool')) {
      cardChildren = [COMPONENT_TEMPLATES.ledDisplay(tag.path, label)];
    } else if (dataType.includes('float') || dataType.includes('int')) {
      cardChildren = [
        COMPONENT_TEMPLATES.numericDisplay(tagPath, label),
        COMPONENT_TEMPLATES.sparkline(tagPath, label),
      ];
    } else {
      cardChildren = [COMPONENT_TEMPLATES.numericDisplay(tagPath, label)];
    }

    cards.push(COMPONENT_TEMPLATES.card(label, cardChildren));
  }

  // Arrange cards in rows
  const rows = [];
  for (let i = 0; i < cards.length; i += columns) {
    rows.push(
      COMPONENT_TEMPLATES.flexContainer(cards.slice(i, i + columns), 'row', {
        flexWrap: 'wrap',
        gap: '16px',
        justifyContent: 'flex-start',
      })
    );
  }

  const viewJson = {
    custom: {},
    params: {},
    props: {
      defaultSize: { width: 1200, height: 800 },
    },
    root: {
      type: 'ia.container.flex',
      version: 0,
      props: {
        direction: 'column',
        style: {
          padding: '24px',
          gap: '16px',
          background: '#f0f2f5',
          minHeight: '100%',
        },
      },
      children: [
        {
          type: 'ia.display.label',
          version: 0,
          props: {
            text: title,
            style: {
              fontSize: '28px',
              fontWeight: '700',
              color: '#1a1a2e',
              padding: '0 0 8px 0',
              borderBottom: '2px solid #e0e0e0',
            },
          },
          meta: { name: 'page_title' },
        },
        ...rows,
      ],
      meta: { name: 'root' },
    },
  };

  return viewJson;
}

export { COMPONENT_TEMPLATES, PROJECT_PATH };
