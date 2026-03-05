import json, os

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

for ep in os.listdir(base):
    ep_dir = os.path.join(base, ep)
    if not os.path.isdir(ep_dir):
        continue
    dopost = os.path.join(ep_dir, "doPost.py")
    doget = os.path.join(ep_dir, "doGet.py")
    res = os.path.join(ep_dir, "resource.json")
    
    post_size = os.path.getsize(dopost) if os.path.exists(dopost) else -1
    get_size = os.path.getsize(doget) if os.path.exists(doget) else -1
    
    scope = "?"
    if os.path.exists(res):
        with open(res) as f:
            r = json.load(f)
        scope = r.get("scope", "?")
    
    print(f"{ep:20s} doPost.py={post_size:5d}  doGet.py={get_size:5d}  scope={scope}")
