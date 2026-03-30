from __future__ import annotations

from fastapi import APIRouter

from app.api import (
    routes_ai,
    routes_analytics,
    routes_api_keys,
    routes_auth,
    routes_automation,
    routes_companies,
    routes_contacts,
    routes_deals,
    routes_health,
    routes_messages,
    routes_organizations,
    routes_projects,
    routes_tasks,
)

api_router = APIRouter()
api_router.include_router(routes_health.router)
api_router.include_router(routes_auth.router)
api_router.include_router(routes_organizations.router)
api_router.include_router(routes_api_keys.router)
api_router.include_router(routes_companies.router)
api_router.include_router(routes_contacts.router)
api_router.include_router(routes_deals.router)
api_router.include_router(routes_messages.router)
api_router.include_router(routes_tasks.router)
api_router.include_router(routes_projects.router)
api_router.include_router(routes_analytics.router)
api_router.include_router(routes_ai.router)
api_router.include_router(routes_automation.router)
