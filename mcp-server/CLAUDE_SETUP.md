# Claude Desktop MCP Configuration Example

This file shows how to configure Claude Desktop to connect to the Ignition MCP Server.

## Configuration File Location

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```
Full path: `C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json`

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

## Configuration Content

Edit the file and add the following configuration:

```json
{
  "mcpServers": {
    "ignition": {
      "command": "python",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "D:\\Sandbox\\ignition-copilot\\mcp-server"
      }
    }
  }
}
```

### Important Notes:

1. **Adjust Paths**: Change the paths to match your installation directory
   - Windows: Use double backslashes `\\` or forward slashes `/`
   - macOS/Linux: Use standard forward slashes `/`

2. **Python Path**: Ensure `python` command is in your PATH
   - Test with: `python --version`
   - If using virtual environment, specify full path to venv python

3. **Multiple MCP Servers**: You can have multiple servers:

```json
{
  "mcpServers": {
    "ignition": {
      "command": "python",
      "args": ["D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"]
    },
    "another-server": {
      "command": "node",
      "args": ["/path/to/other/server.js"]
    }
  }
}
```

## Verification

After saving the configuration:

1. **Restart Claude Desktop** completely (quit and reopen)

2. **Check Connection**:
   - Look for MCP indicator in Claude interface
   - Should show "ignition" server connected
   - Green indicator means connected successfully

3. **Test Tools**:
   - Type: "What tools do you have access to?"
   - Should see Ignition tools listed:
     - read_tag
     - write_tag
     - query_history
     - diagnose_motor_issue
     - etc.

4. **Test Functionality**:
   ```
   "What is the current status of MotorM12?"
   ```
   Should return motor status data.

## Troubleshooting

### Server Not Connecting

**Check Logs**:
- Look in `mcp-server/ignition_mcp.log`
- Check for connection errors

**Common Issues**:

1. **Python not found**:
   - Verify python is in PATH
   - Use full path to python.exe: `"C:\\Python39\\python.exe"`

2. **Module import errors**:
   - Ensure virtual environment is activated
   - Or specify venv python: `"D:\\Sandbox\\ignition-copilot\\venv\\Scripts\\python.exe"`

3. **Config file syntax error**:
   - Validate JSON at https://jsonlint.com/
   - Check for missing commas, quotes

4. **Path issues**:
   - Use absolute paths, not relative
   - Windows: Use `\\` or `/`, not single `\`

### Server Connects But Tools Fail

1. **Check Ignition Gateway**:
   - Is it running? (http://localhost:8088)
   - Can you login?

2. **Check Config**:
   - Edit `mcp-server/config.json`
   - Verify gateway URL, username, password

3. **Test Connection**:
   ```python
   # Run this in terminal:
   cd mcp-server
   python
   >>> from ignition_client import IgnitionClient
   >>> client = IgnitionClient("http://localhost:8088", "admin", "password")
   >>> client.test_connection()
   ```
   Should return `True`.

## Example Queries After Setup

Once connected, try these:

```
"What is the current status of MotorM12?"

"Start the MotorM12 simulator"

"Analyze the temperature trend over the last hour"

"Are there any active alarms?"

"Diagnose what's wrong with the motor"

"Suggest recovery actions"

"Reset the simulator"
```

## Advanced Configuration

### Using Virtual Environment

```json
{
  "mcpServers": {
    "ignition": {
      "command": "D:\\Sandbox\\ignition-copilot\\venv\\Scripts\\python.exe",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ]
    }
  }
}
```

### With Environment Variables

```json
{
  "mcpServers": {
    "ignition": {
      "command": "python",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ],
      "env": {
        "PYTHONPATH": "D:\\Sandbox\\ignition-copilot\\mcp-server",
        "IGNITION_URL": "http://localhost:8088",
        "LOG_LEVEL": "INFO"
      }
    }
  }
}
```

### Multiple Ignition Gateways

```json
{
  "mcpServers": {
    "ignition-production": {
      "command": "python",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ],
      "env": {
        "CONFIG_PATH": "D:\\Sandbox\\ignition-copilot\\mcp-server\\config-prod.json"
      }
    },
    "ignition-dev": {
      "command": "python",
      "args": [
        "D:\\Sandbox\\ignition-copilot\\mcp-server\\ignition_mcp_server.py"
      ],
      "env": {
        "CONFIG_PATH": "D:\\Sandbox\\ignition-copilot\\mcp-server\\config-dev.json"
      }
    }
  }
}
```

## Security Notes

⚠️ **For Production Use**:

1. **Don't store passwords in config files**:
   - Use environment variables
   - Use credential managers
   - Implement OAuth/SSO

2. **Enable SSL**:
   - Use HTTPS for Gateway connection
   - Set `"verify_ssl": true` in config

3. **Restrict Permissions**:
   - Create dedicated MCP user in Ignition
   - Grant minimum required permissions
   - Use role-based access control

4. **Audit Logging**:
   - Enable detailed logging
   - Monitor MCP server access
   - Track all write operations

## Getting Help

If you encounter issues:

1. Check `mcp-server/ignition_mcp.log`
2. Review [SETUP_GUIDE.md](../SETUP_GUIDE.md)
3. Verify Ignition Gateway is accessible
4. Test python dependencies are installed
5. Check file paths are absolute and correct

## Quick Reference

| Platform | Config Location |
|----------|----------------|
| Windows  | `%APPDATA%\Claude\claude_desktop_config.json` |
| macOS    | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Linux    | `~/.config/Claude/claude_desktop_config.json` |

After any changes: **Restart Claude Desktop**
