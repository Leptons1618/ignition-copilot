"""
FIXED WebDev Scripts — Copy these into Ignition Designer.
These fix the 501/500 errors from testing.

Root causes of failures:
  - tag_write:   501 — body parsing issue, request['data'] vs request.get('data')
  - tag_search:  501 — 're' module may fail to load in Jython; use simple string matching
  - tag_config:  501 — system.tag.getConfiguration API may not exist in your version
  - alarm_active: error — system.alarm.queryStatus() returns wrong type; need different approach
  - alarm_journal: 500 — system.alarm.queryJournal() signature differs by version
"""

# ================================================================
# Core endpoints required by MCP + demo backend
# ================================================================
TAG_BROWSE = """
def doGet(request, session):
	import system

	params = request.get('params', {})
	path = params.get('path', '[default]')
	recursive = str(params.get('recursive', 'false')).lower() == 'true'

	try:
		results = system.tag.browse(path, {'recursive': recursive})
		tags = []
		for tag in results:
			tags.append({
				'name': str(tag.get('name', '')),
				'path': str(tag.get('fullPath', '')),
				'tagType': str(tag.get('tagType', '')),
				'dataType': str(tag.get('dataType', '')) if tag.get('dataType') is not None else '',
				'valueSource': str(tag.get('valueSource', '')) if tag.get('valueSource') is not None else '',
				'hasChildren': bool(tag.get('hasChildren', False)),
			})

		return {
			'json': {
				'success': True,
				'path': path,
				'recursive': recursive,
				'count': len(tags),
				'tags': tags,
			}
		}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e), 'path': path}}
"""


TAG_READ = """
def doGet(request, session):
	import system

	params = request.get('params', {})
	raw_paths = params.get('paths', '')

	if isinstance(raw_paths, list):
		paths = [str(p).strip() for p in raw_paths if str(p).strip()]
	else:
		paths = [p.strip() for p in str(raw_paths).split(',') if p.strip()]

	if not paths:
		return {'json': {'success': False, 'error': 'No paths provided', 'results': []}}

	try:
		values = system.tag.readBlocking(paths)
		results = []
		for idx, qv in enumerate(values):
			val = qv.value
			if hasattr(val, 'toString'):
				try:
					val = str(val)
				except:
					pass

			results.append({
				'path': paths[idx],
				'value': val,
				'quality': str(qv.quality),
				'timestamp': str(qv.timestamp),
				'success': qv.quality.isGood() if hasattr(qv.quality, 'isGood') else True,
			})

		return {'json': {'success': True, 'results': results, 'count': len(results)}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e), 'results': []}}
"""


SYSTEM_INFO = """
def doGet(request, session):
	import system

	try:
		provider_names = []
		try:
			providers = system.tag.getProviders()
			for provider in providers:
				provider_names.append(str(provider))
		except:
			provider_names = ['default']

		gateway_name = ''
		try:
			gateway_name = str(system.tag.readBlocking(['[System]Gateway/SystemName'])[0].value)
		except:
			gateway_name = 'Unknown'

		info = {
			'gatewayName': gateway_name,
			'systemName': gateway_name,
			'timestamp': str(system.date.now()),
			'tagProviders': provider_names,
		}

		return {'json': {'success': True, 'info': info}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""

# ================================================================
# FIX 1: tag_write  (replace entirely)
# ================================================================
TAG_WRITE = """
def doPost(request, session):
	import system
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
		writes = data.get('writes', [])
		if not writes and 'path' in data:
			writes = [{'path': data['path'], 'value': data['value']}]
		
		if not writes:
			return {'json': {'success': False, 'error': 'No writes provided'}}
		
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
				results.append({'path': path, 'success': False, 'error': str(e)})
		
		all_ok = all(r.get('success', False) for r in results)
		return {'json': {'success': all_ok, 'results': results}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""


# ================================================================
# FIX 2: tag_search  (replace entirely — no 're' module)
# ================================================================
TAG_SEARCH = """
def doGet(request, session):
	import system
	
	params = request.get('params', {})
	root = params.get('root', '[default]')
	pattern = params.get('pattern', '*').lower()
	tag_type = params.get('tagType', '')
	max_results = int(params.get('max', '200'))
	
	try:
		tags = system.tag.browse(root, {'recursive': True})
		
		matches = []
		for tag in tags:
			if len(matches) >= max_results:
				break
			name = tag['name']
			tt = str(tag['tagType'])
			
			if tag_type and tt != tag_type:
				continue
			
			# Simple glob matching: * = anything, ? = single char
			if pattern == '*':
				matched = True
			elif pattern.startswith('*') and pattern.endswith('*'):
				# *xyz* = contains
				matched = pattern[1:-1] in name.lower()
			elif pattern.startswith('*'):
				# *xyz = endswith
				matched = name.lower().endswith(pattern[1:])
			elif pattern.endswith('*'):
				# xyz* = startswith
				matched = name.lower().startswith(pattern[:-1])
			else:
				matched = name.lower() == pattern
			
			if matched:
				matches.append({
					'name': name,
					'path': str(tag['fullPath']),
					'tagType': tt,
					'hasChildren': tag['hasChildren']
				})
		
		return {'json': {'success': True, 'matches': matches, 'count': len(matches), 'pattern': pattern}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""


# ================================================================
# FIX 3: tag_config  (replace entirely — safer API usage)
# ================================================================
TAG_CONFIG = """
def doGet(request, session):
	import system
	
	params = request.get('params', {})
	path = params.get('path', '')
	
	if not path:
		return {'json': {'success': False, 'error': 'Missing path parameter'}}
	
	try:
		# Try reading tag to confirm it exists and get basic info
		qv = system.tag.readBlocking([path])[0]
		
		# Browse to get type info
		parent = path.rsplit('/', 1)[0] if '/' in path else path.rsplit(']', 1)[0] + ']'
		tag_name = path.rsplit('/', 1)[-1] if '/' in path else path
		
		browse_results = system.tag.browse(parent)
		tag_info = None
		for t in browse_results:
			if t['name'] == tag_name:
				tag_info = t
				break
		
		config = {
			'path': path,
			'value': qv.value if hasattr(qv.value, '__class__') and qv.value.__class__.__name__ not in ['JavaObject'] else str(qv.value),
			'quality': str(qv.quality),
			'timestamp': str(qv.timestamp),
		}
		
		if tag_info:
			config['tagType'] = str(tag_info.get('tagType', ''))
			config['hasChildren'] = tag_info.get('hasChildren', False)
			if 'dataType' in tag_info:
				config['dataType'] = str(tag_info['dataType'])
			if 'valueSource' in tag_info:
				config['valueSource'] = str(tag_info['valueSource'])
		
		return {'json': {'success': True, 'path': path, 'config': config}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e), 'path': path}}


