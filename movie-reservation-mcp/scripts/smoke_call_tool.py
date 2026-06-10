from __future__ import annotations

import asyncio
import os


async def main() -> None:
    try:
        from fastmcp import Client
    except Exception as exception:
        raise RuntimeError("fastmcp is required for this smoke check") from exception

    mcp_url = os.getenv("MOVIE_RESERVATION_MCP_URL", "http://127.0.0.1:8091/mcp")

    async with Client(mcp_url) as client:
        tools = await client.list_tools()
        print("tools:", [tool.name for tool in tools])

        result = await client.call_tool(
            "movie_list_movies",
            {
                "limit": 2,
                "correlation_id": "mcp-smoke-correlation",
                "request_id": "mcp-smoke-request",
            },
        )
        print(result)


if __name__ == "__main__":
    asyncio.run(main())
