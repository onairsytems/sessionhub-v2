import { LanguageTemplate } from '../types';

export class PythonTemplate implements LanguageTemplate {
  language = 'python' as const;
  fileExtension = 'py';
  buildCommand = 'pip install -r requirements.txt';
  runCommand = 'python -m mcp_server';

  serverTemplate = `#!/usr/bin/env python3
"""
{{name}} MCP Server
{{description}}
"""

import asyncio
import json
import sys
from typing import Any, Dict

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, ToolResult

# Import tool handlers
{{#tools}}
from tools.{{name}} import handle_{{name}}
{{/tools}}

# Initialize server
server = Server("{{name}}")

# Define available tools
TOOLS = [
    {{#tools}}
    Tool(
        name="{{name}}",
        description="{{description}}",
        inputSchema={{json.dumps(inputSchema)}}
    ),
    {{/tools}}
]

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List all available tools."""
    return TOOLS

@server.call_tool()
async def handle_call_tool(name: str, arguments: Dict[str, Any]) -> list[TextContent]:
    """Handle tool execution requests."""
    try:
        {{#tools}}
        if name == "{{name}}":
            result = await handle_{{name}}(arguments)
            return [TextContent(type="text", text=result)]
        {{/tools}}
        
        raise ValueError(f"Unknown tool: {name}")
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {str(e)}")]

async def main():
    """Main entry point for the MCP server."""
    # Run the server using stdio transport
    async with stdio_server() as (read_stream, write_stream):
        init_options = InitializationOptions(
            server_name="{{name}}",
            server_version="{{version}}"
        )
        
        await server.run(
            read_stream,
            write_stream,
            init_options,
            NotificationOptions()
        )

if __name__ == "__main__":
    asyncio.run(main())
`;

  toolTemplate = `"""
{{tool.name}} tool implementation
"""

from typing import Any, Dict


async def handle_{{tool.name}}(arguments: Dict[str, Any]) -> str:
    """
    Handle {{tool.name}} tool execution.
    
    Args:
        arguments: Tool arguments
        
    Returns:
        Result string
    """
    try:
        # TODO: Implement {{tool.name}} tool logic
        
        return "{{tool.name}} executed successfully"
    except Exception as e:
        raise ValueError(f"Failed to execute {{tool.name}}: {str(e)}")
`;

  testTemplate = `"""
Tests for {{tool.name}} tool
"""

import pytest
from tools.{{tool.name}} import handle_{{tool.name}}


@pytest.mark.asyncio
async def test_{{tool.name}}_success():
    """Test successful execution of {{tool.name}}."""
    args = {
        # TODO: Add test arguments
    }
    
    result = await handle_{{tool.name}}(args)
    
    assert result is not None
    assert "successfully" in result


@pytest.mark.asyncio
async def test_{{tool.name}}_error():
    """Test error handling in {{tool.name}}."""
    args = {
        # Invalid arguments
    }
    
    with pytest.raises(ValueError):
        await handle_{{tool.name}}(args)
`;

  configTemplate = `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "tools": {{json.dumps(tools, indent=2)}},
  "integrations": {{json.dumps(integrations, indent=2)}}
}
`;

  packageTemplate = `mcp>=0.1.0
pydantic>=2.0.0
typing-extensions>=4.0.0

# Add your project-specific dependencies below
`;
}