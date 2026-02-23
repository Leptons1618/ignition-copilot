# Gateway Script: Tag Export to JSON File
# This exports tag values to a JSON file that the web UI can read

# Add this to your existing PlantSimulator Gateway Timer Script
# Or create a new Gateway Timer Script (1000ms interval)

import system
import json

# Base path for motor tags
base = "[default]DemoPlant/MotorM12/"

# Tags to export
tag_names = [
    "Temperature",
    "Speed", 
    "LoadPercent",
    "FanCurrent",
    "Running",
    "AlarmActive",
    "SimState",
    "FaultReason",
    "SimulatorEnabled",
    "SimTime"
]

# Build full paths
paths = [base + name for name in tag_names]

# Read all tags
try:
    results = system.tag.readBlocking(paths)
    
    # Build JSON data
    data = {}
    for i, name in enumerate(tag_names):
        value = results[i]
        data[name] = {
            "value": value.value,
            "quality": str(value.quality),
            "timestamp": str(value.timestamp)
        }
    
    # Write to file in Ignition data directory
    json_data = system.util.jsonEncode(data)
    
    # Write to a file accessible to web server
    # Option 1: Use Ignition's temp directory
    file_path = "C:/ProgramData/Inductive Automation/Ignition/data/motor_status.json"
    
    # Option 2: Or write to your project directory
    # file_path = "D:/Sandbox/ignition-copilot/mcp-server/motor_status.json"
    
    # Write the file (this requires file I/O permissions)
    system.file.writeFile(file_path, json_data)
    
except Exception as e:
    # Log errors
    system.util.getLogger("MotorExport").error("Failed to export tags: " + str(e))
