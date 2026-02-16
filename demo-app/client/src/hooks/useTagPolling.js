import { useState, useEffect, useRef, useCallback } from 'react';
import { readTags } from '../api.js';

/**
 * Poll tag values at a configurable interval.
 * Returns { values: Record<string, { value, quality, timestamp }>, loading, lastUpdated }.
 */
export default function useTagPolling(paths = [], intervalMs = 10000) {
  const [values, setValues] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortRef = useRef(false);

  const poll = useCallback(async () => {
    if (paths.length === 0) return;
    setLoading(true);
    try {
      const result = await readTags(paths);
      if (abortRef.current) return;
      if (result.success !== false && result.results) {
        const next = {};
        result.results.forEach(v => { next[v.path] = v; });
        setValues(next);
        setLastUpdated(Date.now());
      }
    } catch {
      // silent — will retry on next tick
    } finally {
      if (!abortRef.current) setLoading(false);
    }
  }, [paths.join(',')]);

  useEffect(() => {
    abortRef.current = false;
    if (paths.length === 0) {
      setValues({});
      return;
    }
    poll();
    const iv = setInterval(poll, intervalMs);
    return () => {
      abortRef.current = true;
      clearInterval(iv);
    };
  }, [poll, intervalMs]);

  return { values, loading, lastUpdated, refresh: poll };
}
