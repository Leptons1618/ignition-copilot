# MCP API Reference

Complete reference for all MCP tools provided by the Ignition MCP Server.

## Tool Categories

1. **Tag Operations**: Read, write, and browse tags
2. **Historian**: Query and analyze historical data
3. **Alarms**: Monitor and manage alarms
4. **Diagnostics**: Intelligent analysis and workflows

---

## Tag Operations

### read_tag

Read the current value of a single Ignition tag.

**Input**:
```json
{
  "tag_path": "Temperature"
}
```

**Output**:
```json
{
  "path": "[default]DemoPlant/MotorM12/Temperature",
  "value": 67.5,
  "quality": "Good",
  "timestamp": "2024-01-15T10:30:45Z"
}
```

**Usage**:
```
"What is the current temperature of MotorM12?"
"Read the Temperature tag"
```

---

### read_tags

Read current values of multiple tags in a single request.

**Input**:
```json
{
  "tag_paths": ["Temperature", "FanCurrent", "LoadPercent"]
}
```

**Output**:
```json
[
  {
    "path": "[default]DemoPlant/MotorM12/Temperature",
    "value": 67.5,
    "quality": "Good",
    "timestamp": "2024-01-15T10:30:45Z"
  },
  {
    "path": "[default]DemoPlant/MotorM12/FanCurrent",
    "value": 6.2,
    "quality": "Good",
    "timestamp": "2024-01-15T10:30:45Z"
  },
  ...
]
```

**Usage**:
```
"Read Temperature, FanCurrent, and LoadPercent"
"Show me all process values"
```

---

### write_tag

Write a value to an Ignition tag.

**Input**:
```json
{
  "tag_path": "SimulatorEnabled",
  "value": true
}
```

**Output**:
```json
{
  "path": "[default]DemoPlant/MotorM12/SimulatorEnabled",
  "success": true,
  "quality": "Good"
}
```

**Usage**:
```
"Start the simulator" (writes true to SimulatorEnabled)
"Set ResetAlarm to true"
```

**Supported Value Types**:
- Boolean: `true`, `false`
- Number: `42`, `3.14`
- String: `"NORMAL"`, `"Auto"`

---

### browse_tags

Browse tags in a folder to discover structure.

**Input**:
```json
{
  "folder_path": "[default]DemoPlant/MotorM12"
}
```

**Output**:
```json
{
  "tags": [
    {
      "name": "Temperature",
      "path": "[default]DemoPlant/MotorM12/Temperature",
      "type": "AtomicTag",
      "dataType": "Float4"
    },
    {
      "name": "Running",
      "path": "[default]DemoPlant/MotorM12/Running",
      "type": "AtomicTag",
      "dataType": "Boolean"
    },
    ...
  ],
  "count": 13
}
```

**Usage**:
```
"What tags are available for MotorM12?"
"List all tags in the DemoPlant folder"
```

---

### get_motor_status

Get comprehensive status of MotorM12 including all key values.

**Input**:
```json
{}
```

**Output**:
```json
{
  "motor_id": "MotorM12",
  "timestamp": "2024-01-15T10:30:45Z",
  "process_values": {
    "temperature": {"value": 67.5, "unit": "°C"},
    "speed": {"value": 1450.0, "unit": "RPM"},
    "load": {"value": 52.3, "unit": "%"},
    "fan_current": {"value": 6.2, "unit": "A"}
  },
  "status": {
    "running": true,
    "alarm_active": false,
    "mode": "Auto",
    "sim_state": "FAN_FAIL",
    "sim_time": 35
  },
  "fault_info": {
    "reason": ""
  }
}
```

**Usage**:
```
"What is the status of MotorM12?"
"Show me everything about the motor"
```

---

## Historian Operations

### query_history

Query historical tag values over a time range.

**Input**:
```json
{
  "tag_paths": ["Temperature", "FanCurrent"],
  "hours_ago": 1,
  "max_records": 1000
}
```

