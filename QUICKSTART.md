# Ignition MCP Smart Operations - Quick Start

Get up and running in 15 minutes.

## Prerequisites Check

Before starting, verify you have:

- [ ] Ignition Gateway 8.1+ installed and running
- [ ] Python 3.8+ installed (`python --version`)
- [ ] pip installed (`pip --version`)
- [ ] Network access to Gateway (http://localhost:8088)

## 5-Step Quick Start

### Step 1: Import Tags (2 minutes)

1. Open **Ignition Designer** (launch from Gateway homepage)
2. Go to **File → Import Tags**
3. Select `tags.json` from this directory
4. Click **Import**
5. Verify: Tag Browser shows `[default]` → `DemoPlant` → `MotorM12`

### Step 2: Install Gateway Script (3 minutes)

1. In Designer, go to **Project** → **Scripts** → **Gateway Events**
2. Right-click **Timer Scripts** → **Add Timer Script**
3. Name: `PlantSimulator`
4. Fixed Rate: `1000` ms
5. Copy entire content from `syntheticDataGen.py` into script editor
6. Save (Ctrl+S)
7. Verify: No errors in Gateway logs

### Step 3: Install MCP Server (5 minutes)

```bash
# Create virtual environment
python -m venv venv

# Activate
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
cd mcp-server
pip install -r requirements.txt
```

### Step 4: Configure Connection (2 minutes)

Edit `mcp-server/config.json`:

```json
{
  "ignition": {
    "gateway_url": "http://localhost:8088",
    "username": "admin",
    "password": "your_password_here"
  }
}
```

Replace `your_password_here` with your actual Ignition admin password.

### Step 5: Test Setup (3 minutes)

```bash
# Start MCP server
python ignition_mcp_server.py
```

Expected output:
```
Ignition MCP Server starting...
Connected to Ignition Gateway at http://localhost:8088
MCP Server listening on stdio
Server ready for connections
```

## First Demo

### Manual Test (without AI client)

In Ignition Designer Tag Browser:

1. Set `SimulatorEnabled` to `true`
2. Watch tags update in real-time:
   - Temperature rises
   - FanCurrent decreases
   - After ~85 seconds, alarm activates

3. Set `ResetAlarm` to `true` to reset

### With Claude Desktop

1. **Configure Claude** (see `mcp-server/CLAUDE_SETUP.md`)

2. **Restart Claude Desktop**

3. **Try these queries**:
   ```
   "What is the status of MotorM12?"
   "Start the simulator"
   "Monitor temperature and alert me if it gets concerning"
   ```

## Common Issues

**Issue**: Tags not importing
- **Fix**: Verify Ignition Designer is connected to Gateway

**Issue**: Script errors in logs
- **Fix**: Check tag paths are exactly `[default]DemoPlant/MotorM12/...`

**Issue**: MCP server connection failed
- **Fix**: Verify Gateway URL and credentials in `config.json`

**Issue**: Python module not found
- **Fix**: Ensure virtual environment is activated

## Next Steps

✅ Setup complete? Try these:

1. **Run Scenario 1**: [Fault Detection Demo](scenarios/scenario_1_fault_detection.md)
2. **Read Architecture**: [WALKTHROUGH.md](WALKTHROUGH.md)
3. **Explore API**: [docs/mcp_api_reference.md](docs/mcp_api_reference.md)
4. **Extend System**: [docs/extending.md](docs/extending.md)

## File Checklist

After setup, you should have:

```
ignition-copilot/
├── ✅ README.md
├── ✅ SETUP_GUIDE.md (detailed version)
├── ✅ QUICKSTART.md (this file)
├── ✅ tags.json (imported to Ignition)
├── ✅ syntheticDataGen.py (installed as timer script)
├── ✅ mcp-server/
│   ├── ✅ config.json (configured with your credentials)
│   ├── ✅ ignition_mcp_server.py
│   ├── ✅ ignition_client.py
│   ├── ✅ requirements.txt
│   └── ✅ tools/ (all tool modules)
└── ✅ scenarios/ (demo scripts)
```

## Help

- **Detailed Setup**: See [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Understanding the System**: See [WALKTHROUGH.md](WALKTHROUGH.md)
- **API Documentation**: See [docs/mcp_api_reference.md](docs/mcp_api_reference.md)

## Ready to Demo?

You're all set! The system is now ready to demonstrate:

- ✅ Real-time monitoring
- ✅ Fault detection
- ✅ Historical analysis
- ✅ AI-powered diagnostics
- ✅ Automated recovery

**Start with**: `"What is the current status of MotorM12?"`
