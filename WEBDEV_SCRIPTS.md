# Ignition WebDev Script Resources

All WebDev endpoints the MCP server needs. **Generic and agnostic** — works with any tag provider, any tag structure.

## Location in Ignition Designer

**Project Browser → WebDev → Resources** in project: `ignition-copilot`

Base URL: `http://localhost:8088/system/webdev/ignition-copilot/`

---

## 1. tag_browse (Browse Tags)

**Resource Name:** `tag_browse`  
**Method:** GET

```python
def doGet(request, session):
	"""Browse tags at any path. Returns children with type info."""
	import system

	params = request.get('params', {})
	path = params.get('path', '[default]')
	recursive = params.get('recursive', 'false').lower() == 'true'

	try:
		tags = system.tag.browse(path, {'recursive': recursive})

		result = []
		for tag in tags:
			entry = {
				'name': tag['name'],
				'path': str(tag['fullPath']),
				'tagType': str(tag['tagType']),
				'hasChildren': tag['hasChildren']
			}
			# Include dataType and valueSource if available
			if 'dataType' in tag:
				entry['dataType'] = str(tag['dataType'])
			if 'valueSource' in tag:
				entry['valueSource'] = str(tag['valueSource'])
			result.append(entry)

		return {'json': {'success': True, 'tags': result, 'count': len(result), 'path': path}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e), 'path': path}}
```

**Test:** `tag_browse?path=[default]`  
**Test recursive:** `tag_browse?path=[default]&recursive=true`

---

## 2. tag_read (Read Tags)

**Resource Name:** `tag_read`  
**Method:** GET

```python
def doGet(request, session):
	"""Read one or more tag values. Comma-separated paths."""
	import system

	params = request.get('params', {})
	tag_paths_str = params.get('paths', '')

	if not tag_paths_str:
		return {'json': {'success': False, 'error': 'Missing paths parameter'}}

	tag_paths = [p.strip() for p in tag_paths_str.split(',') if p.strip()]

	results = []
	for path in tag_paths:
		try:
			qv = system.tag.readBlocking([path])[0]
			val = qv.value
			# Convert Java types to Python-friendly types
			if hasattr(val, 'toString'):
				val = str(val)
			results.append({
				'path': path,
				'value': val,
				'quality': str(qv.quality),
				'timestamp': str(qv.timestamp)
			})
		except Exception as e:
			results.append({
				'path': path,
				'value': None,
				'quality': 'Error',
				'error': str(e)
			})

	return {'json': {'success': True, 'results': results}}
```

**Test:** `tag_read?paths=[default]DemoPlant/MotorM12/Temperature`  
**Multi:** `tag_read?paths=[default]DemoPlant/MotorM12/Temperature,[default]DemoPlant/MotorM12/Speed`

---

## 3. tag_write (Write Tags)

**Resource Name:** `tag_write`  
**Method:** POST

```python
def doPost(request, session):
	"""Write one or more tags. Body: {"writes": [{"path": "...", "value": ...}, ...]}"""
	import system
	import json as jsonlib

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		writes = data.get('writes', [])

		# Support single write shorthand: {"path": "...", "value": ...}
		if not writes and 'path' in data:
			writes = [{'path': data['path'], 'value': data['value']}]

		if not writes:
			return {'json': {'success': False, 'error': 'No writes provided. Send {"writes": [{"path":"...","value":...}]}'}}

		results = []
		for w in writes:
			path = w.get('path', '')
			value = w.get('value')
			if not path:
				results.append({'path': '', 'success': False, 'error': 'Empty path'})
				continue
			try:
				qv = system.tag.writeBlocking([path], [value])
				results.append({
					'path': path,
					'success': qv[0].isGood(),
					'quality': str(qv[0])
				})
			except Exception as e:
				results.append({
					'path': path,
					'success': False,
					'error': str(e)
				})

		all_ok = all(r.get('success', False) for r in results)
		return {'json': {'success': all_ok, 'results': results}}

	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**Test (single):** POST `{"path": "[default]DemoPlant/MotorM12/Speed", "value": 1500}`  
**Test (batch):** POST `{"writes": [{"path": "...", "value": 10}, {"path": "...", "value": 20}]}`

---

## 4. tag_config (Tag Configuration — Read & Create)

**Resource Name:** `tag_config`  
**Methods:** GET, POST

```python
def doGet(request, session):
	"""Get tag configuration/properties at a path."""
	import system

	params = request.get('params', {})
	path = params.get('path', '')

	if not path:
		return {'json': {'success': False, 'error': 'Missing path parameter'}}

	try:
		config = system.tag.getConfiguration(path, False)
		if config and len(config) > 0:
			tag_cfg = config[0]
			props = {}
			for prop in tag_cfg.getProperties():
				val = tag_cfg.get(prop)
				props[str(prop)] = str(val) if val is not None else None
			return {'json': {'success': True, 'path': path, 'config': props}}
		return {'json': {'success': False, 'error': 'Tag not found', 'path': path}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e), 'path': path}}


