import asyncio

from fastmcp import Client

from movie_reservation_mcp.config import Settings
from movie_reservation_mcp.server import create_mcp_server


def test_registers_expected_movie_tools() -> None:
    settings = Settings(
        service_name="movie-reservation-mcp-test",
        host="127.0.0.1",
        port=8091,
        mcp_path="/mcp",
        mcp_transport="http",
        graphql_url="http://movie-api.test/graphql",
        auth_token="test-token",
        request_timeout_seconds=1.0,
    )

    async def list_tool_names() -> list[str]:
        async with Client(create_mcp_server(settings)) as client:
            return sorted(tool.name for tool in await client.list_tools())

    assert asyncio.run(list_tool_names()) == [
        "movie_get_reservation_result",
        "movie_get_reservation_status",
        "movie_list_movies",
        "movie_list_screenings",
        "movie_me",
        "movie_request_reservation",
    ]