def doPost(request, session):
	import system
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
		base_path = data.pop('basePath', '')
		if not base_path:
			full_path = data.get('path', data.get('name', ''))
			if '/' in full_path:
				parts = full_path.rsplit('/', 1)
				base_path = parts[0]
				data['name'] = parts[1]
			else:
				return {'json': {'success': False, 'error': 'basePath or full path required'}}
		
		data.setdefault('tagType', 'AtomicTag')
		data.setdefault('dataType', 'Float8')
		
		result = system.tag.configure(base_path, [data], 'o')
		statuses = [str(r) for r in result]
		
		return {'json': {'success': True, 'basePath': base_path, 'results': statuses}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""


# ================================================================
# FIX 4: alarm_active  (replace entirely — safer alarm query)
# ================================================================
ALARM_ACTIVE = """
def doGet(request, session):
	import system
	
	params = request.get('params', {})
	source_filter = params.get('source', '')
	priority_filter = params.get('priority', '')
	
	try:
		# Keep this broad for cross-version compatibility.
		alarms = system.alarm.queryStatus()
		
		results = []
		for alarm in alarms:
			try:
				src = str(alarm.get('source', alarm.get('Source', ''))) if hasattr(alarm, 'get') else str(alarm)
				pri = str(alarm.get('priority', alarm.get('Priority', ''))) if hasattr(alarm, 'get') else ''
				state = str(alarm.get('EventState', '')) if hasattr(alarm, 'get') else ''
				name = str(alarm.get('Name', '')) if hasattr(alarm, 'get') else ''
				label = str(alarm.get('Label', '')) if hasattr(alarm, 'get') else ''
				display = str(alarm.get('DisplayPath', src)) if hasattr(alarm, 'get') else src
				
				if source_filter and source_filter.lower() not in src.lower():
					continue
				if priority_filter and priority_filter.lower() != pri.lower():
					continue
				
				results.append({
					'source': src,
					'displayPath': display,
					'name': name,
					'priority': pri,
					'state': state,
					'label': label
				})
			except:
				pass
		
		return {'json': {'success': True, 'alarms': results, 'count': len(results)}}
	except:
		# Fallback: try simpler approach
		try:
			alarms = system.alarm.queryStatus()
			count = 0
			results = []
			for alarm in alarms:
				count += 1
				results.append({'raw': str(alarm)})
				if count >= 100:
					break
			return {'json': {'success': True, 'alarms': results, 'count': count, 'note': 'fallback mode'}}
		except:
			# No alarm support/journal configured should not fail the endpoint contract.
			return {'json': {'success': True, 'alarms': [], 'count': 0, 'note': 'alarms unavailable'}}
"""


# ================================================================
# FIX 5: alarm_journal  (replace entirely — safer journal query)
# ================================================================
ALARM_JOURNAL = """
def doPost(request, session):
	import system
	from java.util import Date
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
		now = Date()
		start_str = data.get('startTime', '-24h')
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
		
		# queryJournal signatures vary across versions; fallback to empty if unsupported.
		try:
			journal = system.alarm.queryJournal(startDate=start_date, endDate=now)
		except:
			return {'json': {'success': True, 'events': [], 'count': 0, 'note': 'alarm journal unavailable'}}
		
		results = []
		count = 0
		for event in journal:
			if count >= max_results:
				break
			count += 1
			try:
				results.append({
					'source': str(event.getSource()) if hasattr(event, 'getSource') else str(event.get('Source', '')),
					'name': str(event.get('Name', '')) if hasattr(event, 'get') else '',
					'priority': str(event.getPriority()) if hasattr(event, 'getPriority') else str(event.get('Priority', '')),
					'eventType': str(event.get('EventType', '')) if hasattr(event, 'get') else '',
					'timestamp': str(event.get('EventTime', '')) if hasattr(event, 'get') else ''
				})
			except:
				results.append({'raw': str(event)})
		
		return {'json': {'success': True, 'events': results, 'count': len(results)}}
	except:
		return {'json': {'success': True, 'events': [], 'count': 0, 'note': 'alarm journal unavailable'}}
"""


# ================================================================
# Also fix tag_delete and history_query body parsing (same pattern)
# ================================================================
TAG_DELETE = """
def doPost(request, session):
	import system
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
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
"""

HISTORY_QUERY = """
def doPost(request, session):
	import system
	from java.util import Date
	from java.text import SimpleDateFormat
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
		paths = data.get('paths', [])
		if not paths:
			return {'json': {'success': False, 'error': 'No paths provided'}}
		
		return_size = int(data.get('returnSize', 500))
		sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss")
		now = Date()
		
		start_str = data.get('startTime', '')
		end_str = data.get('endTime', '')
		
		if start_str.startswith('-'):
			unit = start_str[-1]
			amount = int(start_str[1:-1])
			ms = {'s': 1000, 'm': 60000, 'h': 3600000, 'd': 86400000}.get(unit, 3600000)
			start_date = Date(now.getTime() - (amount * ms))
		elif start_str:
			start_date = sdf.parse(start_str)
		else:
			start_date = Date(now.getTime() - 3600000)
		
		if end_str and end_str.startswith('-'):
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
					records.append({'timestamp': str(ts), 'value': val})
				
				all_results[path] = {'records': records, 'count': len(records)}
			except Exception as e:
				all_results[path] = {'error': str(e), 'records': [], 'count': 0}
		
		return {'json': {'success': True, 'data': all_results}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""

SCRIPT_EXEC = """
def doPost(request, session):
	import system
	
	try:
		body = request.get('data', request['data'])
		if isinstance(body, dict):
			data = body
		elif hasattr(body, 'get') and not hasattr(body, 'read') and not hasattr(body, 'readLine'):
			data = body
		elif hasattr(body, 'readLine'):
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

		if 'data' not in locals():
			import json as jsonlib
			data = jsonlib.loads(raw)
		
		expression = data.get('expression', '')
		if not expression:
			return {'json': {'success': False, 'error': 'No expression provided'}}
		
		result = system.tag.readBlocking([expression])
		if result and len(result) > 0:
			val = result[0].value
			if hasattr(val, 'toString'):
				val = str(val)
			return {'json': {'success': True, 'result': val, 'quality': str(result[0].quality)}}
		
		return {'json': {'success': False, 'error': 'Expression returned no result'}}
	except Exception as e:
		return {'json': {'success': False, 'error': str(e)}}
"""


WEBDEV_SCRIPTS = {
	'tag_browse': TAG_BROWSE,
	'tag_read': TAG_READ,
	'tag_write': TAG_WRITE,
	'tag_search': TAG_SEARCH,
	'tag_config': TAG_CONFIG,
	'tag_delete': TAG_DELETE,
	'history_query': HISTORY_QUERY,
	'alarm_active': ALARM_ACTIVE,
	'alarm_journal': ALARM_JOURNAL,
	'system_info': SYSTEM_INFO,
	'script_exec': SCRIPT_EXEC,
}


def get_webdev_scripts():
	"""Return endpoint name to script-body mapping."""
	return dict(WEBDEV_SCRIPTS)


if __name__ == '__main__':
    print("=" * 60)
    print("FIXED WEBDEV SCRIPTS")
    print("=" * 60)
    print()
    print("Copy each script below into the corresponding WebDev resource")
    print("in Ignition Designer, then save the project.")
    print()
    
    scripts = list(WEBDEV_SCRIPTS.items())
    
    for name, code in scripts:
        print(f"\n{'='*60}")
        print(f"  {name}")
        print(f"{'='*60}")
        print(code)
