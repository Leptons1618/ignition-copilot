#!/usr/bin/env python3
"""
Find the correct API endpoint for your Ignition version
"""

import requests
import json
import warnings
warnings.filterwarnings('ignore')

with open('config.json') as f:
    config = json.load(f)

url = config['ignition']['gateway_url']
user = config['ignition']['username']
pwd = config['ignition']['password']
auth = (user, pwd)

print("="*70)
print("FINDING CORRECT TAG API")
print("="*70)
print()

# Check what modules are installed
print("Checking Gateway modules...")
print("-"*70)

try:
    r = requests.get(f"{url}/StatusPing", auth=auth, verify=False, timeout=5)
    print(f"Gateway Status: {r.status_code}")
except:
    pass

# Try WebDev module status
try:
    r = requests.get(f"{url}/system/webdev/status", auth=auth, verify=False, timeout=5)
    print(f"WebDev Status: {r.status_code}")
    if r.status_code == 200:
        print("  ✅ WebDev module is available!")
except:
    pass

print()
print("Testing WebDev Tag Endpoints...")
print("-"*70)

# WebDev uses JSON-RPC style API
webdev_endpoints = [
    {
        'name': 'WebDev Tag Read (v1)',
        'url': f"{url}/system/webdev/tag-read",
        'method': 'POST',
        'data': json.dumps({
            'tagPaths': ['[default]DemoPlant/MotorM12/Temperature']
        })
    },
    {
        'name': 'WebDev Tag Read (v2)',  
        'url': f"{url}/data/tag/read",
        'method': 'POST',
        'data': json.dumps({
            'tagPaths': ['[default]DemoPlant/MotorM12/Temperature']
        })
    },
    {
        'name': 'Tag Provider Direct',
        'url': f"{url}/data/tags/read",
        'method': 'POST',
        'data': json.dumps(['[default]DemoPlant/MotorM12/Temperature'])
    }
]

working_endpoint = None

for endpoint in webdev_endpoints:
    print(f"\n{endpoint['name']}:")
    print(f"  URL: {endpoint['url']}")
    
    try:
        r = requests.request(
            endpoint['method'],
            endpoint['url'],
            data=endpoint['data'],
            headers={'Content-Type': 'application/json'},
            auth=auth,
            verify=False,
            timeout=5
        )
        
        print(f"  Status: {r.status_code}")
        
        if r.status_code == 200:
            print(f"  ✅ SUCCESS!")
            try:
                data = r.json()
                print(f"  Response: {json.dumps(data, indent=2)[:300]}")
                working_endpoint = endpoint
                break
            except:
                print(f"  Response: {r.text[:200]}")
        else:
            print(f"  Response: {r.text[:150]}")
            
    except Exception as e:
        print(f"  ❌ Error: {e}")

print()
print("="*70)

if working_endpoint:
    print("✅ FOUND WORKING ENDPOINT!")
    print("="*70)
    print(f"  Endpoint: {working_endpoint['name']}")
    print(f"  URL: {working_endpoint['url']}")
    print()
    print("I'll update the client to use this endpoint...")
else:
    print("❌ NO WORKING TAG ENDPOINT FOUND")
    print("="*70)
    print()
    print("Your Ignition may require:")
    print("  1. WebDev module to be enabled")
    print("  2. Perspective module (has tag API)")
    print("  3. Or we need to use Gateway Network scripting")
    print()
    print("Quick check - Can you browse tags in Designer?")
    print("If yes, then tags exist but we need to enable external API access.")
    print()
    print("Solutions:")
    print("  A) Enable WebDev module in Gateway config")
    print("  B) Use Gateway Network API (requires setup)")
    print("  C) Create custom WebDev endpoint (scripting module)")
