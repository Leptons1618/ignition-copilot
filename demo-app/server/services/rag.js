/**
 * RAG service for Ignition documentation search.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'data', 'ignition-docs');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';
const RAG_CONCURRENCY = Number(process.env.RAG_CONCURRENCY || 4);

const EMBEDDING_CACHE_LIMIT = 5000;
const SEARCH_CACHE_TTL_MS = 60000;

let documents = [];
let initialized = false;

const embeddingCache = new Map();
const searchCache = new Map();

function log(level, message, meta = {}) {
  const text = `[rag:${level}] ${message}`;
  if (Object.keys(meta).length > 0) console[level](text, meta);
  else console[level](text);
}

function l2Norm(vector = []) {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += vector[i] * vector[i];
  return Math.sqrt(sum) || 1;
}

function normalizeEmbedding(vector = []) {
  const norm = l2Norm(vector);
  return vector.map(v => v / norm);
}

function cosineSimNormalized(a, b) {
  let dot = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot;
}

function trimCache(map, limit) {
  if (map.size <= limit) return;
  const keys = [...map.keys()];
  const removeCount = map.size - limit;
  for (let i = 0; i < removeCount; i++) {
    map.delete(keys[i]);
  }
}

async function embed(text) {
  if (embeddingCache.has(text)) return embeddingCache.get(text);

  const resp = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!resp.ok) throw new Error(`Embed failed: ${resp.status}`);
  const data = await resp.json();
  const vector = data.embeddings?.[0] || data.embedding;
  const normalized = normalizeEmbedding(vector || []);
  embeddingCache.set(text, normalized);
  trimCache(embeddingCache, EMBEDDING_CACHE_LIMIT);
  return normalized;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const out = new Array(items.length);
  let index = 0;

  async function run() {
    while (index < items.length) {
      const current = index;
      index++;
      out[current] = await worker(items[current], current);
    }
  }

  const runners = [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  for (let i = 0; i < limit; i++) runners.push(run());
  await Promise.all(runners);
  return out;
}

function chunkText(text, maxChars = 800, overlap = 100) {
  const chunks = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if (current.length + line.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = current.slice(-overlap) + '\n' + line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function truncateText(text, maxChars) {
  if (!maxChars || text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

export async function initRAG() {
  if (initialized) return documents.length;

  log('info', 'Initializing RAG documents and embeddings');

  if (!existsSync(DOCS_DIR)) {
    log('warn', `Docs directory not found: ${DOCS_DIR}`);
    initialized = true;
    return 0;
  }

  const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
  let totalChunks = 0;

  for (const file of files) {
    const content = readFileSync(join(DOCS_DIR, file), 'utf-8');
    const title = content.split('\n')[0]?.replace(/^#+\s*/, '') || file;
    const chunks = chunkText(content);

    const embeddedChunks = await mapWithConcurrency(chunks, RAG_CONCURRENCY, async (chunk, i) => {
      try {
        const emb = await embed(chunk);
        return {
          id: `${file}#${i}`,
          text: chunk,
          source: file,
          title,
          embedding: emb,
        };
      } catch (err) {
        log('warn', `Failed embedding ${file} chunk ${i}: ${err.message}`);
        return null;
      }
    });

    const valid = embeddedChunks.filter(Boolean);
    documents.push(...valid);
    totalChunks += valid.length;
    log('info', `Loaded ${file}: ${valid.length}/${chunks.length} embedded chunks`);
  }

  initialized = true;
  log('info', `RAG ready with ${totalChunks} embedded chunks`);
  return totalChunks;
}

export async function searchDocs(query, topK = 5, options = {}) {
  const minScore = typeof options.minScore === 'number' ? options.minScore : -1;
  const maxChars = typeof options.maxChars === 'number' ? options.maxChars : 1000;
  const cacheKey = `${query}|${topK}|${minScore}|${maxChars}`;
  const now = Date.now();

  const cached = searchCache.get(cacheKey);
  if (cached && now - cached.ts < SEARCH_CACHE_TTL_MS) {
    return cached.value;
  }

  if (!initialized) await initRAG();
  if (documents.length === 0) {
    return { results: [], query, note: 'No documents loaded' };
  }

  const started = Date.now();
  const queryEmb = await embed(query);

  const scored = documents.map(doc => ({
    ...doc,
    score: cosineSimNormalized(queryEmb, doc.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);

  const filtered = minScore > -1 ? scored.filter(d => d.score >= minScore) : scored;
  const top = filtered.slice(0, topK);

  const value = {
    results: top.map(d => ({
      text: truncateText(d.text, maxChars),
      source: d.source,
      title: d.title,
      score: Math.round(d.score * 1000) / 1000,
    })),
    query,
    totalDocs: documents.length,
    elapsedMs: Date.now() - started,
  };

  if (value.elapsedMs > 500) {
    log('warn', 'Slow RAG query', { query, elapsedMs: value.elapsedMs, docs: documents.length });
  }

  searchCache.set(cacheKey, { ts: now, value });
  trimCache(searchCache, 500);
  return value;
}

export function getRAGStats() {
  return {
    initialized,
    documentCount: documents.length,
    sources: [...new Set(documents.map(d => d.source))],
    embeddingCacheSize: embeddingCache.size,
    searchCacheSize: searchCache.size,
  };
}
