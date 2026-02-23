"""
Ignition MCP Server Tools Package
"""

from .tag_operations import create_tag_tools, handle_tag_operation, TOOL_NAMES as TAG_TOOLS
from .historian import create_historian_tools, handle_historian_operation, TOOL_NAMES as HISTORIAN_TOOLS
from .alarms import create_alarm_tools, handle_alarm_operation, TOOL_NAMES as ALARM_TOOLS
from .diagnostics import create_diagnostic_tools, handle_diagnostic_operation, TOOL_NAMES as DIAGNOSTIC_TOOLS

ALL_TOOL_NAMES = {
    'tag': TAG_TOOLS,
    'historian': HISTORIAN_TOOLS,
    'alarm': ALARM_TOOLS,
    'diagnostic': DIAGNOSTIC_TOOLS,
}

__all__ = [
    'create_tag_tools', 'handle_tag_operation', 'TAG_TOOLS',
    'create_historian_tools', 'handle_historian_operation', 'HISTORIAN_TOOLS',
    'create_alarm_tools', 'handle_alarm_operation', 'ALARM_TOOLS',
    'create_diagnostic_tools', 'handle_diagnostic_operation', 'DIAGNOSTIC_TOOLS',
    'ALL_TOOL_NAMES',
]
