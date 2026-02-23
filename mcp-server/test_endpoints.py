#!/usr/bin/env python3
"""
Endpoint Test Script — tests every WebDev endpoint against live Ignition Gateway.
Run from mcp-server/ directory.
"""

import requests
import json
import sys
import warnings

warnings.filterwarnings('ignore')

# ── Config ──────────────────────────────────────────────────────────── #
with open('config.json') as f:
    cfg = json.load(f)

BASE = cfg['ignition']['gateway_url'].rstrip('/')
PROJECT = cfg['ignition'].get('project', 'ignition-copilot')
AUTH = (cfg['ignition']['username'], cfg['ignition']['password'])
URL = lambda res: f"{BASE}/system/webdev/{PROJECT}/{res}"

PASS = 0
FAIL = 0
SKIP = 0

def test(name, method, resource, params=None, json_body=None, expect_key='success'):
    global PASS, FAIL
    url = URL(resource)
    try:
        if method == 'GET':
            r = requests.get(url, params=params or {}, auth=AUTH, verify=False, timeout=10)
        else:
            r = requests.post(url, json=json_body, auth=AUTH, verify=False, timeout=10,
                              headers={'Content-Type': 'application/json'})

        if r.status_code != 200:
            print(f"  [FAIL] {name}  — HTTP {r.status_code}: {r.text[:200]}")
            FAIL += 1
            return None

        data = r.json()
        ok = data.get(expect_key)
        if ok:
            print(f"  [PASS] {name}  — {json.dumps(data, default=str)[:200]}")
            PASS += 1
        else:
            print(f"  [FAIL] {name}  — {json.dumps(data, default=str)[:200]}")
            FAIL += 1
        return data

    except requests.exceptions.ConnectionError:
        print(f"  [FAIL] {name}  — Connection refused (is Gateway running?)")
        FAIL += 1
        return None
    except Exception as e:
        print(f"  [FAIL] {name}  — {type(e).__name__}: {e}")
        FAIL += 1
        return None


def header(title):
    print(f"\n{'='*60}\n  {title}\n{'='*60}")


# ── 0. Gateway reachable? ──────────────────────────────────────────── #
header("0. Gateway Connection")
try:
    r = requests.get(BASE, auth=AUTH, verify=False, timeout=5)
    print(f"  [{'PASS' if r.status_code == 200 else 'FAIL'}] Gateway reachable — HTTP {r.status_code}")
    if r.status_code != 200:
        print("  Cannot reach gateway. Aborting.")
        sys.exit(1)
    PASS += 1
except Exception as e:
    print(f"  [FAIL] Gateway unreachable — {e}")
    FAIL += 1
    print("  Aborting.")
    sys.exit(1)


# ── 1. tag_browse ───────────────────────────────────────────────────── #
header("1. tag_browse")
test("Browse [default]", "GET", "tag_browse", params={"path": "[default]"})
test("Browse [default] recursive", "GET", "tag_browse", params={"path": "[default]", "recursive": "true"})


# ── 2. tag_read ─────────────────────────────────────────────────────── #
header("2. tag_read")
test("Read system tag", "GET", "tag_read",
     params={"paths": "[System]Gateway/SystemName"})
test("Read demo tag", "GET", "tag_read",
     params={"paths": "[default]DemoPlant/MotorM12/Temperature"})
test("Read multiple", "GET", "tag_read",
     params={"paths": "[default]DemoPlant/MotorM12/Temperature,[default]DemoPlant/MotorM12/Speed"})
test("Read missing (expect error entry)", "GET", "tag_read",
     params={"paths": "[default]NonExistent/FakeTag"})


# ── 3. tag_write ────────────────────────────────────────────────────── #
header("3. tag_write")
test("Write single", "POST", "tag_write",
     json_body={"path": "[default]DemoPlant/MotorM12/Speed", "value": 1500})
test("Write batch", "POST", "tag_write",
     json_body={"writes": [
         {"path": "[default]DemoPlant/MotorM12/Speed", "value": 1450},
         {"path": "[default]DemoPlant/MotorM12/LoadPercent", "value": 60}
     ]})


# ── 4. tag_config ───────────────────────────────────────────────────── #
header("4. tag_config (GET)")
test("Get config", "GET", "tag_config",
     params={"path": "[default]DemoPlant/MotorM12/Temperature"})

header("4b. tag_config (POST — create tag)")
test("Create test tag", "POST", "tag_config",
     json_body={"basePath": "[default]DemoPlant", "name": "_TestTag", "tagType": "AtomicTag", "dataType": "Float8", "value": 42.0})


# ── 5. tag_search ───────────────────────────────────────────────────── #
header("5. tag_search")
test("Search *Temp*", "GET", "tag_search",
     params={"root": "[default]", "pattern": "*Temp*"})
test("Search all AtomicTags", "GET", "tag_search",
     params={"root": "[default]", "pattern": "*", "tagType": "AtomicTag", "max": "20"})


# ── 6. tag_delete ───────────────────────────────────────────────────── #
header("6. tag_delete")
test("Delete test tag", "POST", "tag_delete",
     json_body={"paths": ["[default]DemoPlant/_TestTag"]})


# ── 7. history_query ────────────────────────────────────────────────── #
header("7. history_query")
test("History -1h", "POST", "history_query",
     json_body={"paths": ["[default]DemoPlant/MotorM12/Temperature"], "startTime": "-1h", "returnSize": 10})


# ── 8. alarm_active ─────────────────────────────────────────────────── #
header("8. alarm_active")
# Alarm module may not be available — success:true with empty list is still PASS
test("Active alarms (all)", "GET", "alarm_active")
test("Active alarms (filtered)", "GET", "alarm_active",
     params={"source": "MotorM12"})


# ── 9. alarm_journal ────────────────────────────────────────────────── #
header("9. alarm_journal")
# Alarm journal may not be available — success:true with empty list is still PASS
test("Alarm journal -24h", "POST", "alarm_journal",
     json_body={"startTime": "-24h"})


# ── 10. system_info ─────────────────────────────────────────────────── #
header("10. system_info")
test("System info", "GET", "system_info")


# ── 11. script_exec ─────────────────────────────────────────────────── #
header("11. script_exec")
test("Execute expression", "POST", "script_exec",
     json_body={"expression": "[System]Gateway/SystemName"})


# ── Summary ─────────────────────────────────────────────────────────── #
header("SUMMARY")
total = PASS + FAIL
print(f"  PASS: {PASS}/{total}")
print(f"  FAIL: {FAIL}/{total}")
if FAIL == 0:
    print("  All endpoints working!")
else:
    print(f"  {FAIL} endpoint(s) need attention.")
