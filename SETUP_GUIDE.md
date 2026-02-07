# Ignition MCP Smart Operations - Setup Guide

Complete step-by-step installation and configuration guide.

## Prerequisites

### Software Requirements
- **Ignition Gateway 8.1+**
  - Download from: https://inductiveautomation.com/downloads
  - Standard or Maker Edition acceptable for demo
  - Modules required: Tag Historian, Alarming
  
- **Python 3.8 or higher**
  - Download from: https://www.python.org/downloads/
  - Ensure pip is installed
  
- **Ignition Designer**
  - Comes with Ignition Gateway
  - Used for tag import and script configuration

### Network Requirements
- Ignition Gateway accessible on port 8088 (default)
- Gateway Network enabled (default)
- Web services enabled

## Step 1: Ignition Gateway Setup

### 1.1 Install Ignition Gateway

1. Download Ignition installer
2. Run installer with default settings
3. Complete web-based setup wizard at http://localhost:8088
4. Create admin username/password (remember these!)
5. Install trial license or Maker Edition license

### 1.2 Configure Required Modules

1. Navigate to Config → System → Modules
2. Verify these modules are installed and running:
   - Alarm Notification
   - Tag Historian
   - Gateway Network
   - Web Services (should be default)
3. If missing, download from Inductive Automation and install

### 1.3 Configure Historian

1. Navigate to Config → Tags → History
2. Verify "default" history provider exists
3. Settings:
   - Provider: Database
   - Store and Forward: Enabled
   - Sample Mode: On Change and Period (1000ms)

### 1.4 Create Database Connection (if needed)

1. Navigate to Config → Databases → Connections
2. Default SQLite connection should exist
3. For production: Configure PostgreSQL or SQL Server

## Step 2: Import Tag Structure

### 2.1 Using Ignition Designer

1. Open Ignition Designer
   - Launch Designer from Gateway homepage
   - Or use Designer Launcher
   
2. Import tags.json
   ```
   File → Import Tags
   → Select tags.json from project root
   → Target Provider: [default]
   → Import Mode: Merge/Overwrite
   → Click Import
   ```

3. Verify tag structure:
   ```
   Tag Browser → Expand [default]
   → Should see DemoPlant folder
   → Expand MotorM12
   → Verify all tags present
   ```

### 2.2 Expected Tag Structure

```
[default]
└─ DemoPlant/
   └─ MotorM12/
      ├─ Speed (Float4, RPM)
      ├─ LoadPercent (Float4, %, Historian)
      ├─ Temperature (Float4, °C, Historian, Alarm)
      ├─ FanCurrent (Float4, A, Historian)
      ├─ Running (Boolean)
      ├─ SimulatorEnabled (Boolean)
      ├─ AlarmActive (Boolean)
      ├─ StartCommand (Boolean)
      ├─ ResetAlarm (Boolean)
      ├─ Mode (String)
      ├─ SimState (String)
      ├─ SimTime (Int4)
      └─ FaultReason (String)
```

## Step 3: Install Gateway Timer Script

### 3.1 Create Gateway Event Script

1. In Ignition Designer, navigate to:
   ```
   Project Browser → Project → Scripts → Gateway Events
   ```

2. Right-click "Timer Scripts" → Add Timer Script

3. Configure timer:
   - Name: `PlantSimulator`
   - Execution: Fixed Rate
   - Delay: 1000 (milliseconds)
   - Enabled: ✓

4. Copy entire content from `syntheticDataGen.py` into script editor

5. Save script (Ctrl+S or File → Save)

### 3.2 Verify Script Execution

1. Check for errors in Gateway → Status → Diagnostics → Logs
2. Look for any Python exceptions
3. Verify tag values are updating (use Tag Browser)

## Step 4: Install MCP Server

### 4.1 Create Python Virtual Environment

```bash
# Navigate to project directory
cd D:\Sandbox\ignition-copilot

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 4.2 Install Dependencies

```bash
# Navigate to MCP server directory
cd mcp-server

