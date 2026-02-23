#!/usr/bin/env python3
"""
Web UI for Ignition MCP — full-featured Flask interface.
Exposes every capability of the IgnitionClient as REST API + interactive dashboard.
"""

from flask import Flask, render_template, request, jsonify
import json, os
from simple_client import SimpleIgnitionClient

app = Flask(__name__)

# ------------------------------------------------------------------ #
#  Load config & init client
# ------------------------------------------------------------------ #
config_path = os.path.join(os.path.dirname(__file__), 'config.json')
with open(config_path) as f:
    config = json.load(f)

client = SimpleIgnitionClient(
    config['ignition']['gateway_url'],
    config['ignition']['username'],
    config['ignition']['password'],
    config['ignition'].get('project', 'ignition-copilot'),
)

# ================================================================== #
#  Pages
# ================================================================== #

@app.route('/')
def index():
    return render_template('index.html')

# ================================================================== #
#  Connection
# ================================================================== #

@app.route('/api/connection')
def api_connection():
    ok = client.test_connection()
    info = client.get_system_info() if ok else {}
    return jsonify({'connected': ok, 'info': info})

# ================================================================== #
#  Tag Browse
# ================================================================== #

@app.route('/api/browse')
def api_browse():
    path = request.args.get('path', '[default]')
    recursive = request.args.get('recursive', 'false').lower() == 'true'
    tags = client.browse_tags(path, recursive)
    return jsonify({'tags': tags, 'count': len(tags), 'path': path})

# ================================================================== #
#  Tag Read
# ================================================================== #

@app.route('/api/read', methods=['GET', 'POST'])
def api_read():
    if request.method == 'POST':
        data = request.json or {}
        paths = data.get('paths', [])
    else:
        paths_str = request.args.get('paths', '')
        paths = [p.strip() for p in paths_str.split(',') if p.strip()]
    if not paths:
        return jsonify({'error': 'No paths provided'}), 400
    results = client.read_tags(paths)
    return jsonify({'results': results})

# ================================================================== #
#  Tag Write
# ================================================================== #

@app.route('/api/write', methods=['POST'])
def api_write():
    data = request.json or {}
    # Support single: {"path": "...", "value": ...}
    # Support batch:  {"writes": [{"path":"...", "value":...}, ...]}
    writes = data.get('writes', [])
    if not writes and 'path' in data:
        writes = [{'path': data['path'], 'value': data['value']}]
    if not writes:
        return jsonify({'error': 'No writes provided'}), 400
    paths = [w['path'] for w in writes]
    values = [w['value'] for w in writes]
    results = client.write_tags(paths, values)
    return jsonify({'results': results})

# ================================================================== #
#  Tag Search
# ================================================================== #

@app.route('/api/search')
def api_search():
    pattern = request.args.get('pattern', '*')
    root = request.args.get('root', '[default]')
    tag_type = request.args.get('tagType', '')
    max_r = int(request.args.get('max', '200'))
    matches = client.search_tags(pattern, root, tag_type, max_r)
    return jsonify({'matches': matches, 'count': len(matches)})

# ================================================================== #
#  Tag Config
# ================================================================== #

@app.route('/api/tag_config', methods=['GET', 'POST'])
def api_tag_config():
    if request.method == 'GET':
        path = request.args.get('path', '')
        if not path:
            return jsonify({'error': 'path required'}), 400
        cfg = client.get_tag_config(path)
        return jsonify({'config': cfg, 'path': path})
    else:
        data = request.json or {}
        base_path = data.get('base_path', data.get('basePath', ''))
        name = data.get('name', '')
        if not base_path or not name:
            return jsonify({'error': 'base_path and name required'}), 400
        result = client.create_tag(
            base_path, name,
            data.get('tag_type', data.get('tagType', 'AtomicTag')),
            data.get('data_type', data.get('dataType', 'Float8')),
            data.get('value', 0)
        )
        return jsonify(result)

# ================================================================== #
#  Tag Delete
# ================================================================== #

@app.route('/api/delete', methods=['POST'])
def api_delete():
    data = request.json or {}
    paths = data.get('paths', [])
    if isinstance(paths, str):
        paths = [paths]
    if not paths:
        return jsonify({'error': 'paths required'}), 400
    results = client.delete_tags(paths)
    return jsonify({'results': results})

# ================================================================== #
#  Historian
# ================================================================== #

@app.route('/api/history', methods=['POST'])
def api_history():
    data = request.json or {}
    paths = data.get('paths', [])
    if not paths:
        return jsonify({'error': 'paths required'}), 400
    history = client.query_history(
        paths,
        data.get('startTime', '-1h'),
        data.get('endTime', ''),
        data.get('returnSize', 500)
    )
    return jsonify({'data': history})

# ================================================================== #
#  Alarms
# ================================================================== #

@app.route('/api/alarms')
def api_alarms():
    source = request.args.get('source', '')
    priority = request.args.get('priority', '')
    alarms = client.get_active_alarms(source, priority)
    return jsonify({'alarms': alarms, 'count': len(alarms)})

@app.route('/api/alarm_journal', methods=['POST'])
def api_alarm_journal():
    data = request.json or {}
    events = client.query_alarm_journal(
        data.get('startTime', '-24h'),
        data.get('source', '*'),
        data.get('max', 500)
    )
    return jsonify({'events': events, 'count': len(events)})

# ================================================================== #
#  System Info
# ================================================================== #

@app.route('/api/system_info')
def api_system_info():
    info = client.get_system_info()
    return jsonify({'info': info})

# ================================================================== #
#  Quick status (reads common demo tags if they exist)
# ================================================================== #

@app.route('/api/status')
def api_status():
    """Read a batch of tag paths supplied as query param, or default demo tags."""
    paths_str = request.args.get('paths', '')
    if paths_str:
        paths = [p.strip() for p in paths_str.split(',') if p.strip()]
    else:
        # Fallback: try known demo tags
        base = "[default]DemoPlant/MotorM12/"
        names = ["Temperature", "Speed", "LoadPercent", "FanCurrent",
                 "Running", "AlarmActive", "SimState", "FaultReason"]
        paths = [base + n for n in names]

    results = client.read_tags(paths)

    # Convert to name→value map for easy dashboard consumption
    status = {}
    for r in results:
        # Use last segment of path as key
        name = r.get('path', '').rsplit('/', 1)[-1] if '/' in r.get('path', '') else r.get('path', '')
        status[name] = {
            'value': r.get('value'),
            'quality': r.get('quality', 'Unknown'),
        }
    return jsonify(status)

# ================================================================== #
#  Boot
# ================================================================== #

if __name__ == '__main__':
    os.makedirs(os.path.join(os.path.dirname(__file__), 'templates'), exist_ok=True)
    print("=" * 70)
    print("IGNITION WEB UI")
    print("=" * 70)
    print(f"Gateway:  {config['ignition']['gateway_url']}")
    print(f"Project:  {config['ignition'].get('project', 'ignition-copilot')}")
    print(f"\nOpen browser: http://localhost:5000")
    print("Press Ctrl+C to stop")
    print("=" * 70)
    app.run(debug=True, port=5000)
