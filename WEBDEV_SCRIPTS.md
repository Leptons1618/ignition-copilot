> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# WebDev Scripts

This project uses WebDev endpoints under your Ignition project for tag/history/alarm operations.

## Primary implementation files

- `mcp-server/fixed_webdev_scripts.py`
- `mcp-server/tools/*`
- `demo-app/server/services/ignition.js`

## Expected endpoint categories

- Tag operations: browse/read/write/search/config/delete
- Historian: history query
- Alarms: active/journal
- System: gateway info
- Script execution

## Validation

Run endpoint checks from `mcp-server`:

```powershell
.\.venv\Scripts\python.exe test_endpoints.py
```

If endpoint names differ in your project, update:

- `demo-app/server/services/ignition.js`
- `mcp-server/ignition_client.py`