# Install required packages
pip install -r requirements.txt
```

Expected packages:
- `requests` - HTTP communication with Ignition
- `mcp` - Model Context Protocol SDK
- `python-dateutil` - Date/time handling
- `pandas` - Data analysis for historian

### 4.3 Configure Server

1. Edit `mcp-server/config.json`:

```json
{
  "ignition": {
    "gateway_url": "http://localhost:8088",
    "username": "admin",
    "password": "password",
    "verify_ssl": false
  },
  "mcp": {
    "server_name": "ignition-mcp",
    "version": "1.0.0",
    "capabilities": [
      "tag_operations",
      "historian",
      "alarms",
      "diagnostics"
    ]
  },
  "tags": {
    "default_provider": "default",
    "base_path": "DemoPlant/MotorM12"
  }
}
```

2. Update credentials to match your Ignition Gateway

## Step 5: Test MCP Server

### 5.1 Start Server

```bash
# From mcp-server directory with venv activated
python ignition_mcp_server.py
```

Expected output:
```
Ignition MCP Server starting...
Connected to Ignition Gateway at http://localhost:8088
MCP Server listening on stdio
Available tools: 15
Server ready for connections
```

### 5.2 Test Basic Connectivity

```bash
# In another terminal, test tag read
curl -X POST http://localhost:8088/system/gwinfo
```

Should return Ignition Gateway info.

## Step 6: Configure MCP Client

### 6.1 Using with Claude Desktop

1. Edit Claude Desktop config:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

2. Add MCP server configuration:

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

3. Restart Claude Desktop

### 6.2 Verify MCP Connection

In Claude Desktop, you should see:
- MCP icon/indicator showing "ignition" server connected
- Tools available when typing commands

Test with: "What tools do you have access to for Ignition?"

## Step 7: Run First Demo

### 7.1 Start Simulation

1. **Using Ignition Designer:**
   - Tag Browser → [default]DemoPlant/MotorM12/SimulatorEnabled
   - Right-click → Edit Value → Set to `true`

2. **Using MCP Client (Claude):**
   ```
   "Start the MotorM12 simulator"
   ```

### 7.2 Monitor Progression

Watch tags update in real-time:
- Temperature should start at 45°C
- FanCurrent starts at 8.5A
- After 20 seconds, fan begins degrading
- Temperature begins rising
- Around 85°C, alarm activates and motor trips

### 7.3 Query via AI

```
"What is the current state of MotorM12?"
"Show me the temperature trend"
"Why did the alarm activate?"
"What's the fault reason?"
```

### 7.4 Reset Simulation

```
"Reset the MotorM12 simulator"
```

Or manually set `ResetAlarm` tag to `true`.

## Troubleshooting

### Gateway Script Not Running

**Symptom:** Tags not updating
**Solutions:**
- Check Gateway → Status → Diagnostics → Logs for errors
- Verify timer script is enabled
- Check tag paths match exactly (case-sensitive)
- Verify tag provider is "default"

### MCP Server Connection Failed

**Symptom:** Cannot connect to Ignition
**Solutions:**
- Verify Gateway is running (http://localhost:8088)
- Check credentials in config.json
- Verify Gateway Network module is running
- Check firewall settings

### Tags Not Found

**Symptom:** "Tag not found" errors
**Solutions:**
- Verify tags imported correctly
- Check tag provider name is `[default]`
- Verify folder structure: DemoPlant/MotorM12
- Tag names are case-sensitive

### Historian Not Recording

**Symptom:** No historical data available
**Solutions:**
- Verify Tag Historian module installed
- Check tags have `historyEnabled: true`
- Verify history provider "default" exists
- Check database connection is active

### Python Import Errors

**Symptom:** ModuleNotFoundError
**Solutions:**
- Verify virtual environment is activated
- Run `pip install -r requirements.txt` again
- Check Python version is 3.8+

## Next Steps

1. ✅ Review [README.md](README.md) for architecture overview
2. ✅ Read [WALKTHROUGH.md](WALKTHROUGH.md) to understand implementation
3. ✅ Try demonstration scenarios in `scenarios/` directory
4. ✅ Explore MCP API in `docs/mcp_api_reference.md`
5. ✅ Extend system using `docs/extending.md`

## Production Considerations

Before deploying to production:

- [ ] Enable SSL/TLS on Ignition Gateway
- [ ] Use proper authentication (not admin account)
- [ ] Implement role-based access control
- [ ] Configure proper historian database (PostgreSQL/SQL Server)
- [ ] Add error handling and retry logic
- [ ] Implement audit logging
- [ ] Set up monitoring and alerting
- [ ] Create backup and recovery procedures
- [ ] Document change management process
- [ ] Perform security audit
