/**
 * Backend request logger middleware.
 * Logs all API requests with timing, status, and error info.
 */

import { writeFile, appendFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '..', 'data', 'logs');
const LOG_FILE = join(LOG_DIR, 'api-requests.log');

const MAX_LOG_ENTRIES = 1000;
const eventStore = [];

async function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    await mkdir(LOG_DIR, { recursive: true });
  }
}

function formatEntry(entry) {
  return `[${entry.timestamp}] ${entry.method} ${entry.url} ${entry.status} ${entry.duration}ms${entry.error ? ' ERROR: ' + entry.error : ''}`;
}

/**
 * Express middleware for request logging.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const entry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: (req.headers['user-agent'] || '').slice(0, 100),
      error: res.statusCode >= 400 ? (res.statusMessage || '') : undefined,
    };

    eventStore.push(entry);
    if (eventStore.length > MAX_LOG_ENTRIES) {
      eventStore.splice(0, eventStore.length - MAX_LOG_ENTRIES);
    }

    // Async log to file — don't block response
    const line = formatEntry(entry);
    if (duration > 100 || res.statusCode >= 400) {
      console.log(line);
    }
    appendFile(LOG_FILE, line + '\n').catch(() => {});

    originalEnd.apply(res, args);
  };

  next();
}

/**
 * Get recent log entries.
 */
export function getRecentLogs(count = 50, filter = {}) {
  let logs = [...eventStore].reverse();
  if (filter.method) {
    logs = logs.filter(l => l.method === filter.method);
  }
  if (filter.minStatus) {
    logs = logs.filter(l => l.status >= filter.minStatus);
  }
  return logs.slice(0, count);
}

/**
 * Store frontend events sent from client.
 */
const frontendEvents = [];

export function storeFrontendEvents(events = []) {
  for (const evt of events) {
    frontendEvents.push({
      ...evt,
      receivedAt: new Date().toISOString(),
    });
  }
  if (frontendEvents.length > MAX_LOG_ENTRIES) {
    frontendEvents.splice(0, frontendEvents.length - MAX_LOG_ENTRIES);
  }
}

export function getFrontendEvents(count = 50) {
  return [...frontendEvents].reverse().slice(0, count);
}

// Ensure log directory exists on module load
ensureLogDir().catch(() => {});

export default { requestLogger, getRecentLogs, storeFrontendEvents, getFrontendEvents };
