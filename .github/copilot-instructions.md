# Copilot instructions for `ignition-copilot`

## Build, test, and lint commands

Use `scripts/README.md` as the canonical workflow reference.

### Setup
- `pwsh ./scripts/setup.ps1`

### Build
- `npm --prefix demo-app run build` (builds `demo-app/client/dist`, required for `run-all.ps1` unless using Vite client mode)
- `npm --prefix demo-app/client run build` (frontend only)

### Run
- `pwsh ./scripts/run-all.ps1`
- `pwsh ./scripts/run-demo.ps1`
- `pwsh ./scripts/run-mcp.ps1`
- `pwsh ./scripts/status.ps1`
- `pwsh ./scripts/stop-all.ps1`

### Tests
- Full suite: `pwsh ./scripts/test-all.ps1` (frontend build + API smoke checks + `mcp-server/test_basic.py` when `.venv` exists)
- API smoke checks only: `pwsh ./scripts/smoke.ps1`
- Single test script examples:
  - `cd mcp-server && python test_basic.py`
  - `cd mcp-server && python test_connection.py`
  - `cd mcp-server && python test_ai_features.py`

### Lint
- No repo-wide lint command is currently defined in `demo-app/package.json`, `demo-app/client/package.json`, `demo-app/server/package.json`, or `mcp-server` scripts.

## High-level architecture

1. **Client UI (`demo-app/client`)**
   - React SPA with tab-based operator workflows (`App.jsx`).
   - All backend calls are centralized in `client/src/api.js` and target same-origin `/api/*`.
   - Chat uses SSE streaming (`/api/chat/stream`) and renders tool activity in UI.

2. **Demo API + orchestration (`demo-app/server`)**
   - `index.js` serves built frontend (`client/dist`) and mounts modular route handlers under `/api/*`.
   - `services/ollama.js` drives tool-calling chat loops, optional RAG context injection, and session intent memory.
   - `services/rag.js` embeds/searches markdown docs from `server/data/ignition-docs`.
   - `services/ignition.js` proxies Ignition WebDev endpoints and falls back to `services/mockIgnition.js` when gateway access fails or trial mode returns `402`.
   - `routes/projects.js` edits Ignition project files on disk (Perspective views/scripts/queries) via guarded filesystem operations.

3. **MCP server (`mcp-server`)**
   - `ignition_mcp_server.py` is a separate stdio MCP process with tool modules in `mcp-server/tools/*`.
   - Tool dispatch is driven by each module’s `TOOL_NAMES` list and routed through `handle_*_operation` functions.
   - Indexing/view tools (`project_indexer.py`, `view_manipulation.py`) support project analysis and safe view edits.

4. **External/system dependencies**
   - Ignition Gateway (default `http://localhost:8088`) is the live data source.
   - Ollama (default `http://localhost:11434`) is used for chat + embeddings.
   - Config defaults and credentials are read from `mcp-server/config.json` and server env vars.

## Key repository conventions

- Use full Ignition tag paths in the `[default]Folder/Tag` form; both Node and Python layers normalize paths around this convention.
- Keep backend changes split by responsibility:
  - route contracts in `demo-app/server/routes/*`
  - integration/business logic in `demo-app/server/services/*`
  - wire new routes in `demo-app/server/index.js`
- Persisted runtime JSON files are part of normal app behavior:
  - dashboard presets: `demo-app/server/data/dashboard-presets.json`
  - service config: `demo-app/server/data/service-config.json` (password is masked and not persisted)
- For project indexing workflows, use `mcp-server/index_project.py`; it writes `ai-index/` into the target Ignition project directory.
- For AI-driven view modification workflows, `view_manipulation.py` creates timestamped backups in `<project>/ai-backups` before edits.
- When adding new insights/features, follow `docs/extending.md`: update service logic, route exposure, UI surface, and `scripts/smoke.ps1` checks together.
