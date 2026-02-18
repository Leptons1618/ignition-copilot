> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Copilot

Industrial automation demo stack with:

- `demo-app`: React + Express operator-facing application
- `mcp-server`: Python MCP server for Ignition integration
- **AI Indexing & View Manipulation**: Advanced project analysis and safe view editing
- Ignition Gateway assets (`tags.json`, `syntheticDataGen.py`)

## Services

- Frontend: `http://localhost:3001`
- Demo API: `http://localhost:3001`
- MCP server: stdio process (`mcp-server/ignition_mcp_server.py`)
- Ignition Gateway (external dependency): usually `http://localhost:8088`

## New: AI-Powered Features

The MCP server now includes advanced AI capabilities:

### Project Indexing
- Automatically extract and catalog all views, scripts, tags, and dependencies
- Build comprehensive dependency graphs
- Enable intelligent querying and impact analysis

### View Manipulation
- Create new views from templates with automatic tag replacement
- Safely modify existing views with automatic backup
- Add components and update properties
- Validate view structure and bindings

**Quick Start:**
```bash
# Index your project
cd mcp-server
python index_project.py --project "C:\Path\To\Ignition\Project" --tags "../tags.json"

# Query tag usage
python index_project.py --project "C:\Path\To\Ignition\Project" --query tag --path "[default]Pump01/Status"
```

**Documentation:**
- `AI_FEATURES_QUICKSTART.md` - Quick start guide
- `docs/AI_INDEXING_GUIDE.md` - Comprehensive documentation
- `NEWFEATURE.md` - Feature specification
- `IGNITION_INDEXING_SCHEMA.md` - Index schema details

## Standard Workflow

1. Install dependencies:

```powershell
pwsh ./scripts/setup.ps1
```

2. Start everything:

```powershell
npm --prefix demo-app run build
pwsh ./scripts/run-all.ps1
```

3. Check status:

```powershell
pwsh ./scripts/status.ps1
```

3. Run tests/smoke checks:

```powershell
pwsh ./scripts/test-all.ps1
```

4. Stop services:

```powershell
pwsh ./scripts/stop-all.ps1
```

## If `run-all.ps1` fails

- Check logs in `scripts/.logs`.
- Re-run setup:
  - `pwsh ./scripts/setup.ps1`
- Verify status:
  - `pwsh ./scripts/status.ps1`

## Script Index

See `scripts/README.md`.

## Documentation Map

- `QUICKSTART.md`: fastest path to run
- `SETUP_GUIDE.md`: full setup and prerequisites
- `WALKTHROUGH.md`: architecture and runtime flow
- `docs/mcp_api_reference.md`: service endpoints and operations
- `scenarios/`: demo scripts for live presentations

## Notes

- `demo-app` includes dashboard generation, preset save/load, trends, asset-health, and alarm summary.
- RAG content is sourced from `demo-app/server/data/ignition-docs`.
- For a production deployment, add proper auth, TLS, role controls, and monitoring.
