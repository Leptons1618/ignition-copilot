> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Project Summary

Ignition Copilot is a practical demo stack for industrial automation workflows.

## Core capabilities

- Live tag browsing/reading/writing
- Historian trend queries
- Alarm status and journal summaries
- Asset health scoring and recommendations
- LLM-assisted operations with session context
- RAG-backed Ignition documentation help
- Dashboard generation from natural language
- Dashboard preset save/load/overwrite/delete

## Services

- `demo-app/client`: Operator UI
- `demo-app/server`: API + orchestration
- `mcp-server`: MCP tool server

## Operations

- Setup: `pwsh ./scripts/setup.ps1`
- Run all: `pwsh ./scripts/run-all.ps1`
- Test all: `pwsh ./scripts/test-all.ps1`