def doPost(request, session):
	"""Create or edit a tag. Body: {"path": "...", "tagType": "AtomicTag", "dataType": "Float8", "value": 0, ...}"""
	import system
	import json as jsonlib

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		base_path = data.pop('basePath', '')
		if not base_path:
			# Extract parent from full path
			full_path = data.get('path', data.get('name', ''))
			if '/' in full_path:
				parts = full_path.rsplit('/', 1)
				base_path = parts[0]
				data['name'] = parts[1]
			else:
				return {'json': {'success': False, 'error': 'basePath or full path required'}}

		# Set defaults
		data.setdefault('tagType', 'AtomicTag')
		data.setdefault('dataType', 'Float8')

		tag_list = [data]
		result = system.tag.configure(base_path, tag_list, 'o')
		
		statuses = []
		for r in result:
			statuses.append(str(r))

		return {'json': {'success': True, 'basePath': base_path, 'results': statuses}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**GET Test:** `tag_config?path=[default]DemoPlant/MotorM12/Temperature`  
**POST Test:** `{"basePath": "[default]DemoPlant", "name": "NewTag", "tagType": "AtomicTag", "dataType": "Float8", "value": 0}`

---

## 5. tag_search (Search Tags)

**Resource Name:** `tag_search`  
**Method:** GET

```python
def doGet(request, session):
	"""Search for tags by name pattern. Uses recursive browse + filter."""
	import system
	import re

	params = request.get('params', {})
	root = params.get('root', '[default]')
	pattern = params.get('pattern', '*')
	tag_type = params.get('tagType', '')  # Filter: AtomicTag, Folder, UdtInstance, etc.
	max_results = int(params.get('max', '200'))

	try:
		tags = system.tag.browse(root, {'recursive': True})

		# Convert glob-like pattern to regex
		regex_pattern = pattern.replace('*', '.*').replace('?', '.')
		regex = re.compile(regex_pattern, re.IGNORECASE)

		matches = []
		for tag in tags:
			if len(matches) >= max_results:
				break
			name = tag['name']
			tt = str(tag['tagType'])
			if tag_type and tt != tag_type:
				continue
			if regex.search(name):
				matches.append({
					'name': name,
					'path': str(tag['fullPath']),
					'tagType': tt,
					'hasChildren': tag['hasChildren']
				})

		return {'json': {'success': True, 'matches': matches, 'count': len(matches), 'pattern': pattern}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**Test:** `tag_search?root=[default]&pattern=*Temp*`  
**Filtered:** `tag_search?root=[default]&pattern=*&tagType=AtomicTag&max=50`

---

## 6. tag_delete (Delete Tags)

**Resource Name:** `tag_delete`  
**Method:** POST

```python
def doPost(request, session):
	"""Delete one or more tags. Body: {"paths": ["[default]Path/To/Tag", ...]}"""
	import system
	import json as jsonlib

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		paths = data.get('paths', [])
		if isinstance(paths, str):
			paths = [paths]

		if not paths:
			return {'json': {'success': False, 'error': 'No paths provided'}}

		results = []
		for path in paths:
			try:
				system.tag.deleteTags([path])
				results.append({'path': path, 'success': True})
			except Exception as e:
				results.append({'path': path, 'success': False, 'error': str(e)})

		all_ok = all(r.get('success', False) for r in results)
		return {'json': {'success': all_ok, 'results': results}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

---

## 7. history_query (Query Historian)

**Resource Name:** `history_query`  
**Method:** POST

```python
def doPost(request, session):
	"""Query historical tag data. Body: {"paths": [...], "startTime": "...", "endTime": "...", "returnSize": 500, "aggregateMode": "Average"}"""
	import system
	import json as jsonlib
	from java.util import Date
	from java.text import SimpleDateFormat

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		paths = data.get('paths', [])
		if not paths:
			return {'json': {'success': False, 'error': 'No paths provided'}}

		return_size = int(data.get('returnSize', 500))

		# Parse times — accept ISO format or relative like "-1h", "-30m"
		sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss")
		now = Date()

		start_str = data.get('startTime', '')
		end_str = data.get('endTime', '')

		if start_str.startswith('-'):
			# Relative time: -1h, -30m, -2d
			unit = start_str[-1]
			amount = int(start_str[1:-1])
			ms = {'s': 1000, 'm': 60000, 'h': 3600000, 'd': 86400000}.get(unit, 3600000)
			start_date = Date(now.getTime() - (amount * ms))
		elif start_str:
			start_date = sdf.parse(start_str)
		else:
			start_date = Date(now.getTime() - 3600000)  # Default: 1 hour ago

		if end_str.startswith('-'):
			unit = end_str[-1]
			amount = int(end_str[1:-1])
			ms = {'s': 1000, 'm': 60000, 'h': 3600000, 'd': 86400000}.get(unit, 3600000)
			end_date = Date(now.getTime() - (amount * ms))
		elif end_str:
			end_date = sdf.parse(end_str)
		else:
			end_date = now

		all_results = {}
		for path in paths:
			try:
				ds = system.tag.queryTagHistory(
					paths=[path],
					startDate=start_date,
					endDate=end_date,
					returnSize=return_size,
					returnFormat='Wide'
				)

				records = []
				for row in range(ds.getRowCount()):
					ts = ds.getValueAt(row, 0)
					val = ds.getValueAt(row, 1) if ds.getColumnCount() > 1 else None
					records.append({
						'timestamp': str(ts),
						'value': val
					})

				all_results[path] = {
					'records': records,
					'count': len(records)
				}
			except Exception as e:
				all_results[path] = {'error': str(e), 'records': [], 'count': 0}

		return {'json': {'success': True, 'data': all_results}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**Test:** POST `{"paths": ["[default]DemoPlant/MotorM12/Temperature"], "startTime": "-1h"}`  
**Range:** POST `{"paths": ["[default]Path/Tag"], "startTime": "2026-02-08T00:00:00", "endTime": "2026-02-08T12:00:00", "returnSize": 1000}`

---

## 8. alarm_active (Get Active Alarms)

**Resource Name:** `alarm_active`  
**Method:** GET

```python
def doGet(request, session):
	"""Get currently active alarms. Optional path filter and priority filter."""
	import system

	params = request.get('params', {})
	source_filter = params.get('source', '')
	priority = params.get('priority', '')  # e.g., Critical, High, Medium, Low
	state_filter = params.get('state', '')  # ActiveUnacked, ActiveAcked, ClearUnacked

	try:
		alarms = system.alarm.queryStatus()

		results = []
		for alarm in alarms:
			src = str(alarm.getSource())
			pri = str(alarm.getPriority())
			st = str(alarm.getState())

			# Apply filters
			if source_filter and source_filter.lower() not in src.lower():
				continue
			if priority and priority.lower() != pri.lower():
				continue
			if state_filter and state_filter.lower() != st.lower():
				continue

			results.append({
				'source': src,
				'displayPath': str(alarm.getDisplayPath()) if hasattr(alarm, 'getDisplayPath') else src,
				'name': str(alarm.getName()) if hasattr(alarm, 'getName') else '',
				'priority': pri,
				'state': st,
				'label': str(alarm.getLabel()) if hasattr(alarm, 'getLabel') else '',
				'activeTime': str(alarm.getActiveData().getTimestamp()) if alarm.getActiveData() else '',
				'isAcked': alarm.isAcknowledged() if hasattr(alarm, 'isAcknowledged') else False
			})

		return {'json': {'success': True, 'alarms': results, 'count': len(results)}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**Test:** `alarm_active`  
**Filtered:** `alarm_active?source=MotorM12&priority=Critical`

---

## 9. alarm_journal (Query Alarm History)

**Resource Name:** `alarm_journal`  
**Method:** POST

```python
def doPost(request, session):
	"""Query alarm journal/history. Body: {"startTime": "-24h", "source": "", "priority": ""}"""
	import system
	import json as jsonlib
	from java.util import Date

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		now = Date()
		start_str = data.get('startTime', '-24h')
		source = data.get('source', '*')
		priority_filter = data.get('priority', '')
		max_results = int(data.get('max', 500))

		if start_str.startswith('-'):
			unit = start_str[-1]
			amount = int(start_str[1:-1])
			ms = {'s': 1000, 'm': 60000, 'h': 3600000, 'd': 86400000}.get(unit, 3600000)
			start_date = Date(now.getTime() - (amount * ms))
		else:
			from java.text import SimpleDateFormat
			sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss")
			start_date = sdf.parse(start_str)

		journal = system.alarm.queryJournal(
			startDate=start_date,
			endDate=now,
			source=source
		)

		results = []
		for i, event in enumerate(journal):
			if i >= max_results:
				break
			pri = str(event.getPriority()) if hasattr(event, 'getPriority') else ''
			if priority_filter and priority_filter.lower() != pri.lower():
				continue
			results.append({
				'source': str(event.getSource()) if hasattr(event, 'getSource') else '',
				'name': str(event.getName()) if hasattr(event, 'getName') else '',
				'priority': pri,
				'eventType': str(event.getEventType()) if hasattr(event, 'getEventType') else '',
				'timestamp': str(event.getActiveData().getTimestamp()) if hasattr(event, 'getActiveData') and event.getActiveData() else ''
			})

		return {'json': {'success': True, 'events': results, 'count': len(results)}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

---

## 10. system_info (Gateway Info & Diagnostics)

**Resource Name:** `system_info`  
**Method:** GET

```python
def doGet(request, session):
	"""Return gateway system information and diagnostics."""
	import system

	try:
		info = {
			'gateway': {
				'systemName': system.tag.readBlocking(['[System]Gateway/SystemName'])[0].value,
				'version': str(system.tag.readBlocking(['[System]Gateway/Build/Version'])[0].value),
				'state': str(system.tag.readBlocking(['[System]Gateway/State'])[0].value),
				'uptime': system.tag.readBlocking(['[System]Gateway/Uptime'])[0].value,
			},
			'performance': {
				'cpuUsage': system.tag.readBlocking(['[System]Gateway/Performance/CPUUsage'])[0].value,
				'memoryUsed': system.tag.readBlocking(['[System]Gateway/Performance/MemoryUsed'])[0].value,
				'memoryFree': system.tag.readBlocking(['[System]Gateway/Performance/MemoryFree'])[0].value,
			},
			'tags': {
				'providers': []
			}
		}

		# List tag providers
		providers = system.tag.browse('[System]Gateway/Tags/Providers')
		for p in providers:
			info['tags']['providers'].append(str(p['name']))

		return {'json': {'success': True, 'info': info}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

**Test:** `system_info`

---

## 11. script_exec (Execute Expression — Advanced)

**Resource Name:** `script_exec`  
**Method:** POST

> **WARNING:** This endpoint executes arbitrary Ignition expressions/scripts. For development/demo use only. Remove or secure in production.

```python
def doPost(request, session):
	"""Execute an Ignition expression and return the result. Body: {"expression": "..."}"""
	import system
	import json as jsonlib

	try:
		body = request.get('data', '{}')
		if isinstance(body, str):
			data = jsonlib.loads(body)
		elif hasattr(body, 'read'):
			data = jsonlib.loads(body.read())
		else:
			data = dict(body)

		expression = data.get('expression', '')
		if not expression:
			return {'json': {'success': False, 'error': 'No expression provided'}}

		# Evaluate as tag expression
		result = system.tag.readBlocking([expression])
		if result and len(result) > 0:
			return {'json': {'success': True, 'result': result[0].value, 'quality': str(result[0].quality)}}

		return {'json': {'success': False, 'error': 'Expression returned no result'}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
```

---

## Summary Table

| # | Resource Name | Method | Purpose |
|---|--------------|--------|---------|
| 1 | `tag_browse` | GET | Browse tags at any path |
| 2 | `tag_read` | GET | Read one or more tag values |
| 3 | `tag_write` | POST | Write one or more tag values |
| 4 | `tag_config` | GET/POST | Read tag config / create tags |
| 5 | `tag_search` | GET | Search tags by name pattern |
| 6 | `tag_delete` | POST | Delete tags |
| 7 | `history_query` | POST | Query historian data |
| 8 | `alarm_active` | GET | Get active alarms |
| 9 | `alarm_journal` | POST | Query alarm history |
| 10 | `system_info` | GET | Gateway info & diagnostics |
| 11 | `script_exec` | POST | Execute expression (dev only) |

---

## Setup Instructions

1. Open **Ignition Designer** for the `ignition-copilot` project
2. Navigate to **WebDev → Resources** in the Project Browser
3. For each script above:
   - Right-click on **Resources** → **New** → **Script Resource**
   - Name it **exactly** as shown (e.g., `tag_browse`, `tag_read`, `tag_write`, etc.)
   - Copy and paste the code exactly as shown
   - **Save** the script (Ctrl+S)
4. **Save the project** (Ctrl+Shift+S or File → Save Project)
5. If changes don't take effect, restart the project from the Gateway webpage

---

## Notes

- **Function names must be exact:** `doGet` or `doPost` (case-sensitive)
- **Functions must start at column 0** (no indentation before `def`)
- Use **tabs** consistently (Ignition default)
- All URLs: `http://localhost:8088/system/webdev/ignition-copilot/{resource_name}`
- Authentication: Uses Ignition Gateway credentials
- All POST bodies are JSON. Set `Content-Type: application/json`
- All responses follow `{"success": bool, ...}` convention for consistent error handling
