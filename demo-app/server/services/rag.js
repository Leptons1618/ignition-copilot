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

const EMBEDDING_CACHE_LIMIT = 5000;
const SEARCH_CACHE_TTL_MS = 60000;

let documents = [];
let initialized = false;
let initPromise = null;

const embeddingCache = new Map();
const searchCache = new Map();

function cosineSim(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
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
  embeddingCache.set(text, vector);
  trimCache(embeddingCache, EMBEDDING_CACHE_LIMIT);
  return vector;
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
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('Initializing RAG: loading and embedding Ignition docs...');

    if (!existsSync(DOCS_DIR)) {
      console.warn(`Docs directory not found: ${DOCS_DIR}`);
      initialized = true;
      return 0;
    }

    const files = readdirSync(DOCS_DIR).filter(f => f.endsWith('.md'));
    let totalChunks = 0;

    for (const file of files) {
      const content = readFileSync(join(DOCS_DIR, file), 'utf-8');
      const title = content.split('\n')[0]?.replace(/^#+\s*/, '') || file;
      const chunks = chunkText(content);

      for (let i = 0; i < chunks.length; i++) {
        try {
          const emb = await embed(chunks[i]);
          documents.push({
            id: `${file}#${i}`,
            text: chunks[i],
            source: file,
            title,
            embedding: emb,
          });
          totalChunks++;
        } catch (err) {
          console.warn(`Failed embedding ${file} chunk ${i}: ${err.message}`);
        }
      }
      console.log(`Loaded ${file}: ${chunks.length} chunks`);
    }

    initialized = true;
    console.log(`RAG ready with ${totalChunks} embedded chunks`);
    return totalChunks;
  })();

  return initPromise;
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
    score: cosineSim(queryEmb, doc.embedding),
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
