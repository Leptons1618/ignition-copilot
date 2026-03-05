import json

path = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources\script_exec\resource.json"
with open(path) as f:
    data = json.load(f)

data["scope"] = "G"

with open(path, "w") as f:
    json.dump(data, f)

print("Fixed scope to 'G'")
print(json.dumps(data, indent=2))
