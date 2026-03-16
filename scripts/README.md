> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Scripts

All operational commands are centralized here.

## PowerShell scripts

- `scripts/setup.ps1`
  - Installs Node/Python dependencies for `demo-app` and `mcp-server`.
- `scripts/run-demo.ps1`
  - Starts demo backend (`:3001`) serving `demo-app/client/dist`.
  - Optional: `-UseViteClient` for `:3000` dev server, `-RebuildFrontend` to rebuild dist first.
- `scripts/run-mcp.ps1`
  - Starts the Python MCP server from `mcp-server` as a background process.
- `scripts/run-all.ps1`
  - Starts demo app and MCP server together with health checks.
- `scripts/status.ps1`
  - Shows process/PID and API health state.
- `scripts/stop-all.ps1`
  - Stops processes started by the scripts.
- `scripts/smoke.ps1`
  - Runs API smoke checks for the demo app.
- `scripts/test-all.ps1`
  - Runs build + smoke tests for all local services.

## Bash script (Linux/macOS)

- `scripts/run.sh`
  - Unified shell runner for setup/build/run/smoke/test/status/stop workflows.
  - Supports: `run-demo --vite --rebuild`, `run-all --skip-smoke` (auto rebuild by default; use `--no-rebuild` to skip).
  - MCP stdio mode is supported via an internal keepalive pipe so `run-mcp` and `run-all` can keep MCP running in background.

## Usage

```powershell
pwsh ./scripts/setup.ps1
npm --prefix demo-app run build
pwsh ./scripts/run-all.ps1
pwsh ./scripts/status.ps1
pwsh ./scripts/test-all.ps1
pwsh ./scripts/stop-all.ps1
```

```bash
./scripts/run.sh setup
./scripts/run.sh build
./scripts/run.sh run-all
./scripts/run.sh status
./scripts/run.sh test
./scripts/run.sh stop
```

## Logs and PIDs

- Logs: `scripts/.logs/*.log`
- PID file: `scripts/.pids.json`
- Linux PID file: `scripts/.pids-linux.env`
