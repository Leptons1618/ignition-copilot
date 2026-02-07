#!/usr/bin/env python3
"""
Web UI with MOCK DATA MODE
Works immediately without needing tag API access
Shows the demo working so you can see what it will look like
"""

from flask import Flask, render_template, request, jsonify
import json
import random
import time
from datetime import datetime

app = Flask(__name__)

# Simulation state
sim_state = {
    'enabled': False,
    'running': True,
    'temperature': 45.0,
    'speed': 1450.0,
    'load': 40.0,
    'fan_current': 8.5,
    'sim_state': 'NORMAL',
    'sim_time': 0,
    'fault_reason': '',
    'alarm_active': False,
    'last_update': time.time()
}

def update_simulation():
    """Update simulation state"""
    global sim_state
    
    if not sim_state['enabled']:
        return
    
    # Calculate time delta
    now = time.time()
    dt = now - sim_state['last_update']
    sim_state['last_update'] = now
    sim_state['sim_time'] += dt
    
    state = sim_state['sim_state']
    temp = sim_state['temperature']
    fan = sim_state['fan_current']
    load = sim_state['load']
    sim_time = sim_state['sim_time']
    
    # State machine
    if state == 'NORMAL':
        # Normal variation
        load += random.uniform(-0.3, 0.3)
        temp += load * 0.01
        
        if sim_time > 20:
            sim_state['sim_state'] = 'FAN_FAIL'
    
    elif state == 'FAN_FAIL':
        # Fan degrading
        fan -= 0.05 * dt
        load += 0.2 * dt
        temp += 0.15 * dt
        
        if sim_time > 40:
            sim_state['sim_state'] = 'OVERHEAT'
    
    elif state == 'OVERHEAT':
        # Rapid temperature rise
        temp += 0.35 * dt
        load += 0.1 * dt
        
        if temp > 85:
            sim_state['sim_state'] = 'TRIP'
            sim_state['running'] = False
            sim_state['fault_reason'] = 'Cooling failure caused overheating'
            sim_state['alarm_active'] = True
    
    elif state == 'TRIP':
        # Stopped
        sim_state['running'] = False
    
    # Update state
    sim_state['temperature'] = max(20, min(100, temp))
    sim_state['fan_current'] = max(0, min(10, fan))
    sim_state['load'] = max(0, min(100, load))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/status')
def get_status():
    """Get motor status"""
    update_simulation()
    
    return jsonify({
        'Temperature': {'value': sim_state['temperature'], 'quality': 'Good'},
        'Speed': {'value': sim_state['speed'], 'quality': 'Good'},
        'LoadPercent': {'value': sim_state['load'], 'quality': 'Good'},
        'FanCurrent': {'value': sim_state['fan_current'], 'quality': 'Good'},
        'Running': {'value': sim_state['running'], 'quality': 'Good'},
        'AlarmActive': {'value': sim_state['alarm_active'], 'quality': 'Good'},
        'SimState': {'value': sim_state['sim_state'], 'quality': 'Good'},
        'FaultReason': {'value': sim_state['fault_reason'], 'quality': 'Good'}
    })

@app.route('/api/start_sim', methods=['POST'])
def start_sim():
    """Start the simulator"""
    sim_state['enabled'] = True
    sim_state['last_update'] = time.time()
    return jsonify({'success': True})

@app.route('/api/reset_sim', methods=['POST'])
def reset_sim():
    """Reset the simulator"""
    global sim_state
    sim_state = {
        'enabled': False,
        'running': True,
        'temperature': 45.0,
        'speed': 1450.0,
        'load': 40.0,
        'fan_current': 8.5,
        'sim_state': 'NORMAL',
        'sim_time': 0,
        'fault_reason': '',
        'alarm_active': False,
        'last_update': time.time()
    }
    return jsonify({'success': True})

@app.route('/api/stop_sim', methods=['POST'])
def stop_sim():
    """Stop the simulator"""
    sim_state['enabled'] = False
    return jsonify({'success': True})

@app.route('/api/read_tag', methods=['POST'])
def read_tag():
    """Read a tag"""
    data = request.json
    tag_path = data.get('tag_path', '')
    
    # Extract tag name from path
    tag_name = tag_path.split('/')[-1] if '/' in tag_path else tag_path
    
    # Map to sim state
    value_map = {
        'Temperature': sim_state['temperature'],
        'Speed': sim_state['speed'],
        'LoadPercent': sim_state['load'],
        'FanCurrent': sim_state['fan_current'],
        'Running': sim_state['running'],
        'SimState': sim_state['sim_state']
    }
    
    value = value_map.get(tag_name, None)
    
    return jsonify({
        'path': tag_path,
        'value': value,
        'quality': 'Good' if value is not None else 'Bad',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/write_tag', methods=['POST'])
def write_tag():
    """Write a tag"""
    data = request.json
    tag_path = data.get('tag_path', '')
    value = data.get('value')
    
    tag_name = tag_path.split('/')[-1] if '/' in tag_path else tag_path
    
    # Handle control tags
    if tag_name == 'SimulatorEnabled':
        sim_state['enabled'] = bool(value)
    elif tag_name == 'ResetAlarm':
        if value:
            sim_state.update({
                'running': True,
                'sim_state': 'NORMAL',
                'sim_time': 0,
                'fault_reason': '',
                'alarm_active': False
            })
    
    return jsonify({'success': True, 'path': tag_path})

if __name__ == '__main__':
    import os
    
    # Create templates directory if needed
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    
    print("=" * 70)
    print("IGNITION DEMO - MOCK DATA MODE")
    print("=" * 70)
    print()
    print("⚠️  Running in SIMULATION MODE")
    print("   (Not connected to real Ignition tags)")
    print()
    print("This demonstrates what the system will look like when")
    print("the Tag API is properly configured.")
    print()
    print(f"📱 Open your browser to: http://localhost:5001")
    print()
    print("To connect to REAL tags:")
    print("  1. Follow CUSTOM_API_SETUP.md to create tag endpoint in Designer")
    print("  2. Or enable WebDev module in Gateway config")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 70)
    
    app.run(debug=False, port=5001, host='0.0.0.0')
