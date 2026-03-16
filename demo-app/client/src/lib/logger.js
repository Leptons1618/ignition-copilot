const MAX_EVENTS = 1000;
const flushIntervalMs = 5000;
const events = [];
const pending = [];
let flushTimer = null;

function makeEvent(level, category, action, data = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    level,
    category: String(category || 'app'),
    action: String(action || ''),
    data: data && typeof data === 'object' ? data : {},
    timestamp: new Date().toISOString(),
  };
}

function pushEvent(evt) {
  events.push(evt);
  pending.push(evt);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
}

async function flush() {
  if (pending.length === 0) return;
  const batch = pending.splice(0, pending.length);
  try {
    await fetch('/api/logs/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    pending.unshift(...batch);
    if (pending.length > MAX_EVENTS) pending.splice(MAX_EVENTS);
  }
}

const logger = {
  debug(category, action, data = {}) {
    pushEvent(makeEvent('debug', category, action, data));
  },
  info(category, action, data = {}) {
    pushEvent(makeEvent('info', category, action, data));
  },
  warn(category, action, data = {}) {
    pushEvent(makeEvent('warn', category, action, data));
  },
  error(category, action, data = {}) {
    pushEvent(makeEvent('error', category, action, data));
  },
  track(action, data = {}) {
    pushEvent(makeEvent('info', 'tracking', action, data));
  },
  perf(action, durationMs, data = {}) {
    pushEvent(makeEvent('info', 'perf', action, { durationMs, ...data }));
  },
  getEvents(limit = 100, filter = {}) {
    let out = [...events].reverse();
    if (filter.level) out = out.filter(e => e.level === filter.level);
    if (filter.category) out = out.filter(e => e.category === filter.category);
    return out.slice(0, Math.max(1, limit));
  },
  clear() {
    events.splice(0, events.length);
    pending.splice(0, pending.length);
  },
  startAutoFlush() {
    if (flushTimer) return;
    flushTimer = setInterval(() => { flush(); }, flushIntervalMs);
  },
  stopAutoFlush() {
    if (!flushTimer) return;
    clearInterval(flushTimer);
    flushTimer = null;
    flush();
  },
  flush,
};

export default logger;
