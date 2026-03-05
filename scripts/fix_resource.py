import json, shutil

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

# Read the working tag_browse resource.json as template
with open(base + r"\tag_browse\resource.json") as f:
    template = json.load(f)

print("Working template:")
print(json.dumps(template, indent=2))

# Read current script_exec resource.json
with open(base + r"\script_exec\resource.json") as f:
    current = json.load(f)

print("\nCurrent script_exec:")
print(json.dumps(current, indent=2))

# Copy the exact template format for script_exec, just update the signature
import hashlib
h = hashlib.sha256(open(base + r"\script_exec\doGet.py", "rb").read()).hexdigest()

fixed = {
    "scope": "G",
    "version": 1,
    "restricted": False,
    "overridable": True,
    "files": template["files"],  # same file list
    "attributes": {
        "lastModificationSignature": h,
        "lastModification": {
            "actor": "copilot-ai",
            "timestamp": "2026-03-05T01:55:00Z"
        }
    }
}

with open(base + r"\script_exec\resource.json", "w") as f:
    json.dump(fixed, f)

print("\nFixed resource.json:")
print(json.dumps(fixed, indent=2))
