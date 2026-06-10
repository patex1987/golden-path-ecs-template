from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PropagationContext:
    traceparent: str | None = None
    tracestate: str | None = None
    correlation_id: str | None = None
    request_id: str | None = None
    demo_fault: str | None = None


class GraphqlClientError(RuntimeError):
    def __init__(self, message: str, operation_name: str) -> None:
        super().__init__(message)
        self.operation_name = operation_name


class MovieReservationGraphqlClient:
    def __init__(
        self,
        *,
        graphql_url: str,
        auth_token: str | None,
        timeout_seconds: float,
    ) -> None:
        self._graphql_url = graphql_url
        self._auth_token = auth_token
        self._timeout_seconds = timeout_seconds

    async def me(self, context: PropagationContext) -> dict[str, Any]:
        data = await self._request_graphql(
            operation_name="MovieMcpMe",
            query=ME_QUERY,
            variables={},
            context=context,
        )
        return read_required_object(data, "me", "MovieMcpMe")

    async def list_movies(
        self,
        *,
        limit: int | None,
        context: PropagationContext,
    ) -> list[dict[str, Any]]:
        data = await self._request_graphql(
            operation_name="MovieMcpListMovies",
            query=MOVIES_QUERY,
            variables={},
            context=context,
        )
        movies = read_required_list(data, "movies", "MovieMcpListMovies")
        if limit is None or limit <= 0:
            return movies
        return movies[:limit]

    async def list_screenings(
        self,
        *,
        movie_id: str | None,
        context: PropagationContext,
    ) -> list[dict[str, Any]]:
        data = await self._request_graphql(
            operation_name="MovieMcpListScreenings",
            query=SCREENINGS_QUERY,
            variables={"movieId": movie_id},
            context=context,
        )
        return read_required_list(data, "screenings", "MovieMcpListScreenings")

    async def request_reservation(
        self,
        *,
        screening_id: str,
        seat_ids: list[str],
        context: PropagationContext,
    ) -> dict[str, Any]:
        data = await self._request_graphql(
            operation_name="MovieMcpRequestReservation",
            query=REQUEST_RESERVATION_MUTATION,
            variables={
                "input": {
                    "screeningId": screening_id,
                    "seatIds": seat_ids,
                },
            },
            context=context,
        )
        return read_required_object(
            data,
            "requestReservation",
            "MovieMcpRequestReservation",
        )

    async def reservation_status(
        self,
        *,
        reservation_request_id: str,
        context: PropagationContext,
    ) -> dict[str, Any] | None:
        data = await self._request_graphql(
            operation_name="MovieMcpReservationStatus",
            query=RESERVATION_STATUS_QUERY,
            variables={"id": reservation_request_id},
            context=context,
        )
        return read_optional_object(
            data,
            "reservationRequestStatus",
            "MovieMcpReservationStatus",
        )

    async def reservation_result(
        self,
        *,
        reservation_request_id: str,
        context: PropagationContext,
    ) -> dict[str, Any] | None:
        data = await self._request_graphql(
            operation_name="MovieMcpReservationResult",
            query=RESERVATION_RESULT_QUERY,
            variables={"requestId": reservation_request_id},
            context=context,
        )
        return read_optional_object(
            data,
            "reservationResult",
            "MovieMcpReservationResult",
        )

    async def _request_graphql(
        self,
        *,
        operation_name: str,
        query: str,
        variables: dict[str, Any],
        context: PropagationContext,
    ) -> dict[str, Any]:
        try:
            import httpx
        except Exception as exception:
            raise GraphqlClientError(
                "httpx is required to call the GraphQL API",
                operation_name,
            ) from exception

        request_body = build_graphql_request(
            operation_name=operation_name,
            query=query,
            variables=variables,
        )
        headers = build_graphql_headers(
            auth_token=self._auth_token,
            context=context,
        )

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.post(
                self._graphql_url,
                json=request_body,
                headers=headers,
            )

        payload = parse_graphql_response(response.text, operation_name)

        if response.status_code < 200 or response.status_code >= 300:
            raise GraphqlClientError(
                f"GraphQL HTTP {response.status_code}: {response.reason_phrase}",
                operation_name,
            )

        errors = payload.get("errors")
        if isinstance(errors, list) and len(errors) > 0:
            messages = [
                error.get("message", "Unknown GraphQL error")
                for error in errors
                if isinstance(error, dict)
            ]
            raise GraphqlClientError(
                "; ".join(messages) if messages else "Unknown GraphQL error",
                operation_name,
            )

        data = payload.get("data")
        if not isinstance(data, dict):
            raise GraphqlClientError(
                "GraphQL response did not include an object data field",
                operation_name,
            )

        return data


