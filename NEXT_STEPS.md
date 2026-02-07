# IGNITION MCP DEMO - QUICK START GUIDE

## Current Status: ✅ Gateway Connected

Your Ignition Gateway is running and accessible at http://localhost:8088

## Next Steps:

### Option 1: Use Web UI (RECOMMENDED - EASIEST)

1. Install Flask:
   ```
   cd mcp-server
   pip install flask
   ```

2. Start Web UI:
   ```
   python web_ui.py
   ```

3. Open browser to: http://localhost:5000

4. **IMPORTANT**: You need to import tags first!
   - Open Ignition Designer
   - File → Import Tags
   - Select `tags.json`
   - Then the web UI will show live data

### Option 2: Test with Python Scripts

```
cd mcp-server
python simple_client.py
```

### What's Working:
✅ Ignition Gateway connected (http://localhost:8088)
✅ Authentication working
✅ Basic connectivity confirmed

### What's Needed:
⚠️  Tags not imported yet - need to import tags.json in Ignition Designer
⚠️  Gateway timer script not installed yet

### Files Created:
- test_basic.py - Basic connectivity test (WORKING ✅)
- simple_client.py - Simple tag read/write client
- web_ui.py - Web interface (Flask)
- templates/index.html - Web UI template

### To Complete Setup:

1. **Import Tags** (5 minutes):
   - Open Ignition Designer
   - File → Import Tags
   - Select D:\Sandbox\ignition-copilot\tags.json
   - Click Import

2. **Install Gateway Script** (3 minutes):
   - In Designer: Project → Scripts → Gateway Events
   - Right-click Timer Scripts → Add Timer Script
   - Name: PlantSimulator, Fixed Rate: 1000ms
   - Copy content from syntheticDataGen.py
   - Save

3. **Start Web UI**:
   ```
   cd D:\Sandbox\ignition-copilot\mcp-server
   python web_ui.py
   ```

4. **Use the Demo**:
   - Open http://localhost:5000
   - Click "Start Simulator"
   - Watch temperature rise over ~90 seconds
   - See alarm at 85°C
   - Click "Reset" to start over

## Troubleshooting:

**If web UI shows "Bad" quality:**
- Tags not imported - follow step 1 above

**If values don't change:**
- Gateway script not installed - follow step 2 above

**If can't connect:**
- Check Ignition is running at http://localhost:8088
- Check config.json has correct username/password

## Quick Test Without Tags:

Even without tags imported, you can test the connection:

```
cd mcp-server
python test_basic.py
```

Should show ✅ for both connectivity and authentication.
