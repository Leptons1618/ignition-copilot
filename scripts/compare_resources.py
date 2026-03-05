import json

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

for ep in ["tag_browse", "script_exec"]:
    path = base + "\\" + ep + "\\resource.json"
    with open(path) as f:
        data = json.load(f)
    print(f"\n=== {ep} resource.json ===")
    print(json.dumps(data, indent=2))
