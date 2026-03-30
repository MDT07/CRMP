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
    assert "/ai/status" in route_paths
    assert "/ai/copilot" in route_paths
    assert "/ai/project-intelligence" in route_paths
    assert "/ai/project-intelligence/chat" in route_paths
    assert "/ai/agent/run" in route_paths
    assert "/ai/agent/runs" in route_paths
    assert "/ai/agent/runs/{run_id}" in route_paths
    assert "/ai/proposals/bulk-decision" in route_paths
