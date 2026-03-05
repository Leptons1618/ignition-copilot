import json, os, shutil

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources\script_exec"

# Write a very simple doGet.py that just calls requestProjectScan
doget = """def doGet(request, session):
\timport system
\tsystem.util.requestProjectScan()
\treturn {'json': {'success': True, 'message': 'Project scan requested'}}
"""

with open(os.path.join(base, "doGet.py"), "w", newline="\n") as f:
    f.write(doget)

print("Wrote simple doGet.py:")
print(doget)

# Also restore original resource.json from tag_browse as template  
tag_browse_res = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources\tag_browse\resource.json"
with open(tag_browse_res) as f:
    template = json.load(f)

# Just copy target's sig from files
import hashlib
files_to_hash = ["config.json", "doGet.py", "doPost.py"]
all_data = b""
for fn in template["files"]:
    fp = os.path.join(base, fn)
    if os.path.exists(fp):
        all_data += open(fp, "rb").read()

new_sig = hashlib.sha256(all_data).hexdigest()
template["attributes"]["lastModificationSignature"] = new_sig
template["attributes"]["lastModification"]["actor"] = "copilot-ai"
template["attributes"]["lastModification"]["timestamp"] = "2026-03-05T02:05:00Z"

with open(os.path.join(base, "resource.json"), "w") as f:
    json.dump(template, f)

print(f"\nUpdated resource.json with sig: {new_sig}")
