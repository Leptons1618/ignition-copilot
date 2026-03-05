import json, hashlib, os

base = r"C:\Program Files\Inductive Automation\Ignition\data\projects\ignition-copilot\com.inductiveautomation.webdev\resources"

for ep in ["tag_browse", "script_exec"]:
    ep_dir = os.path.join(base, ep)
    res_path = os.path.join(ep_dir, "resource.json")
    
    with open(res_path) as f:
        res = json.load(f)
    
    stored_sig = res["attributes"]["lastModificationSignature"]
    
    # Try computing hash of all files combined
    files = res["files"]
    combined = b""
    individual_hashes = {}
    for fname in sorted(files):
        fpath = os.path.join(ep_dir, fname)
        if os.path.exists(fpath):
            data = open(fpath, "rb").read()
            combined += data
            individual_hashes[fname] = hashlib.sha256(data).hexdigest()
    
    combined_hash = hashlib.sha256(combined).hexdigest()
    
    print(f"\n=== {ep} ===")
    print(f"Stored signature:  {stored_sig}")
    print(f"Combined hash:     {combined_hash}")
    print(f"Match: {stored_sig == combined_hash}")
    
    # Also try hash of just doGet.py (since that's what we computed)
    doget_hash = individual_hashes.get("doGet.py", "N/A")
    print(f"doGet.py hash:     {doget_hash}")
    print(f"doGet match:       {stored_sig == doget_hash}")
    
    # Try concat of individual hashes
    hash_of_hashes = hashlib.sha256("".join(individual_hashes.get(f, "") for f in sorted(files)).encode()).hexdigest()
    print(f"Hash of hashes:    {hash_of_hashes}")
    print(f"HoH match:         {stored_sig == hash_of_hashes}")
