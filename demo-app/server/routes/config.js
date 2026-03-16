/**
 * Service configuration routes.
 * Runtime management of Ollama URL, Ignition Gateway URL, etc.
 */

import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { updateChatConfig } from '../services/ollama.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'data', 'service-config.json');
const MASK = '********';
const LLM_PROVIDERS = new Set(['none', 'ollama', 'openai', 'google', 'anthropic', 'openai-compatible']);
const SETUP_STEPS = ['llmSelected', 'llmConfigured', 'llmVerified', 'ignitionScriptsInstalled', 'ignitionVerified', 'mcpConfigured'];

const defaults = {
  llmProvider: process.env.LLM_PROVIDER || 'none',
  llmBaseUrl: process.env.LLM_BASE_URL || '',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmModel: process.env.LLM_MODEL || '',
  // Legacy field retained for compatibility with older clients.
  ollamaUrl: process.env.OLLAMA_URL || '',
  ignitionUrl: process.env.IGNITION_URL || 'http://localhost:8088',
  ignitionProject: process.env.IGNITION_PROJECT || 'ignition-copilot',
  ignitionUser: process.env.IGNITION_USER || 'anish',
  ignitionPass: process.env.IGNITION_PASS || 'developer',
  setupChecklist: {},
};

let runtimeServiceConfig = { ...defaults };

function normalizeConfigShape() {
  if (typeof runtimeServiceConfig.setupChecklist !== 'object' || runtimeServiceConfig.setupChecklist === null) {
    runtimeServiceConfig.setupChecklist = {};
  }

  if (runtimeServiceConfig.llmProvider === 'ollama' && !runtimeServiceConfig.llmBaseUrl && runtimeServiceConfig.ollamaUrl) {
    runtimeServiceConfig.llmBaseUrl = runtimeServiceConfig.ollamaUrl;
  }

  if (runtimeServiceConfig.llmProvider === 'ollama') {
    runtimeServiceConfig.ollamaUrl = runtimeServiceConfig.llmBaseUrl || runtimeServiceConfig.ollamaUrl || '';
  }

  if (!LLM_PROVIDERS.has(runtimeServiceConfig.llmProvider)) {
    runtimeServiceConfig.llmProvider = 'none';
  }
}

function syncChatRuntimeConfig() {
  updateChatConfig({
    provider: runtimeServiceConfig.llmProvider,
    baseUrl: runtimeServiceConfig.llmBaseUrl,
    apiKey: runtimeServiceConfig.llmApiKey,
    model: runtimeServiceConfig.llmModel,
    ollamaUrl: runtimeServiceConfig.llmProvider === 'ollama' ? runtimeServiceConfig.llmBaseUrl : undefined,
  });
}

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    const saved = JSON.parse(raw);
    runtimeServiceConfig = { ...defaults, ...saved };
  } catch {
    runtimeServiceConfig = { ...defaults };
  }
  normalizeConfigShape();
  syncChatRuntimeConfig();
}

async function saveConfig() {
  try {
    await mkdir(dirname(CONFIG_PATH), { recursive: true });
    const safe = { ...runtimeServiceConfig };
    delete safe.ignitionPass; // Don't persist password to disk
    delete safe.llmApiKey; // Don't persist API key to disk
    await writeFile(CONFIG_PATH, JSON.stringify(safe, null, 2));
  } catch (err) {
    console.error('Failed to save service config:', err.message);
  }
}

// Load on startup
loadConfig();

const router = Router();

router.get('/services', (req, res) => {
  const config = { ...runtimeServiceConfig };
  // Mask password
  config.ignitionPass = config.ignitionPass ? MASK : '';
  config.llmApiKey = config.llmApiKey ? MASK : '';
  res.json(config);
});

router.post('/services', async (req, res) => {
  const {
    llmProvider,
    llmBaseUrl,
    llmApiKey,
    llmModel,
    ollamaUrl,
    ignitionUrl,
    ignitionProject,
    ignitionUser,
    ignitionPass,
  } = req.body || {};

  if (typeof llmProvider === 'string' && LLM_PROVIDERS.has(llmProvider)) runtimeServiceConfig.llmProvider = llmProvider;
  if (typeof llmBaseUrl === 'string') runtimeServiceConfig.llmBaseUrl = llmBaseUrl;
  if (typeof llmModel === 'string') runtimeServiceConfig.llmModel = llmModel;
  if (typeof llmApiKey === 'string' && llmApiKey !== MASK) runtimeServiceConfig.llmApiKey = llmApiKey;

  if (typeof ollamaUrl === 'string') {
    runtimeServiceConfig.ollamaUrl = ollamaUrl;
    if (!runtimeServiceConfig.llmBaseUrl || runtimeServiceConfig.llmProvider === 'ollama') {
      runtimeServiceConfig.llmBaseUrl = ollamaUrl;
    }
  }

  if (typeof ignitionUrl === 'string') runtimeServiceConfig.ignitionUrl = ignitionUrl;
  if (typeof ignitionProject === 'string') runtimeServiceConfig.ignitionProject = ignitionProject;
  if (typeof ignitionUser === 'string') runtimeServiceConfig.ignitionUser = ignitionUser;
  if (typeof ignitionPass === 'string' && ignitionPass !== MASK) runtimeServiceConfig.ignitionPass = ignitionPass;

  if (typeof req.body?.setupChecklist === 'object' && req.body.setupChecklist) {
    runtimeServiceConfig.setupChecklist = {
      ...runtimeServiceConfig.setupChecklist,
      ...req.body.setupChecklist,
    };
  }

  normalizeConfigShape();
  syncChatRuntimeConfig();

  await saveConfig();

  const config = { ...runtimeServiceConfig };
  config.ignitionPass = config.ignitionPass ? MASK : '';
  config.llmApiKey = config.llmApiKey ? MASK : '';
  res.json(config);
});

