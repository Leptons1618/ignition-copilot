> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# File Bridge Setup

If you need file-based handoff between gateway scripts and external services, keep it isolated.

## Recommended pattern

- Gateway writes structured JSON payloads to controlled paths.
- External worker reads payloads and writes responses.
- All file paths are environment-configurable.

## Do not use for primary runtime path

Primary runtime should stay API-driven through:

- `demo-app/server/services/ignition.js`
- `mcp-server/ignition_client.py`

Use file bridge only for constrained environments.