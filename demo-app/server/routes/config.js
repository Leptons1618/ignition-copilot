/**
 * Service configuration routes.
 * Runtime management of Ollama URL, Ignition Gateway URL, etc.
 */

import { Router } from 'express';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'data', 'service-config.json');

const defaults = {
  llmProvider: 'ollama',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || '',
  // GitHub Copilot
  copilotModel: 'gpt-4o',
  copilotToken: '',
  // OpenAI
  openaiApiKey: '',
  openaiModel: 'gpt-4o',
  openaiOrg: '',
  // Custom API
  customApiUrl: '',
  customApiKey: '',
  customModel: '',
  // Ignition
  ignitionUrl: process.env.IGNITION_URL || 'http://localhost:8088',
  ignitionProject: process.env.IGNITION_PROJECT || 'ignition-copilot',
  ignitionUser: process.env.IGNITION_USER || 'anish',
  ignitionPass: process.env.IGNITION_PASS || 'developer',
};

let runtimeServiceConfig = { ...defaults };

async function loadConfig() {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    const saved = JSON.parse(raw);
    runtimeServiceConfig = { ...defaults, ...saved };
  } catch {
    runtimeServiceConfig = { ...defaults };
  }
}

async function saveConfig() {
  try {
    await mkdir(dirname(CONFIG_PATH), { recursive: true });
    const safe = { ...runtimeServiceConfig };
    // Don't persist secrets to disk
    delete safe.ignitionPass;
    delete safe.openaiApiKey;
    delete safe.copilotToken;
    delete safe.customApiKey;
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
  // Mask secrets
  config.ignitionPass = config.ignitionPass ? '********' : '';
  config.openaiApiKey = config.openaiApiKey ? '********' : '';
  config.copilotToken = config.copilotToken ? '********' : '';
  config.customApiKey = config.customApiKey ? '********' : '';
  res.json(config);
});

router.post('/services', async (req, res) => {
  const body = req.body || {};
  const SAFE_FIELDS = [
    'llmProvider', 'ollamaUrl', 'ollamaModel',
    'copilotModel', 'copilotToken',
    'openaiApiKey', 'openaiModel', 'openaiOrg',
    'customApiUrl', 'customApiKey', 'customModel',
    'ignitionUrl', 'ignitionProject', 'ignitionUser', 'ignitionPass',
  ];
  const MASKED = '********';

  for (const field of SAFE_FIELDS) {
    if (body[field] !== undefined && body[field] !== MASKED) {
      runtimeServiceConfig[field] = body[field];
    }
  }

  await saveConfig();

  const config = { ...runtimeServiceConfig };
  config.ignitionPass = config.ignitionPass ? MASKED : '';
  config.openaiApiKey = config.openaiApiKey ? MASKED : '';
  config.copilotToken = config.copilotToken ? MASKED : '';
  config.customApiKey = config.customApiKey ? MASKED : '';
  res.json(config);
});

router.post('/services/test', async (req, res) => {
  const results = {};
  const provider = runtimeServiceConfig.llmProvider || 'ollama';

  // Test LLM provider
  if (provider === 'ollama') {
    try {
      const ollamaResp = await fetch(`${runtimeServiceConfig.ollamaUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      results.ollama = { connected: ollamaResp.ok, status: ollamaResp.status };
    } catch (err) {
      results.ollama = { connected: false, error: err.message };
    }
  } else if (provider === 'openai') {
    try {
      const headers = { 'Authorization': `Bearer ${runtimeServiceConfig.openaiApiKey}` };
      if (runtimeServiceConfig.openaiOrg) headers['OpenAI-Organization'] = runtimeServiceConfig.openaiOrg;
      const openaiResp = await fetch('https://api.openai.com/v1/models', {
        headers, signal: AbortSignal.timeout(5000),
      });
      results.openai = { connected: openaiResp.ok, status: openaiResp.status };
    } catch (err) {
      results.openai = { connected: false, error: err.message };
    }
  } else if (provider === 'custom') {
    try {
      const headers = {};
      if (runtimeServiceConfig.customApiKey) headers['Authorization'] = `Bearer ${runtimeServiceConfig.customApiKey}`;
      const customResp = await fetch(`${runtimeServiceConfig.customApiUrl}/models`, {
        headers, signal: AbortSignal.timeout(5000),
      });
      results.custom = { connected: customResp.ok, status: customResp.status };
    } catch (err) {
      results.custom = { connected: false, error: err.message };
    }
  } else if (provider === 'copilot') {
    results.copilot = { connected: true, status: 200, note: 'Copilot uses VS Code authentication' };
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

export default router;
