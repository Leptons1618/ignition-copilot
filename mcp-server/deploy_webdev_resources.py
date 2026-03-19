#!/usr/bin/env python3
"""Deploy generated WebDev endpoint scripts into a local Ignition project.

This helper targets filesystem-based Ignition project resources and updates
`doGet.py` / `doPost.py` files in place, with timestamped backups.
"""

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

ENDPOINT_METHODS = {
    "tag_browse": ["doGet.py"],
    "tag_read": ["doGet.py"],
    "tag_write": ["doPost.py"],
    "tag_search": ["doGet.py"],
    "tag_config": ["doGet.py", "doPost.py"],
    "tag_delete": ["doPost.py"],
    "history_query": ["doPost.py"],
    "alarm_active": ["doGet.py"],
    "alarm_journal": ["doPost.py"],
    "system_info": ["doGet.py"],
    "script_exec": ["doPost.py"],
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy generated WebDev resources")
    parser.add_argument(
        "--project",
        default="IGNITION_COPILOT",
        help="Ignition project folder name under the project root.",
    )
    parser.add_argument(
        "--project-root",
        default="/usr/local/bin/ignition/data/projects",
        help="Root directory containing Ignition projects.",
    )
    parser.add_argument(
        "--source-dir",
        default="mcp-server/ignition-automation/webdev-resources",
        help="Directory containing generated endpoint *.py files.",
    )
    return parser.parse_args()


def backup_file(path: Path) -> None:
    if not path.exists():
        return
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = path.with_suffix(path.suffix + f".{timestamp}.bak")
    shutil.copy2(path, backup)


def extract_method_body(script_text: str, method_name: str) -> str:
    """Extract and dedent a doGet/doPost function body for method file deployment."""
    lines = script_text.splitlines()
    signature = f"def {method_name}(request, session):"
    start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith(signature):
            start = i
            break

    if start < 0:
        raise ValueError(f"Method signature not found: {signature}")

    body_lines = []
    for line in lines[start + 1 :]:
        if line.strip().startswith("def ") and not line.startswith((" ", "\t")):
            break

        if not line.strip():
            body_lines.append("")
            continue

        if line.startswith("\t"):
            body_lines.append(line[1:])
        elif line.startswith("    "):
            body_lines.append(line[4:])
        else:
            # End of the method body.
            break

    if not body_lines:
        raise ValueError(f"No body extracted for method: {method_name}")

    return "\n".join(body_lines).rstrip() + "\n"


def extract_method_function(script_text: str, method_name: str) -> str:
    """Extract a complete `def doX(request, session):` function block."""
    lines = script_text.splitlines()
    signature = f"def {method_name}(request, session):"
    start = -1
    for i, line in enumerate(lines):
        if line.strip().startswith(signature):
            start = i
            break

    if start < 0:
        raise ValueError(f"Method signature not found: {signature}")

    fn_lines = [lines[start]]
    for line in lines[start + 1 :]:
        if line.strip().startswith("def ") and not line.startswith((" ", "\t")):
            break
        fn_lines.append(line)

    return "\n".join(fn_lines).rstrip() + "\n"


def enable_required_method(endpoint_dir: Path, method_name: str) -> None:
    """Enable doGet/doPost flag in resource config.json."""
    cfg_path = endpoint_dir / "config.json"
    if not cfg_path.exists():
        return

    data = json.loads(cfg_path.read_text(encoding="utf-8"))
    method_cfg = data.setdefault(method_name, {})
    method_cfg["enabled"] = True
    cfg_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()

    source_dir = Path(args.source_dir)
    if not source_dir.exists():
        raise FileNotFoundError(f"Source directory not found: {source_dir}")

    resources_dir = (
        Path(args.project_root)
        / args.project
        / "com.inductiveautomation.webdev"
        / "resources"
    )
    if not resources_dir.exists():
        raise FileNotFoundError(f"WebDev resources directory not found: {resources_dir}")

    # Project may have mistakenly named `tag_browser` resource; normalize to expected endpoint.
    tag_browser = resources_dir / "tag_browser"
    tag_browse = resources_dir / "tag_browse"
    if tag_browser.exists() and not tag_browse.exists():
        tag_browser.rename(tag_browse)
        print(f"Renamed resource folder: {tag_browser.name} -> {tag_browse.name}")

    deployed = 0
    for endpoint, method_files in ENDPOINT_METHODS.items():
        src_file = source_dir / f"{endpoint}.py"
        if not src_file.exists():
            raise FileNotFoundError(f"Generated source script missing: {src_file}")

        endpoint_dir = resources_dir / endpoint
        if not endpoint_dir.exists():
            raise FileNotFoundError(
                f"Endpoint resource directory missing: {endpoint_dir}\n"
                f"Create it once in Designer, then rerun deploy."
            )

        content = src_file.read_text(encoding="utf-8")
        for method_file in method_files:
            dest = endpoint_dir / method_file
            method_name = method_file.replace(".py", "")
            deployed_body = extract_method_function(content, method_name)
            backup_file(dest)
            dest.write_text(deployed_body, encoding="utf-8")
            enable_required_method(endpoint_dir, method_name)
            deployed += 1
            print(f"Updated {dest}")

    print(f"Deployment complete. Updated {deployed} method script files.")
    print("Next: save/publish project in Designer or Gateway, then run mcp-server/test_endpoints.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
