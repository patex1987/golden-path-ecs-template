from __future__ import annotations

from contextlib import AbstractContextManager
from typing import Any


class NoopSpan:
    def __enter__(self) -> "NoopSpan":
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        return None

    def set_attribute(self, key: str, value: object) -> None:
        return None

    def record_exception(self, exception: BaseException) -> None:
        return None

    def set_status(self, status: object) -> None:
        return None


class NoopTracer:
    def start_as_current_span(self, name: str) -> AbstractContextManager[NoopSpan]:
        return NoopSpan()


def configure_telemetry(service_name: str) -> None:
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except Exception:
        return

    provider = TracerProvider(resource=Resource.create({"service.name": service_name}))
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)

    try:
        HTTPXClientInstrumentor().instrument()
    except Exception:
        return


def get_tracer(name: str) -> Any:
    try:
        from opentelemetry import trace

        return trace.get_tracer(name)
    except Exception:
        return NoopTracer()


def mark_span_error(span: Any, exception: BaseException) -> None:
    try:
        from opentelemetry.trace import Status, StatusCode

        span.record_exception(exception)
        span.set_status(Status(StatusCode.ERROR, str(exception)))
    except Exception:
        try:
            span.record_exception(exception)
        except Exception:
            return


def get_current_trace_id() -> str | None:
    try:
        from opentelemetry import trace

        span_context = trace.get_current_span().get_span_context()
        if not span_context.is_valid:
            return None
        return f"{span_context.trace_id:032x}"
    except Exception:
        return None
