# Tag Structure Documentation

Complete reference for the MotorM12 tag structure.

## Folder Hierarchy

```
[default]
└── DemoPlant/
    └── MotorM12/
        ├── Process Values
        ├── Control Tags
        ├── Status Tags
        └── Diagnostic Tags
```

## Tag Reference

### Process Values (Measurements)

#### Temperature
- **Path**: `[default]DemoPlant/MotorM12/Temperature`
- **Type**: Float4
- **Unit**: °C (Celsius)
- **Default**: 45.0
- **Historian**: Enabled
- **Alarm**: High alarm at 85°C
- **Description**: Motor bearing temperature
- **Normal Range**: 40-60°C
- **Warning Range**: 60-85°C
- **Critical**: >85°C

#### Speed
- **Path**: `[default]DemoPlant/MotorM12/Speed`
- **Type**: Float4
- **Unit**: RPM
- **Default**: 1450.0
- **Historian**: No
- **Description**: Motor shaft speed
- **Normal Range**: 1440-1460 RPM

#### LoadPercent
- **Path**: `[default]DemoPlant/MotorM12/LoadPercent`
- **Type**: Float4
- **Unit**: %
- **Default**: 40.0
- **Historian**: Enabled
- **Description**: Motor mechanical load percentage
- **Normal Range**: 30-60%
- **Warning Range**: 60-80%
- **Critical**: >80%

#### FanCurrent
- **Path**: `[default]DemoPlant/MotorM12/FanCurrent`
- **Type**: Float4
- **Unit**: A (Amperes)
- **Default**: 8.5
- **Historian**: Enabled
- **Description**: Cooling fan motor current
- **Normal Range**: 8.0-9.0A
- **Warning Range**: 5.0-8.0A
- **Critical**: <5.0A (indicates fan failure)

### Control Tags

#### SimulatorEnabled
- **Path**: `[default]DemoPlant/MotorM12/SimulatorEnabled`
- **Type**: Boolean
- **Default**: false
- **Description**: Master switch for simulation
- **Usage**: Set to `true` to start simulation
- **Access**: Operator writable

#### StartCommand
- **Path**: `[default]DemoPlant/MotorM12/StartCommand`
- **Type**: Boolean
- **Default**: false
- **Description**: Motor start command
- **Usage**: Future use for manual start/stop control

#### ResetAlarm
- **Path**: `[default]DemoPlant/MotorM12/ResetAlarm`
- **Type**: Boolean
- **Default**: false
- **Description**: Reset simulation to initial state
- **Usage**: Set to `true` to reset, auto-clears after reset
- **Access**: Operator writable

### Status Tags

#### Running
- **Path**: `[default]DemoPlant/MotorM12/Running`
- **Type**: Boolean
- **Default**: true
- **Description**: Motor running status
- **Values**: 
  - `true`: Motor is running
  - `false`: Motor is stopped/tripped

#### AlarmActive
- **Path**: `[default]DemoPlant/MotorM12/AlarmActive`
- **Type**: Boolean
- **Default**: false
- **Description**: Any alarm condition present
- **Updated By**: Temperature alarm event scripts
- **Usage**: Quick check for alarm presence

#### Mode
- **Path**: `[default]DemoPlant/MotorM12/Mode`
- **Type**: String
- **Default**: "Auto"
- **Description**: Motor operating mode
- **Values**: Auto, Manual, Maintenance

#### SimState
- **Path**: `[default]DemoPlant/MotorM12/SimState`
- **Type**: String
- **Default**: "NORMAL"
- **Description**: Current simulation state
- **Values**:
  - `NORMAL`: Normal operation
  - `FAN_FAIL`: Fan degradation in progress
  - `OVERHEAT`: Overheating condition
  - `TRIP`: Motor tripped

### Diagnostic Tags

#### FaultReason
- **Path**: `[default]DemoPlant/MotorM12/FaultReason`
- **Type**: String
- **Default**: "" (empty)
- **Description**: Text description of fault
- **Usage**: Populated when motor trips
- **Example**: "Cooling failure caused overheating"

#### SimTime
- **Path**: `[default]DemoPlant/MotorM12/SimTime`
- **Type**: Int4
- **Default**: 0
- **Description**: Simulation elapsed time in seconds
- **Usage**: Tracking for deterministic behavior
- **Increments**: Every 1 second while simulator enabled

## Alarm Configuration

### Temperature High Alarm

**Configuration**:
```json
{
  "name": "Alarm",
  "mode": "AboveValue",
  "setpointA": 85.0,
  "priority": "High"
}
```

**Event Scripts**:

**alarmActive**:
```python
system.tag.writeBlocking(
    ["[default]DemoPlant/MotorM12/AlarmActive"],
    [True]
)
```

**alarmCleared**:
```python
system.tag.writeBlocking(
    ["[default]DemoPlant/MotorM12/AlarmActive"],
    [False]
)
```

## Historian Configuration

**Tags with History Enabled**:
- Temperature
- LoadPercent
- FanCurrent

**Settings**:
- **Provider**: default
- **Sample Mode**: On Change and Periodic
- **Period**: 1000ms (1 second)
- **Deadband**: Default
- **Storage**: Ignition internal database

## Usage Examples

### Reading Tags via MCP

```python
# Read single tag
read_tag("Temperature")

# Read multiple tags
read_tags(["Temperature", "FanCurrent", "LoadPercent"])

# Get comprehensive status
get_motor_status()
```

### Writing Tags via MCP

```python
# Start simulation
write_tag("SimulatorEnabled", True)

# Reset simulation
write_tag("ResetAlarm", True)
```

### Querying History via MCP

```python
# Get last hour of temperature data
query_history(["Temperature"], hours_ago=1)

# Analyze trend
analyze_trend("Temperature", hours_ago=1)

# Compare multiple tags
compare_tags(["Temperature", "FanCurrent"], hours_ago=1)
```

## Tag Naming Conventions

**Principles**:
- PascalCase for tag names
- Descriptive, not abbreviated
- Units not in name (use engUnit property)
- Boolean tags use adjectives (Running, Enabled)
- Command tags use Command suffix

**Examples**:
- ✅ `Temperature` (not `Temp` or `TempDegC`)
- ✅ `LoadPercent` (not `Load%` or `Ld`)
- ✅ `SimulatorEnabled` (not `SimEn` or `Enable`)
- ✅ `ResetAlarm` (not `Reset` or `AlmRst`)

## Adding New Tags

To extend the tag structure:

1. **Define in tags.json**:
```json
{
  "name": "Vibration",
  "dataType": "Float4",
  "engUnit": "mm/s",
  "defaultValue": 2.5,
  "historyEnabled": true,
  "tagType": "AtomicTag"
}
```

2. **Update simulation script**:
```python
# Add to read paths
paths.append(base + "Vibration")

# Add simulation logic
vibration += random.uniform(-0.1, 0.1)

# Add to write paths
system.tag.writeBlocking([base + "Vibration"], [vibration])
```

3. **Update MCP tools** (if needed):
```python
# Add to status query
"vibration": {
    "value": ...,
    "unit": "mm/s"
}
```

## Tag Performance Considerations

**Historian Load**:
- 3 tags logging at 1Hz = ~3 records/second
- ~10,800 records/hour
- ~260,000 records/day
- Monitor database size for production

**Event Scripts**:
- Keep lightweight (only update AlarmActive)
- Avoid complex logic in tag events
- Use gateway scripts for heavy processing

**Read/Write Frequency**:
- Simulation: 1Hz (every 1000ms)
- MCP queries: On-demand
- Historian queries: Cached where possible
