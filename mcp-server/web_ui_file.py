#!/usr/bin/env python3
"""
Web UI that reads from JSON file exported by Gateway Script
This bypasses the need for HTTP API access to Ignition
"""

from flask import Flask, render_template, request, jsonify
import json
import os
from datetime import datetime
import time

app = Flask(__name__)

# Path where Gateway script writes the JSON file
# Change this to match where your Gateway script writes
JSON_FILE_PATHS = [
    "D:/Sandbox/ignition-copilot/mcp-server/motor_status.json",
    "C:/ProgramData/Inductive Automation/Ignition/data/motor_status.json",
    "./motor_status.json"
]

def find_json_file():
    """Find the motor status JSON file"""
    for path in JSON_FILE_PATHS:
        if os.path.exists(path):
            return path
    return None

def read_motor_status():
    """Read motor status from JSON file"""
    json_path = find_json_file()
    
    if not json_path:
        return None
    
    try:
        with open(json_path, 'r') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return None

def write_command(tag_name, value):
    """Write a command by creating a command file"""
    command = {
        "tag": tag_name,
        "value": value,
        "timestamp": datetime.now().isoformat()
    }
    
    # Write command file
    cmd_file = "D:/Sandbox/ignition-copilot/mcp-server/motor_command.json"
    try:
        with open(cmd_file, 'w') as f:
            json.dump(command, f)
        return True
    except:
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get motor status from JSON file"""
    data = read_motor_status()
    
    if not data:
        # Return error or mock data
        return jsonify({
            'error': 'Cannot read motor status file',
            'message': 'Make sure Gateway script is running and exporting to JSON'
        }), 503
    
    return jsonify(data)

@app.route('/api/read_tag', methods=['POST'])
def read_tag():
    """Read a specific tag"""
    req_data = request.json
    tag_path = req_data.get('tag_path', '')
    
    # Extract tag name
    tag_name = tag_path.split('/')[-1] if '/' in tag_path else tag_path
    
    motor_data = read_motor_status()
    
    if motor_data and tag_name in motor_data:
        tag_data = motor_data[tag_name]
        return jsonify({
            'path': tag_path,
            'value': tag_data.get('value'),
            'quality': tag_data.get('quality'),
            'timestamp': tag_data.get('timestamp')
        })
    
    return jsonify({
        'path': tag_path,
        'value': None,
        'quality': 'Bad',
        'error': 'Tag not found in export'
    })

@app.route('/api/write_tag', methods=['POST'])
def write_tag():
    """Write a tag via command file"""
    req_data = request.json
    tag_path = req_data.get('tag_path', '')
    value = req_data.get('value')
    
    tag_name = tag_path.split('/')[-1] if '/' in tag_path else tag_path
    
    success = write_command(tag_name, value)
    
    return jsonify({
        'success': success,
        'path': tag_path,
        'message': 'Command file created' if success else 'Failed to write command'
    })

@app.route('/api/start_sim', methods=['POST'])
def start_sim():
    """Start simulator"""
    write_command('SimulatorEnabled', True)
    return jsonify({'success': True})

@app.route('/api/reset_sim', methods=['POST'])
def reset_sim():
    """Reset simulator"""
    write_command('ResetAlarm', True)
    return jsonify({'success': True})

@app.route('/api/stop_sim', methods=['POST'])
def stop_sim():
    """Stop simulator"""
    write_command('SimulatorEnabled', False)
    return jsonify({'success': True})

@app.route('/api/health')
def health():
    """Check if JSON file is being updated"""
    json_path = find_json_file()
    
    if not json_path:
        return jsonify({
            'status': 'error',
            'message': 'JSON file not found',
            'checked_paths': JSON_FILE_PATHS
        })
    
    try:
        stat = os.stat(json_path)
        age = time.time() - stat.st_mtime
        
        return jsonify({
            'status': 'ok' if age < 5 else 'stale',
            'file_path': json_path,
            'last_modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            'age_seconds': age,
            'message': 'File is fresh' if age < 5 else 'File is stale - check Gateway script'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

if __name__ == '__main__':
    print("=" * 70)
    print("IGNITION WEB UI - FILE-BASED MODE")
    print("=" * 70)
    print()
    print("This mode reads tag data from a JSON file exported by")
    print("a Gateway Timer Script.")
    print()
    
    json_path = find_json_file()
    if json_path:
        print(f"✅ Found motor status file: {json_path}")
        stat = os.stat(json_path)
        age = time.time() - stat.st_mtime
        print(f"   Last updated: {age:.1f} seconds ago")
        
        if age > 10:
            print(f"   ⚠️  File is stale - make sure Gateway script is running")
    else:
        print(f"⚠️  Motor status file not found")
        print(f"   Checked:")
        for path in JSON_FILE_PATHS:
            print(f"   - {path}")
        print()
        print("   Setup required:")
        print("   1. Add export script to Gateway Timer Scripts")
        print("   2. Set file path in script to writable location")
    
    print()
    print(f"📱 Open browser to: http://localhost:5002")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 70)
    
    app.run(debug=False, port=5002, host='0.0.0.0')