router.get('/setup/status', (req, res) => {
  const provider = runtimeServiceConfig.llmProvider;
  const needsApiKey = provider !== 'none' && provider !== 'ollama';
  const status = {
    provider,
    steps: {
      llmSelected: provider !== 'none',
      llmConfigured: provider === 'none'
        ? false
        : Boolean(runtimeServiceConfig.llmBaseUrl && runtimeServiceConfig.llmModel && (!needsApiKey || runtimeServiceConfig.llmApiKey)),
      llmVerified: false,
      ignitionScriptsInstalled: Boolean(runtimeServiceConfig.setupChecklist?.ignitionScriptsInstalled),
      ignitionVerified: false,
      mcpConfigured: Boolean(runtimeServiceConfig.setupChecklist?.mcpConfigured),
    },
    checklist: runtimeServiceConfig.setupChecklist || {},
    manualTasks: [
      {
        id: 'ignitionScriptsInstalled',
        title: 'Install Ignition WebDev scripts',
        instructions: 'Import/deploy required WebDev scripts into your Ignition project for tag browse/read/history/alarm endpoints.',
      },
      {
        id: 'mcpConfigured',
        title: 'Configure MCP server in host environment',
        instructions: 'Set mcp-server/config.json and verify connectivity to Ignition and LLM endpoints.',
      },
    ],
  };
  res.json(status);
});

router.post('/setup/checklist', async (req, res) => {
  const updates = req.body?.checklist;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'checklist object required' });
  }

  const safeUpdates = {};
  for (const key of SETUP_STEPS) {
    if (typeof updates[key] === 'boolean') safeUpdates[key] = updates[key];
  }

  runtimeServiceConfig.setupChecklist = {
    ...runtimeServiceConfig.setupChecklist,
    ...safeUpdates,
  };
  await saveConfig();
  res.json({ success: true, checklist: runtimeServiceConfig.setupChecklist });
});

router.post('/setup/verify', async (req, res) => {
  const checks = {};
  try {
    const provider = runtimeServiceConfig.llmProvider;
    if (provider === 'none') {
      checks.llm = { connected: false, error: 'LLM provider not configured.' };
    } else {
      const llmResults = await verifyLlm();
      checks.llm = llmResults;
    }
  } catch (err) {
    checks.llm = { connected: false, error: err.message };
  }

  try {
    const base = `${runtimeServiceConfig.ignitionUrl}/system/webdev/${runtimeServiceConfig.ignitionProject}`;
    const auth = 'Basic ' + Buffer.from(`${runtimeServiceConfig.ignitionUser}:${runtimeServiceConfig.ignitionPass}`).toString('base64');
    const infoResp = await fetch(`${base}/system_info`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(7000),
    });
    checks.ignition = { connected: infoResp.ok, status: infoResp.status };
  } catch (err) {
    checks.ignition = { connected: false, error: err.message };
  }

  res.json(checks);
});

router.post('/services/test', async (req, res) => {
  const results = {};

  // Test selected LLM provider
  try {
    results.llm = await verifyLlm();
    if (results.llm.provider === 'ollama') {
      results.ollama = { connected: results.llm.connected, status: results.llm.status, error: results.llm.error };
    }
  } catch (err) {
    results.llm = { connected: false, error: err.message, provider: runtimeServiceConfig.llmProvider };
    if (runtimeServiceConfig.llmProvider === 'ollama') {
      results.ollama = { connected: false, error: err.message };
    }
  }

  // Test Ignition
  try {
    const base = `${runtimeServiceConfig.ignitionUrl}/system/webdev/${runtimeServiceConfig.ignitionProject}`;
    const auth = 'Basic ' + Buffer.from(`${runtimeServiceConfig.ignitionUser}:${runtimeServiceConfig.ignitionPass}`).toString('base64');
    const igResp = await fetch(`${base}/system_info`, {
      headers: { Authorization: auth },
      signal: AbortSignal.timeout(5000),
    });
    results.ignition = { connected: igResp.ok, status: igResp.status };
  } catch (err) {
    results.ignition = { connected: false, error: err.message };
  }

  res.json(results);
});

export function getServiceConfig() {
  return { ...runtimeServiceConfig };
}

async function verifyLlm() {
  const provider = runtimeServiceConfig.llmProvider;
  if (provider === 'none') {
    return { connected: false, provider, error: 'LLM provider not configured.' };
  }

  const baseUrl = (runtimeServiceConfig.llmBaseUrl || '').replace(/\/$/, '');
  const apiKey = runtimeServiceConfig.llmApiKey || '';
  let llmResp;

  if (provider === 'ollama') {
    llmResp = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
  } else if (provider === 'openai' || provider === 'openai-compatible') {
    llmResp = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
  } else if (provider === 'google') {
    llmResp = await fetch(`${baseUrl}/v1beta/models?key=${encodeURIComponent(apiKey)}`, {
      signal: AbortSignal.timeout(8000),
    });
  } else if (provider === 'anthropic') {
    llmResp = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(8000),
    });
  }

  if (!llmResp) throw new Error(`Unsupported provider: ${provider}`);
  return { connected: llmResp.ok, status: llmResp.status, provider };
}

export default router;
