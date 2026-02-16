> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Next Steps

## Recommended immediate actions

1. Run and verify:

```powershell
pwsh ./scripts/setup.ps1
pwsh ./scripts/run-all.ps1
pwsh ./scripts/test-all.ps1
```

2. Save 2-3 dashboard presets for demo roles:
- Operator
- Maintenance
- Manager

3. Validate Ignition gateway credentials in `mcp-server/config.json`.

## Recommended enhancements

- Add role-based auth and audit logs
- Add persistent database for presets and reports
- Add alert thresholds per asset type
- Add scheduled report generation