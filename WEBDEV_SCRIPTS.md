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

## Automation helper (semi-automatic setup)

Generate one file per WebDev endpoint script:

```bash
python mcp-server/generate_webdev_resources.py
```

Generated output folder:

- `mcp-server/ignition-automation/webdev-resources/`

This generates ready-to-paste files for:

- `tag_browse`, `tag_read`, `tag_write`, `tag_search`, `tag_config`, `tag_delete`
- `history_query`, `alarm_active`, `alarm_journal`, `system_info`, `script_exec`

After pasting into matching Ignition WebDev resources and publishing the project, run:

```bash
cd mcp-server && python test_endpoints.py
```