# Custom Tag API for Ignition
# Add this as a WebDev resource in Ignition Designer

This Python script creates HTTP endpoints for tag read/write operations.

## Installation Steps:

1. Open Ignition Designer
2. Go to **Project → WebDev Resources**
3. Right-click → **Add Resource** → **Python Script**
4. Name it: `tag_api`
5. Mount Path: `/custom/tags`
6. Paste the script below:

```python
# Custom Tag API Endpoint
# Mount at: /custom/tags

import system
import json

def doGet(request, session):
    """Handle GET requests - read a single tag"""
    tagPath = request['params'].get('path', [None])[0]
    
    if not tagPath:
        return {'json': {'error': 'Missing path parameter'}}
    
    try:
        result = system.tag.readBlocking([tagPath])
        if result:
            value = result[0]
            return {'json': {
                'path': tagPath,
                'value': value.value,
                'quality': str(value.quality),
                'timestamp': str(value.timestamp)
            }}
    except Exception as e:
        return {'json': {'error': str(e)}}
    
    return {'json': {'error': 'Tag not found'}}

def doPost(request, session):
    """Handle POST requests - read/write multiple tags"""
    try:
        # Get request body
        body = request.get('data', '{}')
        data = system.util.jsonDecode(body)
        
        action = data.get('action', 'read')
        
        if action == 'read':
            # Read multiple tags
            tagPaths = data.get('tagPaths', [])
            if not tagPaths:
                return {'json': {'error': 'Missing tagPaths'}}
            
            results = system.tag.readBlocking(tagPaths)
            response = []
            
            for i, result in enumerate(results):
                response.append({
                    'path': tagPaths[i],
                    'value': result.value,
                    'quality': str(result.quality),
                    'timestamp': str(result.timestamp)
                })
            
            return {'json': response}
        
        elif action == 'write':
            # Write to tags
            writes = data.get('writes', [])
            if not writes:
                return {'json': {'error': 'Missing writes array'}}
            
            tagPaths = [w['path'] for w in writes]
            values = [w['value'] for w in writes]
            
            system.tag.writeBlocking(tagPaths, values)
            
            return {'json': {'success': True, 'count': len(writes)}}
        
        else:
            return {'json': {'error': f'Unknown action: {action}'}}
            
    except Exception as e:
        return {'json': {'error': str(e), 'type': str(type(e))}}

# Entry point
def doOptions(request, session):
    """Handle OPTIONS for CORS"""
    return {
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    }
```

## After Installation:

Your custom tag API will be available at:
- **GET**: http://localhost:8088/custom/tags?path=[default]DemoPlant/MotorM12/Temperature
- **POST**: http://localhost:8088/custom/tags
  ```json
  {
    "action": "read",
    "tagPaths": ["[default]DemoPlant/MotorM12/Temperature", "[default]DemoPlant/MotorM12/Running"]
  }
  ```

## Test it:

```bash
curl "http://localhost:8088/custom/tags?path=[default]DemoPlant/MotorM12/Temperature" -u anish:password
```

Once this endpoint is working, I'll update the client to use it!
