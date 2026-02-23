"""
MCP Tools — Alarm Management
Generic: works with any alarm source, any priority filter.
"""

from typing import List, Dict, Any
from ignition_client import IgnitionClient


TOOL_NAMES = [
    'get_active_alarms', 'query_alarm_journal',
]


def create_alarm_tools(client: IgnitionClient, config: Dict[str, Any]) -> List[Dict]:
    """Return MCP tool definitions for alarm operations."""
    return [
        {
            "name": "get_active_alarms",
            "description": "Get all currently active alarms. Optionally filter by source path, priority, or state.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "source": {
                        "type": "string",
                        "description": "Filter alarms whose source contains this string (e.g. 'MotorM12'). Empty = all.",
                        "default": ""
                    },
                    "priority": {
                        "type": "string",
                        "description": "Filter by priority: Critical, High, Medium, Low. Empty = all.",
                        "default": ""
                    },
                    "state": {
                        "type": "string",
                        "description": "Filter by state: ActiveUnacked, ActiveAcked, ClearUnacked. Empty = all.",
                        "default": ""
                    }
                }
            }
        },
        {
            "name": "query_alarm_journal",
            "description": "Query alarm history / journal. Returns past alarm events within a time range.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "start_time": {
                        "type": "string",
                        "description": "Start time — relative (-24h, -7d) or ISO. Default: -24h",
                        "default": "-24h"
                    },
                    "source": {
                        "type": "string",
                        "description": "Filter by source pattern. Default: * (all)",
                        "default": "*"
                    },
                    "priority": {
                        "type": "string",
                        "description": "Filter by priority. Empty = all.",
                        "default": ""
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum events to return (default 500)",
                        "default": 500
                    }
                }
            }
        },
    ]


def handle_alarm_operation(tool_name: str, arguments: Dict[str, Any],
                           client: IgnitionClient, config: Dict[str, Any]) -> Any:
    """Route and execute alarm tool calls."""

    if tool_name == "get_active_alarms":
        alarms = client.get_active_alarms(
            source=arguments.get('source', ''),
            priority=arguments.get('priority', ''),
            state=arguments.get('state', '')
        )
        return {"alarm_count": len(alarms), "alarms": alarms}

    elif tool_name == "query_alarm_journal":
        events = client.query_alarm_journal(
            start_time=arguments.get('start_time', '-24h'),
            source=arguments.get('source', '*'),
            priority=arguments.get('priority', ''),
            max_results=arguments.get('max_results', 500)
        )
        return {"event_count": len(events), "events": events}

    return {"error": f"Unknown alarm tool: {tool_name}"}
