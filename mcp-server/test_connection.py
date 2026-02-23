#!/usr/bin/env python3
"""
Test script to verify Ignition Gateway connectivity and MCP server functionality
Run this BEFORE starting the MCP server to diagnose issues
"""

import sys
import json
import requests
from pathlib import Path

def test_ignition_connection():
    """Test basic connectivity to Ignition Gateway"""
    print("=" * 60)
    print("IGNITION MCP SERVER - CONNECTION TEST")
    print("=" * 60)
    print()
    
    # Load config
    config_path = Path(__file__).parent / 'config.json'
    
    if not config_path.exists():
        print("❌ ERROR: config.json not found")
        print(f"   Expected at: {config_path}")
        return False
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    gateway_url = config['ignition']['gateway_url']
    username = config['ignition']['username']
    password = config['ignition']['password']
    
    print(f"Testing connection to: {gateway_url}")
    print(f"Username: {username}")
    print()
    
    # Test 1: Basic connectivity
    print("Test 1: Basic Gateway Connectivity")
    print("-" * 60)
    try:
        response = requests.get(gateway_url, timeout=5, verify=False)
        print(f"✅ Gateway is reachable")
        print(f"   Status Code: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot connect to {gateway_url}")
        print(f"   Is Ignition Gateway running?")
        print(f"   Try opening {gateway_url} in your browser")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False
    
    print()
    
    # Test 2: Gateway info endpoint
    print("Test 2: Gateway Info Endpoint")
    print("-" * 60)
    try:
        response = requests.get(
            f"{gateway_url}/system/gwinfo",
            auth=(username, password),
            timeout=5,
            verify=False
        )
        if response.status_code == 200:
            print(f"✅ Gateway info retrieved successfully")
            info = response.json()
            print(f"   Gateway: {info.get('name', 'Unknown')}")
            print(f"   Version: {info.get('version', 'Unknown')}")
        elif response.status_code == 401:
            print(f"❌ Authentication failed")
            print(f"   Check username/password in config.json")
            return False
        else:
            print(f"❌ Unexpected status: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Error accessing gateway info: {e}")
        return False
    
    print()
    
    # Test 3: Tag read endpoint (webdev)
    print("Test 3: Tag Read Endpoint (WebDev)")
    print("-" * 60)
    
    # First check if webdev module exists
    test_tag = "[System]Gateway/SystemName"
    try:
        response = requests.post(
            f"{gateway_url}/system/webdev/tag/read",
            json={'tagPaths': [test_tag]},
            auth=(username, password),
            timeout=5,
            verify=False
        )
        if response.status_code == 200:
            print(f"✅ WebDev tag read working")
            results = response.json()
            print(f"   Test tag: {test_tag}")
            print(f"   Value: {results[0].get('value', 'N/A')}")
        elif response.status_code == 404:
            print(f"❌ WebDev endpoints not available")
            print(f"   Note: Ignition's built-in webdev may not be available")
            print(f"   We'll need to use Gateway Network API instead")
            print(f"   This is NORMAL - we'll adjust the client")
        else:
            print(f"⚠️  Status: {response.status_code}")
            print(f"   Response: {response.text[:200]}")
    except Exception as e:
        print(f"⚠️  WebDev test failed: {e}")
        print(f"   This is OK - we'll use Gateway Network API")
    
    print()
    
    # Test 4: Check if demo tags exist
    print("Test 4: Demo Tag Structure")
    print("-" * 60)
    demo_tag = "[default]DemoPlant/MotorM12/Temperature"
    try:
        response = requests.post(
            f"{gateway_url}/system/webdev/tag/read",
            json={'tagPaths': [demo_tag]},
            auth=(username, password),
            timeout=5,
            verify=False
        )
        if response.status_code == 200:
            results = response.json()
            if results and results[0].get('quality') != 'Bad':
                print(f"✅ Demo tags are imported")
                print(f"   Temperature: {results[0].get('value')}°C")
                print(f"   Quality: {results[0].get('quality')}")
            else:
                print(f"⚠️  Tag exists but quality is bad")
                print(f"   Did you import tags.json into Ignition Designer?")
        else:
            print(f"⚠️  Cannot read demo tag")
            print(f"   You need to import tags.json into Ignition Designer")
            print(f"   See QUICKSTART.md Step 1")
    except Exception as e:
        print(f"⚠️  Demo tag test skipped: {e}")
    
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("✅ Basic connectivity: PASS")
    print("✅ Authentication: PASS")
    print()
    print("Next steps:")
    print("1. If tags not imported: Import tags.json in Ignition Designer")
    print("2. If WebDev failed: We'll use alternative API (normal)")
    print("3. Try starting MCP server: python ignition_mcp_server.py")
    print()
    
    return True


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings('ignore', message='Unverified HTTPS request')
    
    success = test_ignition_connection()
    sys.exit(0 if success else 1)
