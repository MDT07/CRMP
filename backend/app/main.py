from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager, suppress
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import update

from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.telemetry import (
    CLIENT_TRACE_ID_HEADER,
    TRACE_ID_HEADER,
    configure_telemetry,
    get_current_span_trace_id,
    get_tracer,
    set_request_trace_id,
)
from app.db.session import AsyncSessionLocal
from app.events.dispatcher import EventDispatcher
from app.models.organization_api_key import OrganizationAPIKey

logger = logging.getLogger(__name__)
tracer = get_tracer(__name__)


async def run_event_worker(interval_seconds: float) -> None:
    while True:
        try:
            async with AsyncSessionLocal() as session:
                await EventDispatcher(session).process_pending_events(limit=200, max_cycles=6)
        except Exception:
            logger.exception("Event worker iteration failed.")
        await asyncio.sleep(interval_seconds)


async def touch_api_key_last_used(api_key_id) -> None:
    async with AsyncSessionLocal() as session:
        await session.execute(
            update(OrganizationAPIKey)
            .where(OrganizationAPIKey.id == api_key_id)
            .where(OrganizationAPIKey.status == "active")
            .values(last_used_at=datetime.now(timezone.utc))
        )
        await session.commit()


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_telemetry()
    configure_logging()
    settings = get_settings()
    worker_task: asyncio.Task[None] | None = None
    # Disable event worker for testing
    # if settings.event_worker_enabled:
    #     worker_task = asyncio.create_task(run_event_worker(settings.event_worker_interval_seconds))

    # Disable email sync scheduler for testing
    # from app.services.email_sync_scheduler import get_sync_scheduler
    # email_scheduler = get_sync_scheduler()
    # email_scheduler.start()

    try:
        yield
    finally:
        if worker_task is not None:
            worker_task.cancel()
            with suppress(asyncio.CancelledError):
                await worker_task
        # Shutdown email sync scheduler
        # email_scheduler.shutdown()


class EarlyCorsMiddleware:
    """ASGI middleware to handle CORS preflight before FastAPI routing."""

    def __init__(self, app, allowed_origins):
        self.app = app
        self.allowed_origins = set(allowed_origins)
        self._initialized = False

    async def __call__(self, scope, receive, send):
        # Log first request for debugging
        if not self._initialized:
            logger.info(
                f"EarlyCorsMiddleware processing first request: {scope.get('method')} {scope.get('path')}"
            )
            self._initialized = True

        if scope["type"] == "http" and scope.get("method") == "OPTIONS":
            # Handle preflight immediately
            headers = scope.get("headers", [])
            origin = ""
            for name, value in headers:
                if name.lower() == b"origin":
                    origin = value.decode("utf-8")
                    break

            logger.info(f"OPTIONS request from origin: {origin}")

            # Check if origin is allowed
            allowed = (
                origin in self.allowed_origins
                or "*" in self.allowed_origins
                or "127.0.0.1" in origin
                or "127.0.0.1" in origin
            )

            if allowed:
                logger.info(f"Allowing CORS preflight from: {origin}")
                # Return 200 OK with CORS headers
                await send(
                    {
                        "type": "http.response.start",
                        "status": 200,
                        "headers": [
                            (b"access-control-allow-origin", origin.encode() or b"*"),
                            (
                                b"access-control-allow-methods",
                                b"GET, POST, PUT, DELETE, OPTIONS, PATCH",
                            ),
                            (b"access-control-allow-headers", b"*"),
                            (b"access-control-allow-credentials", b"true"),
                            (b"content-length", b"0"),
                        ],
                    }
                )
                await send({"type": "http.response.body", "body": b""})
                return
            else:
                logger.warning(f"Rejecting CORS preflight from: {origin}")

        # Pass to next middleware/app
        await self.app(scope, receive, send)


def create_application() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        debug=settings.debug,
        lifespan=lifespan,
    )

    # Wrap with early CORS middleware (runs before all other middleware)
    app.add_middleware(EarlyCorsMiddleware, allowed_origins=settings.allowed_cors_origins)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def add_request_trace_context(request: Request, call_next):
        trace_seed = request.headers.get(CLIENT_TRACE_ID_HEADER) or str(uuid4())
        set_request_trace_id(trace_seed)

        with tracer.start_as_current_span(f"http {request.method} {request.url.path}") as span:
            span.set_attribute("http.method", request.method)
            span.set_attribute("http.route", request.url.path)
            span.set_attribute("crm.request_trace_id", trace_seed)

            response = await call_next(request)
            span.set_attribute("http.status_code", response.status_code)

            api_key_id = getattr(request.state, "crmp_api_key_id", None)
            if api_key_id is not None and response.status_code < 400:
                limit = getattr(request.state, "crmp_rate_limit_limit", None)
                remaining = getattr(request.state, "crmp_rate_limit_remaining", None)
                reset = getattr(request.state, "crmp_rate_limit_reset", None)
                if limit is not None:
                    response.headers["X-RateLimit-Limit"] = str(limit)
                if remaining is not None:
                    response.headers["X-RateLimit-Remaining"] = str(remaining)
                if reset is not None:
                    response.headers["X-RateLimit-Reset"] = str(reset)

                try:
                    await touch_api_key_last_used(api_key_id)
                except Exception:
                    logger.exception("Failed to update API key last_used_at.")

            response.headers[TRACE_ID_HEADER] = get_current_span_trace_id() or trace_seed
            return response

    app.include_router(api_router, prefix=settings.api_v1_prefix)

    @app.get("/", tags=["meta"])
    async def root() -> dict[str, str]:
        return {
            "name": settings.app_name,
            "environment": settings.environment,
            "docs": app.docs_url or "/docs",
        }

    return app


app = create_application()
