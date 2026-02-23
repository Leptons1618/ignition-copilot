> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Gateway Administration

## Gateway Overview
The Ignition Gateway is the central server that manages all modules, connections, and projects.

### Key System Tags
- `[System]Gateway/SystemName` - Gateway name
- `[System]Gateway/Build/Version` - Ignition version
- `[System]Gateway/State` - Running state
- `[System]Gateway/Uptime` - Uptime in milliseconds
- `[System]Gateway/Performance/CPUUsage` - CPU usage percentage
- `[System]Gateway/Performance/MemoryUsed` - Memory used (bytes)
- `[System]Gateway/Performance/MemoryFree` - Memory free (bytes)

## Database Connections
Configure database connections in Gateway -> Config -> Databases -> Connections.

### Supported Databases
- MySQL / MariaDB
- Microsoft SQL Server
- PostgreSQL
- Oracle
- SQLite

### Named Queries
Create parameterized SQL queries in projects:
```python
# Run a named query
result = system.db.runNamedQuery("getMotorHistory", {"motorId": 12})
```

## OPC-UA Connections
Configure OPC connections at Gateway -> Config -> OPC Connections.

### OPC Tag Source
Tags with `valueSource=opc` read from OPC servers:
- **Server**: OPC connection name
- **Item Path**: `ns=1;s=Channel1.Device1.Tag1` (Kepware format)
- **Scan Class**: Polling rate (default, 1000ms, 5000ms, etc.)

## Project Configuration
Projects are containers for Perspective views, scripts, resources.

### Project Properties
- **Enabled**: Whether project is active
- **Title**: Display title
- **Description**: Project description
- **Inheritable**: Can other projects inherit from this
- **Parent**: Parent project for inheritance

## Security
### User Sources
- **Internal**: Users stored in Ignition database
- **Active Directory**: Windows AD authentication
- **LDAP**: Generic LDAP authentication
- **Hybrid**: Combine multiple sources

### Roles
Common roles:
- **Administrator**: Full gateway access
- **Developer**: Project editing access
- **Operator**: Runtime view access
- **Viewer**: Read-only access

## Historian
### History Provider
Configure at Gateway -> Config -> History.

### Tag History Properties
- **Historical**: Enable/disable history for a tag
- **Sample Mode**: On Change, Periodic
- **Sample Rate**: How often to store (ms)
- **Deadband**: Minimum change to record
- **Max Time Between Samples**: Force store even if no change

### Querying History
```python
from java.util import Date

# Query last hour of temperature
ds = system.tag.queryTagHistory(
    paths=["[default]Plant/Motor/Temp"],
    startDate=Date(Date().getTime() - 3600000),
    endDate=Date(),
    returnSize=500,
    returnFormat='Wide',
    aggregationMode='Average'
)

# Aggregation modes: MinMax, Average, LastValue, Count, Range
```

## Expression Language
Ignition expressions for bindings and derived tags:

### Common Functions
- `{[default]tag/path}` - Tag reference
- `if({condition}, trueVal, falseVal)` - Conditional
- `toInt()`, `toFloat()`, `toString()` - Type conversion
- `dateFormat({timestamp}, "yyyy-MM-dd HH:mm")` - Date formatting
- `now()` - Current time
- `abs()`, `sqrt()`, `round()` - Math functions
- `concat(str1, str2)` - String concatenation

### Examples
```
# Temperature alarm check
if({[default]Motor/Temp} > 80, "HIGH TEMP", "Normal")

# Running hours calculation
{[default]Motor/RunHours} / 3600

# Formatted display
concat(round({[default]Motor/Speed}, 0), " RPM")
```

## Troubleshooting

### Common Issues
1. **Tag quality Bad_Stale**: Check OPC connection, verify device is online
2. **Tag quality Bad_NotFound**: Verify tag path exists, check provider name
3. **Slow performance**: Check number of tag subscriptions, historian backlog
4. **Gateway CPU high**: Review scripts for infinite loops, reduce scan rates
5. **Memory issues**: Check dataset sizes, review project script leaks

### Diagnostic Commands
```python
# Check gateway status
info = system.tag.readBlocking(["[System]Gateway/SystemName"])[0]

# List projects
# Gateway -> Config -> Projects

# Check OPC status
# Gateway -> Config -> OPC -> Connections -> Status
```

## Best Practices
1. Use meaningful project names and descriptions
2. Implement role-based security from the start
3. Configure automated backups
4. Monitor gateway performance with system dashboard
5. Use tag change scripts sparingly (prefer expressions)
6. Implement proper alarm management from day one
7. Use UDTs for consistent equipment modeling
8. Version control via project export/import
