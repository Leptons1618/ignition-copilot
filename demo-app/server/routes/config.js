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
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
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
    delete safe.ignitionPass; // Don't persist password to disk
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
  config.ignitionPass = config.ignitionPass ? '********' : '';
  res.json(config);
});

router.post('/services', async (req, res) => {
  const { ollamaUrl, ignitionUrl, ignitionProject, ignitionUser, ignitionPass } = req.body || {};

  if (ollamaUrl) runtimeServiceConfig.ollamaUrl = ollamaUrl;
  if (ignitionUrl) runtimeServiceConfig.ignitionUrl = ignitionUrl;
  if (ignitionProject) runtimeServiceConfig.ignitionProject = ignitionProject;
  if (ignitionUser) runtimeServiceConfig.ignitionUser = ignitionUser;
  if (ignitionPass && ignitionPass !== '********') runtimeServiceConfig.ignitionPass = ignitionPass;

  await saveConfig();

  const config = { ...runtimeServiceConfig };
  config.ignitionPass = config.ignitionPass ? '********' : '';
  res.json(config);
});

router.post('/services/test', async (req, res) => {
  const results = {};

  // Test Ollama
  try {
    const ollamaResp = await fetch(`${runtimeServiceConfig.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    results.ollama = { connected: ollamaResp.ok, status: ollamaResp.status };
  } catch (err) {
    results.ollama = { connected: false, error: err.message };
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
