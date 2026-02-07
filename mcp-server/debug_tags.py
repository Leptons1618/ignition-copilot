#!/usr/bin/env python3
"""
Debug script to test different API endpoints and tag paths
"""

from simple_client import SimpleIgnitionClient
import json
import warnings
import requests
warnings.filterwarnings('ignore')

print("="*70)
print("TAG ACCESS DEBUGGING")
print("="*70)

with open('config.json') as f:
    config = json.load(f)

url = config['ignition']['gateway_url']
user = config['ignition']['username']
pwd = config['ignition']['password']

print(f"\nGateway: {url}")
print(f"User: {user}")
print()

# Test 1: Try different API endpoints
print("Test 1: Testing API Endpoints")
print("-"*70)

endpoints_to_test = [
    ('/system/gateway/read', 'POST', '["[System]Gateway/SystemName"]'),
    ('/data/tag/read', 'POST', '{"tagPaths": ["[System]Gateway/SystemName"]}'),
    ('/system/webdev/tagread', 'POST', '{"paths": ["[System]Gateway/SystemName"]}'),
]

for endpoint, method, payload in endpoints_to_test:
    try:
        print(f"\n{endpoint}:")
        if method == 'POST':
            r = requests.post(
                url + endpoint,
                data=payload,
                headers={'Content-Type': 'application/json'},
                auth=(user, pwd),
                timeout=5,
                verify=False
            )
        else:
            r = requests.get(
                url + endpoint,
                auth=(user, pwd),
                timeout=5,
                verify=False
            )
        
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            print(f"  ✅ SUCCESS")
            try:
                data = r.json()
                print(f"  Response: {str(data)[:200]}")
            except:
                print(f"  Response: {r.text[:200]}")
        elif r.status_code == 404:
            print(f"  ❌ Not Found - This endpoint doesn't exist")
        else:
            print(f"  ⚠️  Status {r.status_code}")
            print(f"  Response: {r.text[:200]}")
    except Exception as e:
        print(f"  ❌ Error: {e}")

print()
print("="*70)
print("Test 2: Testing Tag Paths")
print("-"*70)

client = SimpleIgnitionClient(url, user, pwd)

test_tags = [
    "[default]DemoPlant/MotorM12/Temperature",
    "[default]DemoPlant/MotorM12/Running",
    "[System]Gateway/SystemName",
]

for tag in test_tags:
    print(f"\n{tag}:")
    result = client.read_tag(tag)
    print(f"  Value: {result.get('value')}")
    print(f"  Quality: {result.get('quality')}")
    if 'error' in result:
        print(f"  ❌ {result['error']}")

print()
print("="*70)
print("DIAGNOSIS")
print("="*70)
print()
print("If all endpoints show 404 or errors:")
print("  → Your Ignition version may use different API endpoints")
print("  → We need to use the scripting module or Gateway Network API")
print()
print("Solution: Let me check what Ignition modules you have installed...")
print()
print("Run this in Ignition Designer Script Console:")
print("  system.tag.read('[default]DemoPlant/MotorM12/Temperature')")
print()
print("If that works in Designer, the tags exist but we need")
print("to find the right API endpoint for external access.")
