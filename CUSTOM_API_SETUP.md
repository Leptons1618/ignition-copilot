> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Custom API Setup

Use this only if your Ignition project exposes non-default endpoint names or custom auth.

## Where to update

- `demo-app/server/services/ignition.js`
- `mcp-server/ignition_client.py`
- `mcp-server/config.json`

## Verify after changes

```powershell
pwsh ./scripts/smoke.ps1
```

and

```powershell
cd mcp-server
.\.venv\Scripts\python.exe test_endpoints.py
```