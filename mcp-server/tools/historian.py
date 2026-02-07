"""
MCP Tools — Historian Queries
Generic: works with any tag path, any time range.
"""

from typing import List, Dict, Any
from ignition_client import IgnitionClient


TOOL_NAMES = [
    'query_history', 'analyze_trend', 'compare_tags',
]


def create_historian_tools(client: IgnitionClient, config: Dict[str, Any]) -> List[Dict]:
    """Return MCP tool definitions for historian operations."""
    return [
        {
            "name": "query_history",
            "description": "Query historical data for one or more tags. Supports ISO timestamps or relative times like '-1h', '-30m', '-2d'.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Full tag paths to query history for"
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start time — ISO (2026-02-08T00:00:00) or relative (-1h, -30m, -2d). Default: -1h",
                        "default": "-1h"
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End time — ISO or relative. Default: now (empty string).",
                        "default": ""
                    },
                    "return_size": {
                        "type": "integer",
                        "description": "Max data points per tag (default 500)",
                        "default": 500
                    }
                },
                "required": ["tag_paths"]
            }
        },
        {
            "name": "analyze_trend",
            "description": "Analyze the trend of a tag over a time range. Returns min, max, average, standard deviation, and trend direction.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_path": {
                        "type": "string",
                        "description": "Full tag path to analyze"
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start of analysis window (default: -1h)",
                        "default": "-1h"
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End of analysis window (default: now)",
                        "default": ""
                    }
                },
                "required": ["tag_path"]
            }
        },
        {
            "name": "compare_tags",
            "description": "Compare historical trends of multiple tags over the same time range. Shows statistics and trend direction for each.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "tag_paths": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Full tag paths to compare"
                    },
                    "start_time": {
                        "type": "string",
                        "description": "Start time (default: -1h)",
                        "default": "-1h"
                    },
                    "end_time": {
                        "type": "string",
                        "description": "End time (default: now)",
                        "default": ""
                    }
                },
                "required": ["tag_paths"]
            }
        },
    ]


def _compute_stats(values: List[float]) -> Dict[str, Any]:
    """Compute basic statistics on a list of numeric values."""
    if not values:
        return {"error": "No data"}
    n = len(values)
    avg = sum(values) / n
    mn, mx = min(values), max(values)
    variance = sum((v - avg) ** 2 for v in values) / max(n - 1, 1)
    stddev = variance ** 0.5

    # Trend: compare first-half average vs second-half average
    mid = n // 2
    if mid > 0:
        first_avg = sum(values[:mid]) / mid
        second_avg = sum(values[mid:]) / (n - mid)
        trend_dir = "increasing" if second_avg > first_avg + 0.01 else (
            "decreasing" if second_avg < first_avg - 0.01 else "stable"
        )
        trend_magnitude = abs(second_avg - first_avg)
    else:
        trend_dir = "insufficient_data"
        trend_magnitude = 0

    return {
        "min": round(mn, 4),
        "max": round(mx, 4),
        "average": round(avg, 4),
        "range": round(mx - mn, 4),
        "stddev": round(stddev, 4),
        "sample_count": n,
        "trend_direction": trend_dir,
        "trend_magnitude": round(trend_magnitude, 4),
    }


def handle_historian_operation(tool_name: str, arguments: Dict[str, Any],
                                client: IgnitionClient, config: Dict[str, Any]) -> Any:
    """Route and execute historian tool calls."""

    if tool_name == "query_history":
        tag_paths = arguments['tag_paths']
        start = arguments.get('start_time', '-1h')
        end = arguments.get('end_time', '')
        size = arguments.get('return_size', 500)

        raw = client.query_history(tag_paths, start_time=start, end_time=end, return_size=size)

        # raw is { tag_path: { records: [...], count: N }, ... }
        result = {"query": {"start": start, "end": end or "now", "return_size": size}, "data": {}}
        for tp, info in raw.items():
            records = info.get('records', [])
            result["data"][tp] = {
                "record_count": info.get('count', len(records)),
                "sample": records[:100]  # cap for display
            }
        return result

    elif tool_name == "analyze_trend":
        tag_path = arguments['tag_path']
        start = arguments.get('start_time', '-1h')
        end = arguments.get('end_time', '')

        raw = client.query_history([tag_path], start_time=start, end_time=end, return_size=10000)
        info = raw.get(tag_path, {})
        records = info.get('records', [])
        values = [r['value'] for r in records if r.get('value') is not None and isinstance(r['value'], (int, float))]

        if not values:
            return {"tag_path": tag_path, "error": "No numeric historical data found"}

        stats = _compute_stats(values)
        return {
            "tag_path": tag_path,
            "time_range": {"start": start, "end": end or "now"},
            "statistics": stats,
        }

    elif tool_name == "compare_tags":
        tag_paths = arguments['tag_paths']
        start = arguments.get('start_time', '-1h')
        end = arguments.get('end_time', '')

        raw = client.query_history(tag_paths, start_time=start, end_time=end, return_size=10000)

        comparisons = {}
        for tp, info in raw.items():
            records = info.get('records', [])
            values = [r['value'] for r in records if r.get('value') is not None and isinstance(r['value'], (int, float))]
            comparisons[tp] = _compute_stats(values)

        return {
            "time_range": {"start": start, "end": end or "now"},
            "comparisons": comparisons,
            "tag_count": len(comparisons),
        }

    return {"error": f"Unknown historian tool: {tool_name}"}
