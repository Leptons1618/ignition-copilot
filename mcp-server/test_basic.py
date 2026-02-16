#!/usr/bin/env python3
"""
Basic connectivity check for Ignition Gateway using config.json.
ASCII-only output for Windows console compatibility.
"""

import json
import requests
from pathlib import Path
import warnings
import sys

warnings.filterwarnings("ignore")


def main() -> int:
    print("=" * 70)
    print("IGNITION GATEWAY CONNECTION TEST")
    print("=" * 70)
    print()

    cfg_path = Path(__file__).parent / "config.json"
    if not cfg_path.exists():
        print("FAIL: config.json not found")
        return 1

    with cfg_path.open("r", encoding="utf-8") as f:
        config = json.load(f)

    url = config["ignition"]["gateway_url"]
    user = config["ignition"]["username"]
    pwd = config["ignition"]["password"]

    print(f"Gateway URL: {url}")
    print(f"Username: {user}")
    print()

    print("Test 1: Basic Connectivity")
    print("-" * 70)
    try:
        r = requests.get(url, timeout=5, verify=False)
        print(f"PASS: Gateway is reachable (Status: {r.status_code})")
    except Exception as exc:
        print(f"FAIL: Cannot reach gateway: {exc}")
        return 1

    print()
    print("Test 2: Authentication Probe")
    print("-" * 70)
    try:
        r = requests.get(f"{url}/data/perspective/client", auth=(user, pwd), timeout=5, verify=False)
        if r.status_code in (200, 404):
            print("PASS: Authentication appears valid")
        elif r.status_code == 401:
            print("FAIL: Authentication failed")
            return 1
        else:
            print(f"WARN: Unexpected status: {r.status_code}")
    except Exception as exc:
        print(f"FAIL: Authentication test error: {exc}")
        return 1

    print()
    print("=" * 70)
    print("RESULT: Gateway connectivity checks complete")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
