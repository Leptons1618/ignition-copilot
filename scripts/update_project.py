import json

path = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\project.json"
with open(path) as f:
    d = json.load(f)
d["lastModified"] = "2026-03-05T01:55:00Z"
with open(path, "w") as f:
    json.dump(d, f)
print("project.json updated")
