from __future__ import annotations

from collections.abc import Awaitable, Callable
import time
from typing import Any, TypeVar

from movie_reservation_mcp.config import Settings, load_settings
from movie_reservation_mcp.graphql_client import (
    GraphqlClientError,
    MovieReservationGraphqlClient,
    PropagationContext,
)
from movie_reservation_mcp.logging import configure_logging, log_event
from movie_reservation_mcp.telemetry import (
    configure_telemetry,
    get_tracer,
    mark_span_error,
)

ToolResult = TypeVar("ToolResult")


def create_mcp_server(settings: Settings | None = None) -> Any:
    try:
        from fastmcp import FastMCP
    except Exception as exception:
        raise RuntimeError(
            "fastmcp is required to run the movie reservation MCP server",
        ) from exception

    resolved_settings = settings if settings is not None else load_settings()
    mcp = FastMCP("Movie Reservation MCP")
    tracer = get_tracer("movie_reservation_mcp.server")

    @mcp.tool
    async def movie_me(
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> dict[str, Any]:
        """Return authenticated movie reservation demo user context."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_me",
            context=context,
            operation=lambda client: client.me(context),
        )

    @mcp.tool
    async def movie_list_movies(
        limit: int | None = None,
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> list[dict[str, Any]]:
        """List movies available to the authenticated demo user."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_list_movies",
            context=context,
            operation=lambda client: client.list_movies(
                limit=limit,
                context=context,
            ),
        )

    @mcp.tool
    async def movie_list_screenings(
        movie_id: str | None = None,
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> list[dict[str, Any]]:
        """List screenings, optionally filtered by movie id."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_list_screenings",
            context=context,
            operation=lambda client: client.list_screenings(
                movie_id=movie_id,
                context=context,
            ),
        )

    @mcp.tool
    async def movie_request_reservation(
        screening_id: str,
        seat_ids: list[str],
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> dict[str, Any]:
        """Create an asynchronous reservation request for one screening."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_request_reservation",
            context=context,
            operation=lambda client: client.request_reservation(
                screening_id=screening_id,
                seat_ids=seat_ids,
                context=context,
            ),
        )

    @mcp.tool
    async def movie_get_reservation_status(
        reservation_request_id: str,
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> dict[str, Any] | None:
        """Poll the current processing status for a reservation request."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_get_reservation_status",
            context=context,
            operation=lambda client: client.reservation_status(
                reservation_request_id=reservation_request_id,
                context=context,
            ),
        )

    @mcp.tool
    async def movie_get_reservation_result(
        reservation_request_id: str,
        traceparent: str | None = None,
        tracestate: str | None = None,
        correlation_id: str | None = None,
        request_id: str | None = None,
        demo_fault: str | None = None,
    ) -> dict[str, Any] | None:
        """Fetch the confirmed reservation produced by a request."""

        context = build_context(
            traceparent=traceparent,
            tracestate=tracestate,
            correlation_id=correlation_id,
            request_id=request_id,
            demo_fault=demo_fault,
        )
        return await run_tool(
            settings=resolved_settings,
            tracer=tracer,
            tool_name="movie_get_reservation_result",
            context=context,
            operation=lambda client: client.reservation_result(
                reservation_request_id=reservation_request_id,
                context=context,
            ),
        )

    register_health_route(mcp, resolved_settings)
    return mcp


def build_context(
    *,
    traceparent: str | None,
    tracestate: str | None,
    correlation_id: str | None,
    request_id: str | None,
    demo_fault: str | None,
) -> PropagationContext:
    return PropagationContext(
        traceparent=normalize_optional_string(traceparent),
        tracestate=normalize_optional_string(tracestate),
        correlation_id=normalize_optional_string(correlation_id),
        request_id=normalize_optional_string(request_id),
        demo_fault=normalize_optional_string(demo_fault),
    )


async def run_tool(
    *,
    settings: Settings,
    tracer: Any,
    tool_name: str,
    context: PropagationContext,
    operation: Callable[[MovieReservationGraphqlClient], Awaitable[ToolResult]],
) -> ToolResult:
    client = MovieReservationGraphqlClient(
        graphql_url=settings.graphql_url,
        auth_token=settings.auth_token,
        timeout_seconds=settings.request_timeout_seconds,
    )
    started = time.perf_counter()

    with tracer.start_as_current_span(f"mcp.tool.{tool_name}") as span:
        span.set_attribute("mcp.tool.name", tool_name)
        span.set_attribute("graphql.url", settings.graphql_url)
        set_context_span_attributes(span, context)
        log_event(
            "movie_mcp.tool.started",
            service_name=settings.service_name,
            tool_name=tool_name,
            correlation_id=context.correlation_id,
            request_id=context.request_id,
            fault=context.demo_fault,
        )

        try:
            result = await operation(client)
        except GraphqlClientError as exception:
            mark_span_error(span, exception)
            duration_ms = elapsed_ms(started)
            log_event(
                "movie_mcp.tool.failed",
                service_name=settings.service_name,
                level="error",
                tool_name=tool_name,
                operation_name=exception.operation_name,
                correlation_id=context.correlation_id,
                request_id=context.request_id,
                fault=context.demo_fault,
                duration_ms=duration_ms,
                error=str(exception),
            )
            raise
        except Exception as exception:
            mark_span_error(span, exception)
            duration_ms = elapsed_ms(started)
            log_event(
                "movie_mcp.tool.failed",
                service_name=settings.service_name,
                level="error",
                tool_name=tool_name,
                correlation_id=context.correlation_id,
                request_id=context.request_id,
                fault=context.demo_fault,
                duration_ms=duration_ms,
                error=str(exception),
            )
            raise

        duration_ms = elapsed_ms(started)
        span.set_attribute("mcp.tool.duration_ms", duration_ms)
        log_event(
            "movie_mcp.tool.completed",
            service_name=settings.service_name,
            tool_name=tool_name,
            correlation_id=context.correlation_id,
            request_id=context.request_id,
            fault=context.demo_fault,
            duration_ms=duration_ms,
            outcome="success",
        )
        return result


def register_health_route(mcp: Any, settings: Settings) -> None:
    custom_route = getattr(mcp, "custom_route", None)
    if custom_route is None:
        return

    try:
        from starlette.responses import JSONResponse
    except Exception:
        return

    @custom_route("/health", methods=["GET"])
    async def health_check(request: object) -> Any:
        return JSONResponse(
            {
                "status": "ok",
                "service": settings.service_name,
                "graphqlUrl": settings.graphql_url,
            },
        )


def set_context_span_attributes(span: Any, context: PropagationContext) -> None:
    if context.correlation_id is not None:
        span.set_attribute("correlation.id", context.correlation_id)
    if context.request_id is not None:
        span.set_attribute("request.id", context.request_id)
    if context.demo_fault is not None:
        span.set_attribute("demo.fault", context.demo_fault)


def normalize_optional_string(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def elapsed_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def main() -> None:
    settings = load_settings()
    configure_logging()
    configure_telemetry(settings.service_name)
    log_event(
        "movie_mcp.server.starting",
        service_name=settings.service_name,
        host=settings.host,
        port=settings.port,
        mcp_path=settings.mcp_path,
        graphql_url=settings.graphql_url,
    )
    mcp = create_mcp_server(settings)
    mcp.run(
        transport=settings.mcp_transport,
        host=settings.host,
        port=settings.port,
        path=settings.mcp_path,
    )
