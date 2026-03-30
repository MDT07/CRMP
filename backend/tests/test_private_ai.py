from app.schemas.ai import GroundedEvidenceItem
from app.services.ai_eval_service import LocalAIEvalService


def test_assess_output_fails_without_evidence() -> None:
    status, detail, checks = LocalAIEvalService.assess_output(
        prompt="Summarize this thread.",
        content="The customer is active and needs a clear next step.",
        evidence=[],
        proposed_actions=[],
        valid_entity_ids=set(),
    )

    assert status == "failed"
    assert checks["evidence_ok"] is False
    assert "evidence_ok" in detail


def test_assess_output_fails_for_unsupported_action() -> None:
    status, detail, checks = LocalAIEvalService.assess_output(
        prompt="Recommend the next action.",
        content="The customer is ready for a follow-up task.",
        evidence=[
            GroundedEvidenceItem(
                id="message:1",
                entity_type="message",
                entity_id="1",
                title="email inbound",
                snippet="Please send the proposal update.",
                source="thread-message",
            )
        ],
        proposed_actions=[
            {
                "action_type": "send_external_email",
                "target_entity_type": "message",
            }
        ],
        valid_entity_ids={"1"},
    )

    assert status == "failed"
    assert checks["allowed_actions_only"] is False
    assert "allowed_actions_only" in detail


def test_assess_output_passes_for_valid_grounded_result() -> None:
    status, detail, checks = LocalAIEvalService.assess_output(
        prompt="Recommend the next action.",
        content="The safest move is to create a follow-up task and keep the deal moving.",
        evidence=[
            GroundedEvidenceItem(
                id="message:1",
                entity_type="message",
                entity_id="1",
                title="email inbound",
                snippet="Can we review the contract this week?",
                source="thread-message",
            )
        ],
        proposed_actions=[
            {
                "action_type": "create_follow_up_task",
                "target_entity_type": "task",
            }
        ],
        valid_entity_ids={"1"},
    )

    assert status == "passed"
    assert all(checks.values()) is True
    assert "private-first safety checks" in detail
