from __future__ import annotations

from contextvars import ContextVar
from typing import Final

from app.core.config import get_settings

try:
    from opentelemetry import trace
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
except ImportError:  # pragma: no cover - local bootstrap fallback
    trace = None  # type: ignore[assignment]
    Resource = None  # type: ignore[assignment]
    TracerProvider = None  # type: ignore[assignment]
    BatchSpanProcessor = None  # type: ignore[assignment]
    ConsoleSpanExporter = None  # type: ignore[assignment]

try:
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
except ImportError:  # pragma: no cover - optional during local bootstrap
    OTLPSpanExporter = None  # type: ignore[assignment]

TRACE_ID_HEADER: Final[str] = "X-Trace-Id"
CLIENT_TRACE_ID_HEADER: Final[str] = "X-Client-Trace-Id"
_request_trace_id: ContextVar[str | None] = ContextVar("request_trace_id", default=None)
_telemetry_configured = False


class _NoopSpanContext:
    is_valid = False
    trace_id = 0


class _NoopSpan:
    def set_attribute(self, *_args, **_kwargs) -> None:
        return None

    def get_span_context(self) -> _NoopSpanContext:
        return _NoopSpanContext()


class _NoopSpanContextManager:
    def __enter__(self) -> _NoopSpan:
        return _NoopSpan()

    def __exit__(self, _exc_type, _exc, _tb) -> bool:
        return False


class _NoopTracer:
    def start_as_current_span(self, _name: str) -> _NoopSpanContextManager:
        return _NoopSpanContextManager()


_NOOP_TRACER = _NoopTracer()


def configure_telemetry() -> None:
    global _telemetry_configured
    if _telemetry_configured:
        return

    settings = get_settings()
    if not settings.telemetry_enabled:
        _telemetry_configured = True
        return

    if trace is None or Resource is None or TracerProvider is None:
        _telemetry_configured = True
        return

    resource = Resource.create({"service.name": settings.telemetry_service_name})
    provider = TracerProvider(resource=resource)
    exporter = None

    if settings.telemetry_exporter_mode == "console":
        exporter = ConsoleSpanExporter()
    elif (
        settings.telemetry_exporter_mode == "otlp"
        and settings.telemetry_otlp_endpoint
        and OTLPSpanExporter is not None
    ):
        exporter = OTLPSpanExporter(endpoint=settings.telemetry_otlp_endpoint)

    if exporter is not None:
        provider.add_span_processor(BatchSpanProcessor(exporter))

    trace.set_tracer_provider(provider)
    _telemetry_configured = True


def get_tracer(name: str):
    if trace is None:
        return _NOOP_TRACER
    return trace.get_tracer(name)


def set_request_trace_id(trace_id: str) -> None:
    _request_trace_id.set(trace_id)


def get_request_trace_id() -> str | None:
    return _request_trace_id.get()


def get_current_span_trace_id() -> str | None:
    if trace is None:
        return None
    span_context = trace.get_current_span().get_span_context()
    if not span_context.is_valid:
        return None
    return f"{span_context.trace_id:032x}"
