from __future__ import annotations

from app.schemas.ai import MessageClassificationResult


def classify_lead_message(message_body: str) -> MessageClassificationResult:
    normalized = message_body.lower()
    score = 35.0
    intent = "general_inquiry"
    priority = "medium"
    product_relevance = "medium"
    sentiment = 0.1

    if any(keyword in normalized for keyword in ["pricing", "quote", "budget", "proposal"]):
        score += 20
        intent = "commercial_interest"
        product_relevance = "high"
    if any(keyword in normalized for keyword in ["demo", "trial", "onboarding", "implementation"]):
        score += 15
        intent = "evaluation"
    if any(keyword in normalized for keyword in ["urgent", "asap", "today", "immediately"]):
        score += 10
        priority = "high"
    if any(keyword in normalized for keyword in ["not interested", "cancel", "stop"]):
        score -= 20
        intent = "objection"
        sentiment = -0.4
    if any(keyword in normalized for keyword in ["love", "great", "excited"]):
        sentiment = 0.8

    score = max(0.0, min(100.0, score))
    summary = "Heuristic lead classification generated from the latest message."
    return MessageClassificationResult(
        lead_score=score,
        intent=intent,
        priority=priority,
        product_relevance=product_relevance,
        sentiment=sentiment,
        summary=summary,
    )
