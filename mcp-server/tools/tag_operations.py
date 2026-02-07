"""
MCP Tools — Tag Operations
Generic: works with any tag provider, any tag structure.
"""

from typing import List, Dict, Any
from ignition_client import IgnitionClient


TOOL_NAMES = [
    'browse_tags', 'read_tag', 'read_tags',
    'write_tag', 'write_tags',
    'search_tags', 'get_tag_config', 'create_tag', 'delete_tags',
]


def create_tag_tools(client: IgnitionClient, config: Dict[str, Any]) -> List[Dict]:
    """Return MCP tool definitions for tag operations."""
    return [
        {
            "name": "browse_tags",
            "description": "Browse tags and folders at a given path. Returns child tags with type, path, and whether they have children.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Tag path to browse (e.g. '[default]', '[default]MyFolder'). Defaults to the configured default provider.",
                        "default": "[default]"
                    },
                    "recursive": {
                        "type": "boolean",
                        "description": "If true, browse recursively into sub-folders.",
                        "default": False
                    }
                }
            }
        },
        {
            "name": "read_tag",
            "description": "Read the current value of a single Ignition tag. Returns value, quality, and timestamp.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_path": {
                        "type": "string",
                        "description": "Full tag path (e.g. '[default]MyFolder/Temperature')"
                    }
                },
                "required": ["tag_path"]
            }
        },
        {
            "name": "read_tags",
            "description": "Read current values of multiple Ignition tags in one request.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of full tag paths to read"
                    }
                },
                "required": ["tag_paths"]
            }
        },
        {
            "name": "write_tag",
            "description": "Write a value to a single Ignition tag.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_path": {
                        "type": "string",
                        "description": "Full tag path to write to"
                    },
                    "value": {
                        "description": "Value to write (number, string, or boolean)"
                    }
                },
                "required": ["tag_path", "value"]
            }
        },
        {
            "name": "write_tags",
            "description": "Write values to multiple Ignition tags in one request.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of full tag paths"
                    },
                    "values": {
                        "type": "array",
                        "description": "Corresponding list of values to write"
                    }
                },
                "required": ["tag_paths", "values"]
            }
        },
        {
            "name": "search_tags",
            "description": "Search for tags by name pattern. Supports glob-style wildcards (* and ?).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Search pattern (e.g. '*Temp*', 'Motor??')",
                        "default": "*"
                    },
                    "root": {
                        "type": "string",
                        "description": "Root path to search under",
                        "default": "[default]"
                    },
                    "tag_type": {
                        "type": "string",
                        "description": "Filter by tag type: AtomicTag, Folder, UdtInstance, etc. Empty = all.",
                        "default": ""
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum results to return",
                        "default": 200
                    }
                }
            }
        },
        {
            "name": "get_tag_config",
            "description": "Get configuration properties of a tag (data type, value source, engineering units, etc.).",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_path": {
                        "type": "string",
                        "description": "Full tag path"
                    }
                },
                "required": ["tag_path"]
            }
        },
        {
            "name": "create_tag",
            "description": "Create a new tag in Ignition.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "base_path": {
                        "type": "string",
                        "description": "Parent folder path (e.g. '[default]MyFolder')"
                    },
                    "name": {
                        "type": "string",
                        "description": "New tag name"
                    },
                    "tag_type": {
                        "type": "string",
                        "description": "Tag type: AtomicTag, Folder, UdtInstance",
                        "default": "AtomicTag"
                    },
                    "data_type": {
                        "type": "string",
                        "description": "Data type: Float8, Float4, Int4, Int2, Boolean, String, DateTime",
                        "default": "Float8"
                    },
                    "value": {
                        "description": "Initial value",
                        "default": 0
                    }
                },
                "required": ["base_path", "name"]
            }
        },
        {
            "name": "delete_tags",
            "description": "Delete one or more tags from Ignition.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of full tag paths to delete"
                    }
                },
                "required": ["paths"]
            }
        },
    ]


def handle_tag_operation(tool_name: str, arguments: Dict[str, Any],
                         client: IgnitionClient, config: Dict[str, Any]) -> Any:
    """Route and execute tag tool calls."""

    if tool_name == "browse_tags":
        path = arguments.get('path', '[default]')
        recursive = arguments.get('recursive', False)
        tags = client.browse_tags(path, recursive)
        return {"tags": tags, "count": len(tags), "path": path}

    elif tool_name == "read_tag":
        result = client.read_tag(arguments['tag_path'])
        return result

    elif tool_name == "read_tags":
        results = client.read_tags(arguments['tag_paths'])
        return {"results": results, "count": len(results)}

    elif tool_name == "write_tag":
        result = client.write_tag(arguments['tag_path'], arguments['value'])
        return result

    elif tool_name == "write_tags":
        results = client.write_tags(arguments['tag_paths'], arguments['values'])
        return {"results": results, "count": len(results)}

    elif tool_name == "search_tags":
        matches = client.search_tags(
            pattern=arguments.get('pattern', '*'),
            root=arguments.get('root', '[default]'),
            tag_type=arguments.get('tag_type', ''),
            max_results=arguments.get('max_results', 200)
        )
        return {"matches": matches, "count": len(matches)}

    elif tool_name == "get_tag_config":
        cfg = client.get_tag_config(arguments['tag_path'])
        return {"path": arguments['tag_path'], "config": cfg}

    elif tool_name == "create_tag":
        result = client.create_tag(
            base_path=arguments['base_path'],
            name=arguments['name'],
            tag_type=arguments.get('tag_type', 'AtomicTag'),
            data_type=arguments.get('data_type', 'Float8'),
            value=arguments.get('value', 0)
        )
        return result

    elif tool_name == "delete_tags":
        results = client.delete_tags(arguments['paths'])
        return {"results": results, "count": len(results)}

    return {"error": f"Unknown tag tool: {tool_name}"}
