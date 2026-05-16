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
    routes_email,
    routes_health,
    routes_integrations,
    routes_messages,
    routes_multi_agent,
    routes_nemotron,
    routes_organizations,
    routes_projects,
    routes_swarm,
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
api_router.include_router(routes_nemotron.router)
api_router.include_router(routes_multi_agent.router)
api_router.include_router(routes_automation.router)
api_router.include_router(routes_email.router)
api_router.include_router(routes_integrations.router)
api_router.include_router(routes_swarm.router)
