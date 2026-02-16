> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Claude MCP Setup

## Prerequisites

- Claude Desktop installed
- `mcp-server/.venv` exists and dependencies installed

## Config

Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "ignition": {
      "command": "D:\\Sandbox\\ignition-copilot\\mcp-server\\.venv\\Scripts\\python.exe",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ]
    }
  }
}
```

## Verify

1. Restart Claude Desktop.
2. Ask for available tools.
3. Run a simple query such as reading a known tag.