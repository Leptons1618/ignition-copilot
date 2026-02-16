> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Setup Guide

## Prerequisites

- Windows PowerShell or PowerShell 7
- Node.js 18+
- Python 3.10+
- Ignition Gateway 8.1+

## Repository Setup

```powershell
pwsh ./scripts/setup.ps1
```

What this does:

- Installs npm dependencies for `demo-app`
- Creates `mcp-server/.venv` and installs `requirements.txt`

## Ignition Setup

1. Import tags from `tags.json`.
2. Configure a Gateway Timer Script using `syntheticDataGen.py`.
3. Validate data is changing under `[default]DemoPlant/MotorM12`.

## MCP Server Config

Edit `mcp-server/config.json`:

- `gateway_url`
- `username`
- `password`
- `project`

## Running Services

- Demo app only:

```powershell
pwsh ./scripts/run-demo.ps1
```

- MCP server only:

```powershell
pwsh ./scripts/run-mcp.ps1
```

- All services:

```powershell
pwsh ./scripts/run-all.ps1
```

- Check status:

```powershell
pwsh ./scripts/status.ps1
```

## Validation

- Smoke checks:

```powershell
pwsh ./scripts/smoke.ps1
```

- Full test pass:

```powershell
pwsh ./scripts/test-all.ps1
```

- Stop all:

```powershell
pwsh ./scripts/stop-all.ps1
```

## Outputs

- Frontend: `http://localhost:3000`
- API: `http://localhost:3001`
- Health endpoint: `http://localhost:3001/api/health`
