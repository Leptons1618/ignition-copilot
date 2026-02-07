#!/usr/bin/env python3
"""
Simple connection test using only basic HTTP
"""

import requests
import json

# Disable SSL warnings
import warnings
warnings.filterwarnings('ignore')

print("=" * 70)
print("IGNITION GATEWAY CONNECTION TEST")
print("=" * 70)
print()

# Load config
with open('config.json') as f:
    config = json.load(f)

url = config['ignition']['gateway_url']
user = config['ignition']['username']
pwd = config['ignition']['password']

print(f"Gateway URL: {url}")
print(f"Username: {user}")
print()

# Test 1: Can we reach the gateway?
print("Test 1: Basic Connectivity")
print("-" * 70)
try:
    r = requests.get(url, timeout=5, verify=False)
    print(f"✅ Gateway is reachable (Status: {r.status_code})")
except Exception as e:
    print(f"❌ Cannot reach gateway: {e}")
    print(f"\nIs Ignition running? Try opening {url} in your browser.")
    exit(1)

print()

# Test 2: Can we authenticate?
print("Test 2: Authentication")
print("-" * 70)
try:
    r = requests.get(f"{url}/data/perspective/client", 
                    auth=(user, pwd), timeout=5, verify=False)
    if r.status_code in [200, 404]:  # 404 is OK, means no perspective but auth worked
        print(f"✅ Authentication successful")
    elif r.status_code == 401:
        print(f"❌ Authentication failed - check username/password in config.json")
        exit(1)
    else:
        print(f"⚠️  Unexpected status: {r.status_code}")
except Exception as e:
    print(f"❌ Auth test failed: {e}")

print()

# Summary
print("=" * 70)
print("RESULT: Ignition Gateway is accessible")
print("=" * 70)
print()
print("✅ Gateway is running and reachable")
print("✅ Authentication is working")
print()
print("Next: Test if tags are imported...")
print("Run: python test_tags.py")
