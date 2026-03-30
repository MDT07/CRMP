from __future__ import annotations

from app.schemas.ai import RecommendationItem, RecommendationsResponse


def build_recommendations(
    inactive_contact_count: int,
    stale_deal_count: int,
    overdue_task_count: int,
) -> RecommendationsResponse:
    items: list[RecommendationItem] = []
    if inactive_contact_count:
        items.append(
            RecommendationItem(
                title="Follow up with inactive contacts",
                description=(
                    f"{inactive_contact_count} contacts have been quiet and may need"
                    " re-engagement."
                ),
                priority="high",
                entity_type="contact",
                action_label="Create follow-up",
            )
        )
    if stale_deal_count:
        items.append(
            RecommendationItem(
                title="Refresh stale deal scores",
                description=(
                    f"{stale_deal_count} deals have aged in-stage and need renewed"
                    " attention."
                ),
                priority="medium",
                entity_type="deal",
                action_label="Review pipeline",
            )
        )
    if overdue_task_count:
        items.append(
            RecommendationItem(
                title="Clear overdue tasks",
                description=f"{overdue_task_count} open tasks are overdue and may block deals.",
                priority="medium",
                entity_type="task",
                action_label="Open tasks",
            )
        )
    if not items:
        items.append(
            RecommendationItem(
                title="Momentum looks healthy",
                description=(
                    "No urgent AI recommendations were detected from the current CRM"
                    " activity snapshot."
                ),
                priority="low",
                action_label="Keep monitoring",
            )
        )
    return RecommendationsResponse(items=items)