def build_graphql_request(
    *,
    operation_name: str,
    query: str,
    variables: dict[str, Any],
) -> dict[str, Any]:
    return {
        "operationName": operation_name,
        "query": query,
        "variables": variables,
    }


def build_graphql_headers(
    *,
    auth_token: str | None,
    context: PropagationContext,
) -> dict[str, str]:
    headers = {"Content-Type": "application/json"}

    if auth_token is not None and auth_token.strip() != "":
        headers["Authorization"] = f"Bearer {auth_token.strip()}"

    if context.traceparent:
        headers["traceparent"] = context.traceparent
    if context.tracestate:
        headers["tracestate"] = context.tracestate
    if context.correlation_id:
        headers["X-Correlation-Id"] = context.correlation_id
    if context.request_id:
        headers["X-Request-Id"] = context.request_id
    if context.demo_fault:
        headers["X-Demo-Fault"] = context.demo_fault

    return headers


def parse_graphql_response(
    response_text: str,
    operation_name: str,
) -> dict[str, Any]:
    import json

    try:
        payload = json.loads(response_text)
    except json.JSONDecodeError as exception:
        raise GraphqlClientError(
            f"GraphQL response was not valid JSON: {exception.msg}",
            operation_name,
        ) from exception

    if not isinstance(payload, dict):
        raise GraphqlClientError(
            "GraphQL response envelope was not an object",
            operation_name,
        )

    return payload


def read_required_object(
    data: dict[str, Any],
    field: str,
    operation_name: str,
) -> dict[str, Any]:
    value = data.get(field)
    if not isinstance(value, dict):
        raise GraphqlClientError(
            f"GraphQL field {field} was not an object",
            operation_name,
        )
    return value


def read_optional_object(
    data: dict[str, Any],
    field: str,
    operation_name: str,
) -> dict[str, Any] | None:
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, dict):
        raise GraphqlClientError(
            f"GraphQL field {field} was not an object or null",
            operation_name,
        )
    return value


def read_required_list(
    data: dict[str, Any],
    field: str,
    operation_name: str,
) -> list[dict[str, Any]]:
    value = data.get(field)
    if not isinstance(value, list):
        raise GraphqlClientError(
            f"GraphQL field {field} was not a list",
            operation_name,
        )

    if not all(isinstance(item, dict) for item in value):
        raise GraphqlClientError(
            f"GraphQL field {field} contained non-object items",
            operation_name,
        )

    return value


ME_QUERY = """
query MovieMcpMe {
  me {
    userId
    username
    email
    movieProviderId
    movieProviderCode
    roles
    scopes
  }
}
"""

MOVIES_QUERY = """
query MovieMcpListMovies {
  movies {
    id
    title
    rating
    durationMinutes
  }
}
"""

SCREENINGS_QUERY = """
query MovieMcpListScreenings($movieId: ID) {
  screenings(movieId: $movieId) {
    id
    movieId
    auditoriumId
    startsAt
    endsAt
    seats {
      id
      row
      number
    }
  }
}
"""

REQUEST_RESERVATION_MUTATION = """
mutation MovieMcpRequestReservation($input: RequestReservationInput!) {
  requestReservation(input: $input) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}
"""

RESERVATION_STATUS_QUERY = """
query MovieMcpReservationStatus($id: ID!) {
  reservationRequestStatus(id: $id) {
    id
    status
    screeningId
    seatIds
    requestedByUserId
  }
}
"""

RESERVATION_RESULT_QUERY = """
query MovieMcpReservationResult($requestId: ID!) {
  reservationResult(requestId: $requestId) {
    id
    reservationRequestId
    screeningId
    seatIds
    reservedByUserId
    confirmedAt
  }
}
"""
