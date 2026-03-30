import pytest

from app.services.ai_action_registry import (
    ActionValidationError,
    normalize_action_blueprint,
    validate_action_payload,
)


def test_validate_action_payload_accepts_allowed_action() -> None:
    payload = validate_action_payload(
        "create_follow_up_task",
        {
            "title": "Follow up with customer",
            "description": "Confirm next step",
            "status": "open",
            "source": "automation",
        },
    )

    assert payload["title"] == "Follow up with customer"
    assert payload["source"] == "automation"


def test_validate_action_payload_rejects_forbidden_action_type() -> None:
    with pytest.raises(ActionValidationError):
        validate_action_payload("create_api_key", {"name": "not-allowed"})


def test_normalize_action_blueprint_rejects_non_object_payload() -> None:
    with pytest.raises(ActionValidationError):
        normalize_action_blueprint(
            {
                "action_type": "create_task",
                "action_payload": "invalid",
            }
        )


def test_normalize_action_blueprint_returns_normalized_action() -> None:
    normalized = normalize_action_blueprint(
        {
            "action_type": "UPDATE_CONTACT",
            "action_payload": {
                "contact_id": "11111111-1111-1111-1111-111111111111",
                "status": "active",
            },
            "title": "Promote contact",
        }
    )

    assert normalized["action_type"] == "update_contact"
    assert normalized["action_payload"]["status"] == "active"
