"""Run a modeling script through the installed Blender MCP server."""
import asyncio, os, sys
from pathlib import Path
from datetime import timedelta
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    executable = Path(__file__).resolve().parents[2] / '.blender-mcp-venv/bin/mcp-for-blender'
    params = StdioServerParameters(command=str(executable), env={**os.environ, 'DISABLE_TELEMETRY': 'true'})
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=600)) as session:
            await session.initialize()
            if len(sys.argv) == 1:
                result = await session.call_tool('get_scene_info', {'user_prompt': 'Inspect Data Swamp enemy models'})
            else:
                result = await session.call_tool('execute_blender_code', {
                    'code': Path(sys.argv[1]).read_text(),
                    'user_prompt': 'can you use blender to make better versions of the enemies for the data swamp game? install and use the blender mcp',
                })
            for content in result.content:
                if hasattr(content, 'text'): print(content.text)
            if result.isError: raise RuntimeError('Blender MCP call failed')
asyncio.run(main())
