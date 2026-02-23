#!/usr/bin/env python3
"""
Ignition MCP Server
Provides Model Context Protocol interface to Ignition SCADA system.
Generic — no hardcoded tag paths. All tool routing driven by TOOL_NAMES lists.
"""

import sys
import json
import logging
from typing import Any, Dict, List
from pathlib import Path

# MCP SDK imports
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Local imports
from ignition_client import IgnitionClient
from tools.tag_operations import create_tag_tools, handle_tag_operation, TOOL_NAMES as TAG_TOOLS
from tools.historian import create_historian_tools, handle_historian_operation, TOOL_NAMES as HISTORIAN_TOOLS
from tools.alarms import create_alarm_tools, handle_alarm_operation, TOOL_NAMES as ALARM_TOOLS
from tools.diagnostics import create_diagnostic_tools, handle_diagnostic_operation, TOOL_NAMES as DIAGNOSTIC_TOOLS
from tools.project_indexer import create_indexing_tools, handle_indexing_operation, TOOL_NAMES as INDEXING_TOOLS
from tools.view_manipulation import create_view_tools, handle_view_operation, TOOL_NAMES as VIEW_TOOLS


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ignition_mcp.log'),
        logging.StreamHandler(sys.stderr)
    ]
)
logger = logging.getLogger('ignition-mcp')


# Build a name → (handler, category) dispatch table
_DISPATCH = {}
for name in TAG_TOOLS:
    _DISPATCH[name] = handle_tag_operation
for name in HISTORIAN_TOOLS:
    _DISPATCH[name] = handle_historian_operation
for name in ALARM_TOOLS:
    _DISPATCH[name] = handle_alarm_operation
for name in DIAGNOSTIC_TOOLS:
    _DISPATCH[name] = handle_diagnostic_operation
for name in INDEXING_TOOLS:
    _DISPATCH[name] = handle_indexing_operation
for name in VIEW_TOOLS:
    _DISPATCH[name] = handle_view_operation


class IgnitionMCPServer:
    """MCP Server for Ignition SCADA"""

    def __init__(self, config_path: str = 'config.json'):
        logger.info("Initializing Ignition MCP Server")

        # Load configuration
        with open(config_path, 'r') as f:
            self.config = json.load(f)

        # Initialize Ignition client
        ig = self.config['ignition']
        self.client = IgnitionClient(
            gateway_url=ig['gateway_url'],
            username=ig['username'],
            password=ig['password'],
            verify_ssl=ig.get('verify_ssl', False),
            timeout=ig.get('timeout', 30),
            project=ig.get('project', 'ignition-copilot'),
        )

        # Test connection
        if self.client.test_connection():
            logger.info(f"Connected to Ignition Gateway at {ig['gateway_url']}")
        else:
            logger.error("Failed to connect to Ignition Gateway")
            raise ConnectionError("Cannot connect to Ignition Gateway")

        # Initialize MCP server
        self.server = Server(self.config['mcp']['server_name'])

        # Collect all tool definitions
        self.tools: List[Dict] = []
        self.tools.extend(create_tag_tools(self.client, self.config))
        self.tools.extend(create_historian_tools(self.client, self.config))
        self.tools.extend(create_alarm_tools(self.client, self.config))
        self.tools.extend(create_diagnostic_tools(self.client, self.config))
        self.tools.extend(create_indexing_tools(self.client, self.config))
        self.tools.extend(create_view_tools(self.client, self.config))

        logger.info(f"Loaded {len(self.tools)} MCP tools: {[t['name'] for t in self.tools]}")

        self._register_handlers()

    def _register_handlers(self):
        """Register MCP protocol handlers."""

        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            return [
                Tool(name=t['name'], description=t['description'], inputSchema=t['inputSchema'])
                for t in self.tools
            ]

        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            logger.info(f"Tool call: {name}  args={arguments}")
            try:
                handler = _DISPATCH.get(name)
                if handler is None:
                    result = {"error": f"Unknown tool: {name}"}
                else:
                    result = handler(name, arguments, self.client, self.config)

                text = json.dumps(result, indent=2, default=str)
                logger.debug(f"Result: {text[:500]}")
                return [TextContent(type="text", text=text)]

            except Exception as e:
                logger.error(f"Error in tool {name}: {e}", exc_info=True)
                err = {"error": str(e), "tool": name, "arguments": arguments}
                return [TextContent(type="text", text=json.dumps(err, indent=2))]

    async def run(self):
        logger.info("Starting MCP server on stdio")
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream, write_stream,
                self.server.create_initialization_options()
            )


def main():
    try:
        config_path = Path(__file__).parent / 'config.json'
        if not config_path.exists():
            logger.error(f"Config not found: {config_path}")
            sys.exit(1)

        server = IgnitionMCPServer(str(config_path))
        logger.info("Ignition MCP Server ready")

        import asyncio
        asyncio.run(server.run())

    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
