> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Walkthrough

## Architecture

1. Ignition Gateway provides live tags, history, alarms.
2. `mcp-server` exposes MCP tools for AI clients.
3. `demo-app/server` exposes REST endpoints and LLM orchestration.
4. `demo-app/client` provides operator UI and dashboard tooling.

## Runtime Data Flow

1. User asks question in UI chat.
2. Server compacts chat context and adds session intent memory.
3. Server optionally injects RAG snippets.
4. LLM triggers tools (`read_tags`, `query_history`, `get_asset_health`, etc.).
5. Tool results are returned as plain response + chart-friendly payload.

## Dashboard Generation Flow

1. User prompt -> keyword extraction.
2. Tag search in Ignition.
3. Live tag reads + numeric filtering.
4. Historical query for trend series.
5. Asset health and alarm summary enrichment.
6. Widget payload returned to frontend.

## Preset Flow

- Save preset: persisted in `demo-app/server/data/dashboard-presets.json`.
- Load preset: fetch preset + execute dashboard generation.
- Overwrite/Delete supported via REST endpoints.

## Test Flow

- Build frontend (`npm run build`)
- Smoke API endpoints
- Run MCP basic checks

Use:

```powershell
pwsh ./scripts/test-all.ps1
```