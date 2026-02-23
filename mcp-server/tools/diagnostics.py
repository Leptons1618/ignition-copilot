"""
MCP Tools — System Diagnostics & Utilities
Generic: no hardcoded tag paths.
"""

from typing import List, Dict, Any
from ignition_client import IgnitionClient


TOOL_NAMES = [
    'get_system_info', 'diagnose_tag_health', 'execute_expression',
]


def create_diagnostic_tools(client: IgnitionClient, config: Dict[str, Any]) -> List[Dict]:
    """Return MCP tool definitions for diagnostics / system utilities."""
    return [
        {
            "name": "get_system_info",
            "description": "Get Ignition Gateway system information: version, uptime, CPU, memory, tag providers.",
            "inputSchema": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "diagnose_tag_health",
            "description": "Check the health of all tags under a given path. Reports tags with bad quality or errors.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Root path to check (e.g. '[default]MyPlant/Area1')"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "Check sub-folders too",
                        "default": True
                    }
                },
                "required": ["path"]
            }
        },
        {
            "name": "execute_expression",
            "description": "Evaluate a tag expression on the Ignition gateway. For advanced/dev use only.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "expression": {
                        "type": "string",
                        "description": "Tag path or expression to evaluate"
                    }
                },
                "required": ["expression"]
            }
        },
    ]


def handle_diagnostic_operation(tool_name: str, arguments: Dict[str, Any],
                                 client: IgnitionClient, config: Dict[str, Any]) -> Any:
    """Route and execute diagnostic tool calls."""

    if tool_name == "get_system_info":
        info = client.get_system_info()
        return info

    elif tool_name == "diagnose_tag_health":
        path = arguments['path']
        recursive = arguments.get('recursive', True)

        # Browse to find all atomic tags
        tags = client.browse_tags(path, recursive=recursive)
        atomic_tags = [t for t in tags if t.get('tagType') == 'AtomicTag']

        if not atomic_tags:
            return {"path": path, "message": "No atomic tags found", "total": 0}

        # Read all atomic tags
        tag_paths = [t['path'] for t in atomic_tags]

        # Read in batches of 50
        all_results = []
        for i in range(0, len(tag_paths), 50):
            batch = tag_paths[i:i+50]
            try:
                results = client.read_tags(batch)
                all_results.extend(results)
            except Exception as e:
                for p in batch:
                    all_results.append({'path': p, 'value': None, 'quality': 'Error', 'error': str(e)})

        healthy = []
        unhealthy = []
        for r in all_results:
            q = str(r.get('quality', '')).lower()
            if 'good' in q:
                healthy.append(r['path'])
            else:
                unhealthy.append({
                    'path': r.get('path', '?'),
                    'quality': r.get('quality', 'Unknown'),
                    'error': r.get('error', '')
                })

        return {
            "path": path,
            "total_tags": len(all_results),
            "healthy": len(healthy),
            "unhealthy_count": len(unhealthy),
            "unhealthy_tags": unhealthy[:50],  # cap for display
        }

    elif tool_name == "execute_expression":
        result = client.execute_expression(arguments['expression'])
        return {"expression": arguments['expression'], "result": result}

    return {"error": f"Unknown diagnostic tool: {tool_name}"}
