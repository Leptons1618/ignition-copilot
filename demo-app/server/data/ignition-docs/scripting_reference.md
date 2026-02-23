> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Scripting Reference

## Script Locations

### Gateway Events
- **Timer Scripts**: Run periodically on the gateway
- **Tag Change Scripts**: Execute when a tag value changes
- **Message Handlers**: Respond to system.util.sendMessage calls

### Perspective Events
- **onStartup**: When a session starts
- **onShutdown**: When a session ends
- **Component Events**: onClick, onChange, onActionPerformed

### WebDev
- **doGet(request, session)**: Handle HTTP GET requests
- **doPost(request, session)**: Handle HTTP POST requests

## Common System Functions

### system.tag
```python
# Read tags
values = system.tag.readBlocking(["[default]Tag1", "[default]Tag2"])

# Write tags
results = system.tag.writeBlocking(
    ["[default]Tag1", "[default]Tag2"],
    [100, True]
)

# Browse tags
tags = system.tag.browse("[default]MyFolder")

# Create tags
system.tag.configure("[default]MyFolder", [{
    "name": "NewTag",
    "tagType": "AtomicTag",
    "dataType": "Float8",
    "value": 0.0
}], "o")

# Delete tags
system.tag.deleteTags(["[default]MyFolder/OldTag"])

# Query history
from java.util import Date
end = Date()
start = Date(end.getTime() - 3600000)
ds = system.tag.queryTagHistory(
    paths=["[default]Motor/Temp"],
    startDate=start,
    endDate=end,
    returnSize=500
)
```

### system.db
```python
# Run query
ds = system.db.runQuery("SELECT * FROM motors WHERE id = ?", [12])

# Named query
ds = system.db.runNamedQuery("getMotorData", {"motorId": 12})

# Run update
rows = system.db.runUpdateQuery("UPDATE motors SET status = ? WHERE id = ?", ["Running", 12])

# Transaction
tx = system.db.beginTransaction(database="main")
try:
    system.db.runUpdateQuery("INSERT INTO logs ...", [], tx=tx)
    system.db.commitTransaction(tx)
except:
    system.db.rollbackTransaction(tx)
```

### system.alarm
```python
# Query active alarms
alarms = system.alarm.queryStatus()
for a in alarms:
    print(a.getSource(), a.getPriority(), a.getState())

# Query alarm journal
from java.util import Date
journal = system.alarm.queryJournal(
    startDate=Date(Date().getTime() - 86400000),
    endDate=Date()
)

# Acknowledge alarms
system.alarm.acknowledge(["alarm-uuid-1", "alarm-uuid-2"], "Operator notes")
```

### system.util
```python
# Send message to other scopes
system.util.sendMessage("project", "handler-name", {"key": "value"})

# Get logger
logger = system.util.getLogger("MyScript")
logger.info("Motor started")
logger.warn("Temperature rising")

# Sleep (use in gateway scripts, NOT in client/Perspective)
system.util.invokeLater(lambda: doSomething(), 5000)

# JSON encode/decode
import json
text = json.dumps({"key": "value"})
obj = json.loads(text)
```

### system.perspective
```python
# Navigate to a view
system.perspective.navigate("/views/dashboard")

# Open popup
system.perspective.openPopup(
    "popupId",
    "/views/detail",
    params={"tagPath": "[default]Motor/Temp"}
)

# Close popup
system.perspective.closePopup("popupId")

# Send message to session
system.perspective.sendMessage("showNotification", {"msg": "Alert!"})

# Get session info
user = self.session.props.auth.user.userName
```

## WebDev Script Patterns

### GET handler with parameters
```python
def doGet(request, session):
    params = request.get('params', {})
    tag_path = params.get('path', '[default]')
    
    import system
    result = system.tag.readBlocking([tag_path])[0]
    
    return {'json': {
        'success': True,
        'value': result.value,
        'quality': str(result.quality)
    }}
```

### POST handler with JSON body
```python
def doPost(request, session):
    import system
    
    # Parse body (handle Java InputStream)
    body = request['data']
    if hasattr(body, 'readLine'):
        lines = []
        line = body.readLine()
        while line is not None:
            lines.append(line)
            line = body.readLine()
        raw = ''.join(lines)
    elif hasattr(body, 'read'):
        raw = body.read()
    else:
        raw = str(body)
    
    import json
    data = json.loads(raw)
    
    # Process data...
    return {'json': {'success': True, 'result': data}}
```

## Error Handling Best Practices
1. Always wrap external calls in try/except
2. Log errors with system.util.getLogger
3. Return meaningful error messages to clients
4. Use timeouts for network operations
5. Validate input before processing
