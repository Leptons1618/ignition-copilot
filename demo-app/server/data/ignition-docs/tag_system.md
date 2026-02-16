> Updated: 2026-02-16. Canonical run/test workflow: scripts/README.md

# Ignition Tag System Reference

## Tag Providers
- **default**: The built-in internal tag provider. All user tags go here unless configured otherwise.
- **System**: Read-only system tags for gateway monitoring ([System]Gateway/*)

## Tag Types
- **AtomicTag**: A single data point (most common)
- **Folder**: Organizes tags into hierarchical groups
- **UdtInstance**: Instance of a User Defined Type (UDT)
- **UdtType**: Template definition for UDTs

## Data Types
- **Float8** (Double): 64-bit floating point - best for most analog values
- **Float4** (Float): 32-bit floating point - saves memory for less precise values
- **Int4** (Integer): 32-bit signed integer
- **Int2** (Short): 16-bit signed integer
- **Int1** (Byte): 8-bit signed integer
- **Boolean**: true/false
- **String**: Text data
- **DateTime**: Timestamp
- **DataSet**: Table/dataset
- **Document**: JSON-like nested documents

## Tag Paths
Full path format: `[provider]folder/subfolder/tagName`

Examples:
- `[default]Plant/Motor1/Temperature` - User tag
- `[System]Gateway/SystemName` - System tag
- `[default]_types_/MotorUDT` - UDT type definition

## Tag Quality
- **Good**: Normal data, reliable value
- **Bad**: Data is unreliable or stale
- **Bad_NotFound**: Tag path doesn't exist
- **Bad_Stale**: Value hasn't been updated recently
- **Uncertain**: Data quality is questionable

## Key Scripting Functions

### system.tag.readBlocking(paths)
Read one or more tags synchronously. Returns list of QualifiedValue objects.
```python
qv = system.tag.readBlocking(["[default]Motor/Temp"])[0]
print(qv.value)      # The value
print(qv.quality)    # Good, Bad, etc.
print(qv.timestamp)  # When the value was updated
```

### system.tag.writeBlocking(paths, values)
Write values to tags synchronously. Returns list of QualityCode objects.
```python
result = system.tag.writeBlocking(
    ["[default]Motor/Speed", "[default]Motor/RunCmd"],
    [1500, True]
)
# result[0].isGood() returns True if write succeeded
```

### system.tag.browse(path, filter)
Browse tags at a path. Returns BrowseResults with tag metadata.
```python
tags = system.tag.browse("[default]Plant", {"recursive": True})
for tag in tags:
    print(tag['name'], tag['fullPath'], tag['tagType'])
```

### system.tag.configure(basePath, tags, collisionPolicy)
Create or modify tags. collisionPolicy: 'o' = overwrite, 'a' = abort, 'm' = merge.
```python
system.tag.configure("[default]Plant", [{
    "name": "NewTag",
    "tagType": "AtomicTag",
    "dataType": "Float8",
    "value": 0.0
}], "o")
```

### system.tag.queryTagHistory(paths, startDate, endDate, returnSize, returnFormat)
Query historical tag data. Returns a dataset.
```python
from java.util import Date
ds = system.tag.queryTagHistory(
    paths=["[default]Motor/Temp"],
    startDate=Date(Date().getTime() - 3600000),  # 1 hour ago
    endDate=Date(),
    returnSize=500,
    returnFormat='Wide'
)
```

## Tag Configuration Properties
- **name**: Tag name (string)
- **tagType**: AtomicTag, Folder, UdtInstance
- **dataType**: Float8, Int4, Boolean, String, etc.
- **value**: Current/initial value
- **valueSource**: memory, opc, expression, derived, reference, query
- **opcServer**: OPC connection name (when valueSource=opc)
- **opcItemPath**: OPC item path (when valueSource=opc)
- **expression**: Expression (when valueSource=expression)
- **tooltip**: Tag tooltip text
- **documentation**: Tag documentation
- **engUnit**: Engineering units (degC, PSI, RPM, etc.)
- **engLow**: Engineering low range
- **engHigh**: Engineering high range
- **enabled**: Whether tag is active

## Best Practices
1. Use folders to organize tags by area/equipment
2. Use UDTs for repeating structures (motors, pumps, valves)
3. Enable history on tags that need trending
4. Configure alarm limits on critical parameters
5. Use meaningful naming: [default]Area/Equipment/Parameter
6. Set engineering units and ranges for operator displays