**Output**:
```json
{
  "query": {
    "start_time": "2024-01-15T09:30:45Z",
    "end_time": "2024-01-15T10:30:45Z",
    "duration_hours": 1
  },
  "data": {
    "[default]DemoPlant/MotorM12/Temperature": {
      "record_count": 156,
      "records": [
        {
          "value": 45.0,
          "timestamp": "2024-01-15T09:30:45Z",
          "quality": "Good"
        },
        ...
      ]
    },
    "[default]DemoPlant/MotorM12/FanCurrent": {
      "record_count": 142,
      "records": [...]
    }
  }
}
```

**Usage**:
```
"Show me temperature history for the last hour"
"Get historical data for Temperature and FanCurrent"
```

**Parameters**:
- `hours_ago`: How far back to query (default: 1)
- `max_records`: Maximum records per tag (default: 1000)

---

### analyze_trend

Analyze trend of a tag with statistics and direction.

**Input**:
```json
{
  "tag_path": "Temperature",
  "hours_ago": 1
}
```

**Output**:
```json
{
  "tag_path": "[default]DemoPlant/MotorM12/Temperature",
  "time_range": {
    "start": "2024-01-15T09:30:45Z",
    "end": "2024-01-15T10:30:45Z",
    "hours": 1
  },
  "statistics": {
    "min": 45.2,
    "max": 87.3,
    "average": 66.7,
    "range": 42.1,
    "sample_count": 156
  },
  "trend": {
    "direction": "increasing",
    "magnitude": 38.5,
    "rate_of_change": 38.5
  }
}
```

**Usage**:
```
"Analyze the temperature trend"
"Is temperature rising or falling?"
"What's the rate of temperature increase?"
```

**Trend Direction**:
- `increasing`: Second half average > first half
- `decreasing`: Second half average < first half

---

### compare_tags

Compare historical trends of multiple tags.

**Input**:
```json
{
  "tag_paths": ["Temperature", "FanCurrent"],
  "hours_ago": 1
}
```

**Output**:
```json
{
  "time_range": {
    "start": "2024-01-15T09:30:45Z",
    "end": "2024-01-15T10:30:45Z",
    "hours": 1
  },
  "comparisons": {
    "[default]DemoPlant/MotorM12/Temperature": {
      "average": 66.7,
      "trend": "increasing",
      "change": 38.5
    },
    "[default]DemoPlant/MotorM12/FanCurrent": {
      "average": 5.2,
      "trend": "decreasing",
      "change": -3.8
    }
  },
  "tag_count": 2
}
```

**Usage**:
```
"Compare temperature and fan current trends"
"Are temperature and fan current correlated?"
```

---

## Alarm Operations

### get_active_alarms

Get all currently active alarms.

**Input**:
```json
{
  "filter_path": "MotorM12"
}
```

**Output**:
```json
{
  "alarm_count": 1,
  "alarms": [
    {
      "source": "[default]DemoPlant/MotorM12/Temperature",
      "displayPath": "DemoPlant/MotorM12/Temperature",
      "priority": "High",
      "state": "Active",
      "activeTime": "2024-01-15T10:28:30Z",
      "label": "Alarm"
    }
  ]
}
```

**Usage**:
```
"Are there any active alarms?"
"Show me all alarms for MotorM12"
```

**Parameters**:
- `filter_path`: Optional filter (default: all alarms)

---

### check_alarm_status

Quick check for active alarms on MotorM12.

**Input**:
```json
{}
```

**Output**:
```json
{
  "has_active_alarms": true,
  "alarm_count": 1,
  "alarms": [
    {
      "source": "[default]DemoPlant/MotorM12/Temperature",
      "priority": "High",
      "state": "Active",
      "label": "Alarm"
    }
  ]
}
```

**Usage**:
```
"Does MotorM12 have any alarms?"
"Check alarm status"
```

---

## Diagnostic Operations

### diagnose_motor_issue

