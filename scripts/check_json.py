import json, os

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

for ep in ["tag_browse", "script_exec", "project_scan"]:
    res_path = f"{base}\\{ep}\\resource.json"
    
    # Read raw bytes
    with open(res_path, "rb") as f:
        raw = f.read()
    
    print(f"\n=== {ep} resource.json ({len(raw)} bytes) ===")
    print(f"BOM: {raw[:3] == b'\\xef\\xbb\\xbf'}")
    print(f"First 10 bytes: {raw[:10]}")
    
    # Try to parse
    try:
        data = json.loads(raw)
        print(f"Valid JSON: True")
        print(f"Keys: {list(data.keys())}")
        print(f"Content: {raw.decode('utf-8')[:300]}")
    except Exception as e:
        print(f"JSON Error: {e}")
        print(f"Raw: {raw[:200]}")
