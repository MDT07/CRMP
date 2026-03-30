from __future__ import annotations

from app.schemas.ai import DealScoreResult

STAGE_BASELINES = {
    "lead": 20.0,
    "qualified": 40.0,
    "proposal": 58.0,
    "negotiation": 72.0,
    "closed_won": 100.0,
    "closed_lost": 0.0,
}


def score_deal_health(
    *,
    stage: str,
    amount: float,
    recent_events: list[str] | None = None,
) -> DealScoreResult:
    recent_events = recent_events or []
    probability = STAGE_BASELINES.get(stage, 25.0)
    if amount >= 10000:
        probability += 4.0
    if any("message_received" in event for event in recent_events):
        probability += 6.0
    if any("objection" in event or "delay" in event for event in recent_events):
        probability -= 10.0

    probability = max(0.0, min(100.0, probability))
    rationale = (
        "Heuristic deal score derived from stage progression, recent activity, "
        "and deal size. This can be replaced later by a trained model."
    )
    return DealScoreResult(probability=probability, rationale=rationale)
