import unittest

from movie_reservation_mcp.graphql_client import (
    GraphqlClientError,
    PropagationContext,
    build_graphql_headers,
    build_graphql_request,
    parse_graphql_response,
    read_required_list,
    SCREENINGS_QUERY,
)


class GraphqlClientHelpersTest(unittest.TestCase):
    def test_builds_graphql_request_body(self) -> None:
        body = build_graphql_request(
            operation_name="MovieMcpListMovies",
            query="query MovieMcpListMovies { movies { id } }",
            variables={"limit": 3},
        )

        self.assertEqual(
            body,
            {
                "operationName": "MovieMcpListMovies",
                "query": "query MovieMcpListMovies { movies { id } }",
                "variables": {"limit": 3},
            },
        )

    def test_builds_headers_with_propagation_context(self) -> None:
        headers = build_graphql_headers(
            auth_token=" local-demo-token ",
            context=PropagationContext(
                traceparent="00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
                tracestate="vendor=value",
                correlation_id="demo-correlation",
                request_id="demo-request",
                demo_fault="slow-recommendation",
            ),
        )

        self.assertEqual(headers["Authorization"], "Bearer local-demo-token")
        self.assertEqual(
            headers["traceparent"],
            "00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01",
        )
        self.assertEqual(headers["tracestate"], "vendor=value")
        self.assertEqual(headers["X-Correlation-Id"], "demo-correlation")
        self.assertEqual(headers["X-Request-Id"], "demo-request")
        self.assertEqual(headers["X-Demo-Fault"], "slow-recommendation")

    def test_rejects_invalid_json_envelope(self) -> None:
        with self.assertRaises(GraphqlClientError):
            parse_graphql_response("not-json", "MovieMcpListMovies")

    def test_rejects_non_object_list_items(self) -> None:
        with self.assertRaises(GraphqlClientError):
            read_required_list(
                {"movies": [{"id": "movie-1"}, "bad"]},
                "movies",
                "MovieMcpListMovies",
            )

    def test_screenings_query_includes_reserved_seat_flag(self) -> None:
        self.assertIn("isReserved", SCREENINGS_QUERY)


if __name__ == "__main__":
    unittest.main()
