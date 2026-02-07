# Extending the System

Guide for adding new features, assets, and capabilities to the Ignition MCP Smart Operations platform.

## Table of Contents
1. [Adding New Assets](#adding-new-assets)
2. [Adding New Failure Modes](#adding-new-failure-modes)
3. [Adding New MCP Tools](#adding-new-mcp-tools)
4. [Adding New Simulation States](#adding-new-simulation-states)
5. [Integration Examples](#integration-examples)

---

## Adding New Assets

### Example: Adding a Pump (PumpP05)

#### Step 1: Define Tag Structure

Create `tags_pump.json`:

```json
{
  "name": "PumpP05",
  "tagType": "Folder",
  "tags": [
    {
      "name": "FlowRate",
      "dataType": "Float4",
      "engUnit": "GPM",
      "defaultValue": 250.0,
      "historyEnabled": true,
      "tagType": "AtomicTag"
    },
    {
      "name": "Pressure",
      "dataType": "Float4",
      "engUnit": "PSI",
      "defaultValue": 75.0,
      "historyEnabled": true,
      "tagType": "AtomicTag"
    },
    {
      "name": "Running",
      "dataType": "Boolean",
      "defaultValue": true,
      "tagType": "AtomicTag"
    },
    {
      "name": "SimulatorEnabled",
      "dataType": "Boolean",
      "defaultValue": false,
      "tagType": "AtomicTag"
    },
    {
      "name": "SimState",
      "dataType": "String",
      "defaultValue": "NORMAL",
      "tagType": "AtomicTag"
    },
    {
      "name": "ResetAlarm",
      "dataType": "Boolean",
      "defaultValue": false,
      "tagType": "AtomicTag"
    }
  ]
}
```

#### Step 2: Import into Ignition

1. Open Ignition Designer
2. File → Import Tags
3. Select `tags_pump.json`
4. Import to `[default]DemoPlant/`

#### Step 3: Create Simulation Script

Create new Gateway Timer Script named `PumpSimulator`:

```python
base = "[default]DemoPlant/PumpP05/"

paths = [
    base + "SimulatorEnabled",
    base + "SimState",
    base + "FlowRate",
    base + "Pressure",
    base + "Running",
    base + "ResetAlarm"
]

vals = system.tag.readBlocking(paths)

enabled = vals[0].value
state = vals[1].value
flow = vals[2].value
pressure = vals[3].value
running = vals[4].value
resetCmd = vals[5].value

# Reset logic
if resetCmd:
    system.tag.writeBlocking(
        [base + "FlowRate", base + "Pressure", base + "Running",
         base + "SimState", base + "ResetAlarm"],
        [250.0, 75.0, True, "NORMAL", False]
    )
    return

if not enabled:
    return

# State machine
if state == "NORMAL":
    flow += random.uniform(-2, 2)
    pressure += random.uniform(-1, 1)
    
    if random.random() < 0.01:  # 1% chance per second
        state = "CAVITATION"

elif state == "CAVITATION":
    flow -= 5  # Flow drops
    pressure -= 2  # Pressure drops
    
    if pressure < 30:
        state = "TRIP"

elif state == "TRIP":
    running = False
    flow = 0
    pressure = 0

# Write back
system.tag.writeBlocking(
    [base + "FlowRate", base + "Pressure", base + "Running", base + "SimState"],
    [flow, pressure, running, state]
)
```

#### Step 4: Update MCP Configuration

Edit `mcp-server/config.json`:

```json
{
  "assets": {
    "motor": {
      "provider": "default",
      "path": "DemoPlant/MotorM12"
    },
    "pump": {
      "provider": "default",
      "path": "DemoPlant/PumpP05"
    }
  }
}
```

#### Step 5: Add MCP Tool for Pump

Create `mcp-server/tools/pump_operations.py`:

```python
def create_pump_tools(client, config):
    tools = []
    
    tools.append({
        "name": "get_pump_status",
        "description": "Get comprehensive status of PumpP05",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    })
    
    return tools

def handle_pump_operation(tool_name, arguments, client, config):
    if tool_name == "get_pump_status":
        base = "[default]DemoPlant/PumpP05/"
        tag_names = ["FlowRate", "Pressure", "Running", "SimState"]
        tag_paths = [base + name for name in tag_names]
        results = client.read_tags(tag_paths)
        
        return {
            "pump_id": "PumpP05",
            "flow_rate": next((r['value'] for r in results if 'FlowRate' in r['path']), None),
            "pressure": next((r['value'] for r in results if 'Pressure' in r['path']), None),
            "running": next((r['value'] for r in results if 'Running' in r['path']), None),
            "state": next((r['value'] for r in results if 'SimState' in r['path']), None)
        }
```

Register in `ignition_mcp_server.py`:

```python
from tools.pump_operations import create_pump_tools, handle_pump_operation

# In __init__:
self.tools.extend(create_pump_tools(self.client, self.config))

# In call_tool handler:
elif name in ['get_pump_status']:
    result = handle_pump_operation(name, arguments, self.client, self.config)
```

---

## Adding New Failure Modes

### Example: Adding Bearing Wear to Motor

#### Step 1: Add Vibration Tag

```json
{
  "name": "Vibration",
  "dataType": "Float4",
  "engUnit": "mm/s",
  "defaultValue": 2.5,
  "historyEnabled": true,
  "alarms": [
    {
      "mode": "AboveValue",
      "name": "HighVibration",
      "priority": "Medium",
      "setpointA": 8.0
    }
  ],
  "tagType": "AtomicTag"
}
```

#### Step 2: Update Simulation Script

```python
# Add to paths
paths.append(base + "Vibration")

# Extract value
vibration = vals[...].value  # Adjust index

# Add new state: BEARING_WEAR
elif state == "BEARING_WEAR":
    vibration += 0.15  # Vibration increasing
    temp += 0.08  # Heat from friction
    load += 0.05  # Harder to turn
    
    if vibration > 10:
        state = "TRIP"

# Transition from NORMAL to BEARING_WEAR
if state == "NORMAL":
    if simTime > 30:
        state = "BEARING_WEAR"

# Write vibration back
system.tag.writeBlocking(
    [..., base + "Vibration"],
    [..., vibration]
)
```

#### Step 3: Add Diagnostic Logic

```python
# In tools/diagnostics.py, update diagnose_motor_issue:

if vibration > 8.0:
    diagnosis["issues_detected"].append({
        "issue": "High Vibration",
        "value": vibration,
        "threshold": 8.0,
        "severity": "Warning"
    })

if state == "BEARING_WEAR":
    diagnosis["root_cause"] = {
        "cause": "Bearing degradation detected",
        "evidence": f"Vibration at {vibration} mm/s and rising",
        "likely_failure_mode": "Bearing wear due to inadequate lubrication or contamination"
    }
```

---

## Adding New MCP Tools

### Example: Predictive Failure Time Tool

#### Step 1: Define Tool

Create in `tools/diagnostics.py`:

```python
tools.append({
    "name": "predict_failure_time",
    "description": "Predict time until failure based on current degradation rate",
    "inputSchema": {
        "type": "object",
        "properties": {
            "tag_path": {
                "type": "string",
                "description": "Tag to analyze (e.g., 'Temperature', 'FanCurrent')"
            },
            "threshold": {
                "type": "number",
                "description": "Failure threshold value"
            }
        },
        "required": ["tag_path", "threshold"]
    }
})
```

#### Step 2: Implement Handler

```python
def predict_failure_time(tag_path, threshold, client, config):
    """Predict time until tag reaches threshold"""
    
    # Get recent history
    end_time = datetime.now()
    start_time = end_time - timedelta(minutes=5)
    
    history = client.query_history([tag_path], start_time, end_time, 1000)
    records = history.get(tag_path, [])
    
    if len(records) < 10:
        return {"error": "Insufficient data for prediction"}
    
    # Calculate rate of change
    values = [r['value'] for r in records]
    current_value = values[-1]
    
    # Linear regression or simple average rate
    first_half_avg = sum(values[:len(values)//2]) / (len(values)//2)
    second_half_avg = sum(values[len(values)//2:]) / (len(values) - len(values)//2)
    
    rate_per_minute = (second_half_avg - first_half_avg) / 5  # Over 5 minutes
    
    if rate_per_minute == 0:
        return {
            "prediction": "stable",
            "message": "Value is stable, no change predicted"
        }
    
    # Calculate time to threshold
    value_difference = threshold - current_value
    minutes_to_threshold = value_difference / rate_per_minute
    
    if minutes_to_threshold < 0:
        return {
            "prediction": "threshold_exceeded",
            "message": f"Threshold of {threshold} already exceeded"
        }
    
    return {
        "prediction": "failure_predicted",
        "current_value": round(current_value, 2),
        "threshold": threshold,
        "rate_of_change": round(rate_per_minute, 2),
        "estimated_minutes": round(minutes_to_threshold, 1),
        "estimated_time": (datetime.now() + timedelta(minutes=minutes_to_threshold)).isoformat()
    }
```

#### Step 3: Register Handler

```python
elif tool_name == "predict_failure_time":
    tag_path = format_tag_path(arguments['tag_path'])
    threshold = arguments['threshold']
    result = predict_failure_time(tag_path, threshold, client, config)
```

---

## Adding New Simulation States

### Example: Maintenance Mode

#### Step 1: Add State Tag

```json
{
  "name": "MaintenanceMode",
  "dataType": "Boolean",
  "defaultValue": false,
  "tagType": "AtomicTag"
}
```

#### Step 2: Update State Machine

```python
# Read maintenance mode
maintenance = vals[...].value

# Add to state machine
if maintenance:
    # Override normal simulation
    running = False
    state = "MAINTENANCE"
    # Keep values stable
    return

# Normal state machine continues...
```

#### Step 3: Add Control Tool

```python
tools.append({
    "name": "enter_maintenance_mode",
    "description": "Put motor into maintenance mode (safe state for service)",
    "inputSchema": {
        "type": "object",
        "properties": {}
    }
})

def handle_maintenance_mode(client, config):
    tag_path = format_tag_path("MaintenanceMode")
    result = client.write_tags([tag_path], [True])
    
    return {
        "success": result[0]['success'],
        "message": "Motor entered maintenance mode",
        "safety_status": "Safe for maintenance personnel"
    }
```

---

## Integration Examples

### Integration 1: CMMS Work Order System

```python
# tools/cmms_integration.py

import requests

def create_work_order(asset_id, issue_description, priority, client, config):
    """Create work order in external CMMS"""
    
    cmms_config = config.get('cmms', {})
    api_url = cmms_config.get('api_url')
    api_key = cmms_config.get('api_key')
    
    work_order = {
        "asset_id": asset_id,
        "description": issue_description,
        "priority": priority,
        "created_by": "Ignition MCP",
        "created_date": datetime.now().isoformat()
    }
    
    response = requests.post(
        f"{api_url}/work-orders",
        json=work_order,
        headers={"Authorization": f"Bearer {api_key}"}
    )
    
    return response.json()
```

### Integration 2: Email Notifications

```python
# tools/notifications.py

import smtplib
from email.mime.text import MIMEText

def send_alert_email(subject, body, config):
    """Send email alert"""
    
    email_config = config.get('email', {})
    
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = email_config['from_address']
    msg['To'] = email_config['to_address']
    
    with smtplib.SMTP(email_config['smtp_server']) as server:
        server.send_message(msg)
```

### Integration 3: Time Series Database

```python
# Export historian data to InfluxDB

from influxdb_client import InfluxDBClient

def export_to_influxdb(tag_path, start_time, end_time, client, config):
    """Export Ignition historian data to InfluxDB"""
    
    influx_config = config.get('influxdb', {})
    influx_client = InfluxDBClient(
        url=influx_config['url'],
        token=influx_config['token'],
        org=influx_config['org']
    )
    
    # Get data from Ignition
    history = client.query_history([tag_path], start_time, end_time, 10000)
    
    # Write to InfluxDB
    write_api = influx_client.write_api()
    for record in history[tag_path]:
        point = Point("ignition_tag") \
            .tag("tag_path", tag_path) \
            .field("value", record['value']) \
            .time(record['timestamp'])
        write_api.write(bucket=influx_config['bucket'], record=point)
```

---

## Testing New Features

### Unit Testing Template

```python
# tests/test_new_tool.py

import unittest
from unittest.mock import Mock
from tools.diagnostics import predict_failure_time

class TestPredictFailureTime(unittest.TestCase):
    
    def setUp(self):
        self.mock_client = Mock()
        self.config = {...}
    
    def test_prediction_rising_trend(self):
        # Setup mock data
        self.mock_client.query_history.return_value = {
            "tag_path": [
                {"value": 50, "timestamp": "..."},
                {"value": 60, "timestamp": "..."},
                {"value": 70, "timestamp": "..."}
            ]
        }
        
        result = predict_failure_time("Temperature", 85, self.mock_client, self.config)
        
        self.assertEqual(result['prediction'], 'failure_predicted')
        self.assertGreater(result['estimated_minutes'], 0)
```

---

## Best Practices

### 1. Maintain Consistency
- Follow existing naming conventions
- Use same tag structure patterns
- Keep MCP tool schemas consistent

### 2. Document Everything
- Update README when adding assets
- Document new tools in API reference
- Create scenario guides for new features

### 3. Test Thoroughly
- Test simulation logic independently
- Verify MCP tools with mock data
- Test end-to-end with real Ignition

### 4. Version Control
- Commit each logical change separately
- Tag releases (v1.0, v1.1, etc.)
- Document breaking changes

### 5. Performance
- Monitor historian database growth
- Optimize frequent queries
- Cache where appropriate

---

## Need Help?

Review these resources:
- [Tag Structure Documentation](tag_structure.md)
- [MCP API Reference](mcp_api_reference.md)
- [WALKTHROUGH.md](../WALKTHROUGH.md)
- Ignition SDK Documentation
- MCP Protocol Specification
