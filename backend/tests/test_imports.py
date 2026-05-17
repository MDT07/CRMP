from app.api.router import api_router
from app.main import create_application


def test_create_application() -> None:
    app = create_application()
    assert app.title == "CRMP Backend"


def test_workspace_routes_are_registered() -> None:
    route_paths = {route.path for route in api_router.routes}

    assert "/organizations/current" in route_paths
    assert "/organizations/current/members" in route_paths
    assert "/organizations/current/bootstrap" in route_paths
    assert "/organizations/current/api-keys" in route_paths
    assert "/organizations/current/api-keys/{api_key_id}/revoke" in route_paths
    assert "/health" in route_paths
    assert "/auth/login" in route_paths
    assert "/auth/register" in route_paths
    assert "/companies/" in route_paths
    assert "/contacts/" in route_paths
    assert "/deals/" in route_paths
    assert "/tasks/" in route_paths
    assert "/projects/" in route_paths
    assert "/messages/" in route_paths
    assert "/email/accounts" in route_paths
    assert "/automations/rules" in route_paths
    assert "/analytics/dashboard" in route_paths
