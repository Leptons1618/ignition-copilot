import json

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

for ep in ["project_scan", "script_exec"]:
    config_path = f"{base}\\{ep}\\config.json"
    with open(config_path) as f:
        config = json.load(f)
    
    print(f"\n=== {ep} config.json ===")
    for method in ["doGet", "doPost", "doPut", "doDelete"]:
        enabled = config.get(method, {}).get("enabled", False)
        print(f"  {method}: enabled={enabled}")
