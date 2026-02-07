# FILE-BASED TAG BRIDGE SETUP GUIDE

This is an **alternative method** that doesn't require WebDev module or HTTP APIs.

## How It Works

1. **Gateway Timer Script** reads tags and exports to JSON file (every 1 second)
2. **Web UI** reads the JSON file and displays the data
3. **Commands** are written to a command file that Gateway script reads

## Setup Steps (5 minutes)

### Step 1: Update Your Gateway Timer Script

1. Open **Ignition Designer**
2. Go to **Project Browser** → **Gateway Events** → **Timer Scripts**
3. Find your `PlantSimulator` script
4. **Add this code at the END** of your existing script:

```python
# ========== TAG EXPORT TO JSON ==========
# Add this to the END of your PlantSimulator script

try:
    # Build export data
    export_data = {
        "Temperature": {"value": temp, "quality": "Good", "timestamp": str(system.date.now())},
        "Speed": {"value": speed, "quality": "Good", "timestamp": str(system.date.now())},
        "LoadPercent": {"value": load, "quality": "Good", "timestamp": str(system.date.now())},
        "FanCurrent": {"value": fanCurrent, "quality": "Good", "timestamp": str(system.date.now())},
        "Running": {"value": running, "quality": "Good", "timestamp": str(system.date.now())},
        "AlarmActive": {"value": alarmActive, "quality": "Good", "timestamp": str(system.date.now())},
        "SimState": {"value": state, "quality": "Good", "timestamp": str(system.date.now())},
        "FaultReason": {"value": faultReason, "quality": "Good", "timestamp": str(system.date.now())},
        "SimulatorEnabled": {"value": enabled, "quality": "Good", "timestamp": str(system.date.now())},
        "SimTime": {"value": simTime, "quality": "Good", "timestamp": str(system.date.now())}
    }
    
    # Export to JSON file
    json_str = system.util.jsonEncode(export_data)
    file_path = "D:/Sandbox/ignition-copilot/mcp-server/motor_status.json"
    
    # Write file
    from java.io import FileWriter
    writer = FileWriter(file_path)
    writer.write(json_str)
    writer.close()
    
    # Read command file if exists
    import java.io.File as File
    cmd_path = "D:/Sandbox/ignition-copilot/mcp-server/motor_command.json"
    cmd_file = File(cmd_path)
    
    if cmd_file.exists():
        # Read command
        from java.io import FileReader, BufferedReader
        reader = BufferedReader(FileReader(cmd_file))
        cmd_json = reader.readLine()
        reader.close()
        
        # Parse and execute
        cmd = system.util.jsonDecode(cmd_json)
        tag_name = cmd.get("tag", "")
        value = cmd.get("value")
        
        # Write to appropriate tag
        if tag_name and value is not None:
            write_path = base + tag_name
            system.tag.writeBlocking([write_path], [value])
        
        # Delete command file
        cmd_file.delete()
        
except Exception as e:
    system.util.getLogger("MotorExport").error("Export failed: " + str(e))
```

5. **Save** the script (Ctrl+S)

### Step 2: Test File Export

1. Wait 1-2 seconds for script to run
2. Check if file was created:
   ```
   D:\Sandbox\ignition-copilot\mcp-server\motor_status.json
   ```
3. Open it - should contain JSON with tag values

### Step 3: Start File-Based Web UI

```bash
cd D:\Sandbox\ignition-copilot\mcp-server
python web_ui_file.py
```

Open browser to: **http://localhost:5002**

## Troubleshooting

### File Not Created?

**Problem**: JSON file not appearing

**Solutions**:
1. Check Designer **Console** for errors
2. Try different path (must be writable):
   ```python
   file_path = "C:/temp/motor_status.json"
   ```
3. Create directory first if it doesn't exist

### Permission Errors?

**Problem**: `Access Denied` or `Permission Error`

**Solution**: Use a path Ignition can write to:
```python
# Try one of these:
file_path = "C:/temp/motor_status.json"
file_path = "C:/Users/Public/motor_status.json"  
file_path = system.util.getSystemProperty("ignition.temp") + "/motor_status.json"
```

Update BOTH:
- Gateway script (where it writes)
- `web_ui_file.py` JSON_FILE_PATHS list

### File is Stale?

**Problem**: "File is stale" warning

**Solution**: 
1. Check Gateway script is enabled and running
2. Check for errors in Designer Console
3. Verify file path is correct in both scripts

## Advantages of This Method

✅ **No HTTP API needed** - works with any Ignition edition
✅ **No WebDev module** required
✅ **No special configuration** - just uses Gateway scripts
✅ **Works immediately** - as soon as script runs
✅ **Bi-directional** - can read AND write tags

## How Commands Work

1. Web UI writes command to `motor_command.json`
2. Gateway script reads and deletes the file
3. Gateway script executes the tag write
4. Next cycle, status is exported to `motor_status.json`
5. Web UI reads updated status

This creates a simple **file-based API** between web and Ignition!

## Next Steps

Once working:
- Web UI at http://localhost:5002 shows REAL Ignition tags
- Click "Start" to run simulation
- Watch real tag values update
- All data is coming from actual Ignition tags via JSON file

No HTTP API or WebDev module needed! 🎉
