> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# MCP/API Reference

## Demo API endpoints (`demo-app/server`)

- `GET /api/health`
- `POST /api/chat`
- `GET /api/chat/tools`
- `GET /api/chat/models`
- `GET /api/ignition/*`
- `POST /api/charts/timeseries`
- `GET /api/scenarios`
- `POST /api/scenarios/run/:id`
- `GET /api/insights/asset-health`
- `GET /api/insights/alarm-summary`
- `POST /api/dashboard/generate`
- `GET /api/dashboard/presets`
- `POST /api/dashboard/presets`
- `PUT /api/dashboard/presets/:id`
- `DELETE /api/dashboard/presets/:id`
- `POST /api/dashboard/presets/:id/load`

## MCP server entrypoint

- `mcp-server/ignition_mcp_server.py`

Run quick verification:

```powershell
pwsh ./scripts/smoke.ps1
```