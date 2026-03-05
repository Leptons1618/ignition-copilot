import json, os, hashlib

# Fix project_scan doGet.py to also have scan capability
base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources\project_scan"

doget = """def doGet(request, session):
\timport system
\tsystem.util.requestProjectScan()
\treturn {'json': {'success': True, 'message': 'Project scan requested'}}
"""

with open(os.path.join(base, "doGet.py"), "w", newline="\n") as f:
    f.write(doget)

# Enable doGet in config.json
config_path = os.path.join(base, "config.json")
with open(config_path) as f:
    config = json.load(f)
config["doGet"]["enabled"] = True
with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

# Update resource.json
res_path = os.path.join(base, "resource.json")
with open(res_path) as f:
    res = json.load(f)

all_data = b""
for fn in res["files"]:
    fp = os.path.join(base, fn)
    if os.path.exists(fp):
        all_data += open(fp, "rb").read()

res["scope"] = "G"
res["attributes"]["lastModificationSignature"] = hashlib.sha256(all_data).hexdigest()
res["attributes"]["lastModification"]["actor"] = "copilot-ai"
res["attributes"]["lastModification"]["timestamp"] = "2026-03-05T02:05:00Z"

with open(res_path, "w") as f:
    json.dump(res, f)

print("Fixed project_scan endpoint")
print(f"resource.json: {json.dumps(res, indent=2)}")