Perform intelligent diagnosis with historical analysis.

**Input**:
```json
{
  "include_history": true
}
```

**Output**:
```json
{
  "current_state": {
    "temperature": 87.5,
    "fan_current": 2.1,
    "load": 58.3,
    "running": false,
    "sim_state": "TRIP",
    "alarm_active": true
  },
  "issues_detected": [
    {
      "issue": "High Temperature",
      "value": 87.5,
      "threshold": 85,
      "severity": "Critical"
    },
    {
      "issue": "Low Fan Current",
      "value": 2.1,
      "threshold": 5.0,
      "severity": "Warning"
    },
    {
      "issue": "Motor Not Running",
      "severity": "Critical"
    }
  ],
  "root_cause": {
    "cause": "Cooling failure caused overheating",
    "evidence": "Motor in TRIP state",
    "likely_failure_mode": "Cooling system failure leading to thermal trip"
  },
  "severity": "Critical",
  "historical_analysis": {
    "temperature_trend": "rising",
    "temperature_rate": 0.65,
    "fan_current_trend": "declining",
    "fan_current_rate": -0.08,
    "samples_analyzed": 156
  }
}
```

**Usage**:
```
"Diagnose the motor problem"
"What's wrong with MotorM12?"
"Why did the motor trip?"
```

---

### suggest_recovery

Suggest recovery actions based on current state.

**Input**:
```json
{}
```

**Output**:
```json
{
  "current_state": "TRIP",
  "actions": [
    {
      "step": 1,
      "action": "Investigate cooling fan operation",
      "details": "Check for fan motor failure or bearing issues"
    },
    {
      "step": 2,
      "action": "Allow motor to cool",
      "details": "Current temperature: 87.5°C, wait until below 50°C"
    },
    {
      "step": 3,
      "action": "Reset alarm condition",
      "details": "Use reset_simulator tool or set ResetAlarm tag to true"
    },
    {
      "step": 4,
      "action": "Restart motor",
      "details": "Monitor temperature closely after restart"
    }
  ],
  "priority": "High",
  "estimated_recovery_time": "30-60 minutes"
}
```

**Usage**:
```
"What should I do to fix this?"
"How do I recover the motor?"
"Give me recovery steps"
```

---

### start_simulator

Start the MotorM12 fault simulation.

**Input**:
```json
{}
```

**Output**:
```json
{
  "success": true,
  "message": "Simulator started. Fault progression will occur over ~90 seconds.",
  "sequence": "NORMAL (0-20s) → FAN_FAIL (20-40s) → OVERHEAT (40s+) → TRIP (~85°C)"
}
```

**Usage**:
```
"Start the simulator"
"Begin the demonstration"
```

---

### reset_simulator

Reset simulation to initial state.

**Input**:
```json
{}
```

**Output**:
```json
{
  "success": true,
  "message": "Simulator reset. System returned to NORMAL state.",
  "next_steps": "Use start_simulator to begin new demonstration"
}
```

**Usage**:
```
"Reset the simulation"
"Clear the fault"
"Start over"
```

---

## Error Handling

All tools return errors in this format:

```json
{
  "error": "Description of error",
  "tool": "tool_name",
  "arguments": {...}
}
```

Common errors:
- Tag not found
- Connection failed
- Invalid value type
- No historical data
- Permission denied

---

## Best Practices

### Tag Paths
- Short names auto-expanded: `"Temperature"` → `"[default]DemoPlant/MotorM12/Temperature"`
- Full paths always work: `"[default]DemoPlant/MotorM12/Temperature"`
- Case-sensitive

### Batch Operations
- Use `read_tags` instead of multiple `read_tag` calls
- More efficient, single round-trip

### Historical Queries
- Limit time ranges for faster responses
- Use `max_records` to control data volume
- Consider caching for repeated queries

### Error Recovery
- Check `success` field in write operations
- Verify `quality` is "Good" in read operations
- Handle "No data" cases in historian queries
