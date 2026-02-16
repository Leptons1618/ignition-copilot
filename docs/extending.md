> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Extending

## Add a new insight

1. Implement in `demo-app/server/services/insights.js`.
2. Expose route in `demo-app/server/routes/insights.js`.
3. Add UI in `demo-app/client/src/components`.
4. Add smoke check in `scripts/smoke.ps1`.

## Add a new dashboard widget type

1. Extend payload generation in `demo-app/server/routes/dashboard.js`.
2. Render in `demo-app/client/src/components/DashboardBuilder.jsx`.

## Add a new MCP tool

1. Add tool schema in `demo-app/server/services/ollama.js` (or MCP server tools for Claude).
2. Implement execution path.
3. Test with `scripts/test-all.ps1`.