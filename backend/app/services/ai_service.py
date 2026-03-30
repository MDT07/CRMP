from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.classification import classify_lead_message
from app.ai.deal_scoring import score_deal_health
from app.ai.llm_client import LLMClient
from app.ai.prompt_templates import (
    assistant_prompt,
    classification_prompt,
    deal_scoring_prompt,
    recommendation_prompt,
    reply_prompt,
)
from app.ai.recommendations import build_recommendations
from app.ai.reply_generation import generate_reply_options
from app.core.config import get_settings
from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import EventSource, TaskStatus
from app.models.message import Message
from app.models.task import Task
from app.schemas.ai import (
    AssistantMessageRequest,
    AssistantMessageResponse,
    AssistantStatusResponse,
    DealScoreRequest,
    DealScoreResult,
    MessageClassificationRequest,
    MessageClassificationResult,
    RecommendationsResponse,
    ReplyGenerationRequest,
    ReplyGenerationResult,
)

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.llm_client = LLMClient()

    async def _complete_json(
        self,
        prompt: str,
        *,
        model: str | None = None,
    ) -> dict | None:
        try:
            return await self.llm_client.complete_json(prompt, model=model)
        except Exception:
            logger.exception("LLM JSON completion failed.")
            return None

    async def _complete_text(
        self,
        prompt: str,
        *,
        model: str | None = None,
    ) -> str | None:
        try:
            return await self.llm_client.complete_text(prompt, model=model)
        except Exception:
            logger.exception("LLM text completion failed.")
            return None

    @staticmethod
    def _fallback_copilot_response(payload: AssistantMessageRequest) -> str:
        prompt = payload.prompt.lower()
        context = payload.context
        page = payload.page or "the current CRM page"

        deals = context.get("deals")
        inbox = context.get("inbox")
        tasks = context.get("tasks")
        contacts = context.get("contacts")

        if "reply" in prompt:
            return (
                "Start with a short acknowledgement, answer the customer question directly, "
                "and end with one clear next step or call invitation."
            )
        if "deal" in prompt:
            return (
                "Create a deal draft with a clear title, conservative amount, named owner, "
                "and the next concrete milestone before moving the stage forward."
            )
        if "summary" in prompt or "summarize" in prompt:
            return (
                f"{page} is the active context. "
                f"Prioritize {inbox or 'active'} conversations, {deals or 'open'} deals, "
                f"and {tasks or 'pending'} tasks while keeping "
                f"{contacts or 'live'} contacts visible."
            )
        if "next best" in prompt or "next step" in prompt:
            return (
                "Work the highest-intent conversation first, then update the most time-sensitive "
                "deal, and let automations handle routine follow-ups."
            )

        return (
            f"The clearest move from {page} is to focus on the highest-intent activity first, "
            "capture the next step explicitly, and avoid leaving any record without an owner "
            "or follow-up."
        )

    async def classify_message(
        self, payload: MessageClassificationRequest
    ) -> MessageClassificationResult:
        llm_result = await self._complete_json(
            classification_prompt(payload.message_body, payload.context)
        )
        if llm_result is not None:
            try:
                return MessageClassificationResult.model_validate(llm_result)
            except Exception:
                logger.exception("LLM classification payload could not be validated.")

        return classify_lead_message(payload.message_body)

    async def generate_reply(self, payload: ReplyGenerationRequest) -> ReplyGenerationResult:
        llm_result = await self._complete_json(
            reply_prompt(
                payload.message_body,
                tone=payload.tone,
                max_options=payload.max_options,
                context=payload.context,
            )
        )
        if llm_result is not None:
            try:
                result = ReplyGenerationResult.model_validate(llm_result)
                if result.options:
                    return ReplyGenerationResult(options=result.options[: payload.max_options])
            except Exception:
                logger.exception("LLM reply payload could not be validated.")

        return generate_reply_options(
            payload.message_body,
            tone=payload.tone,
            max_options=payload.max_options,
        )

    async def score_deal(self, payload: DealScoreRequest) -> DealScoreResult:
        llm_result = await self._complete_json(
            deal_scoring_prompt(
                payload.title,
                amount=payload.amount,
                stage=payload.stage,
                context={
                    **payload.context,
                    "recent_events": payload.recent_events,
                },
            )
        )
        if llm_result is not None:
            try:
                return DealScoreResult.model_validate(llm_result)
            except Exception:
                logger.exception("LLM deal-score payload could not be validated.")

        return score_deal_health(
            stage=payload.stage,
            amount=payload.amount,
            recent_events=payload.recent_events,
        )

    async def analyze_message(self, organization_id: UUID, message_id: UUID) -> Message | None:
        message = await self.session.scalar(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(Message.id == message_id)
        )
        if message is None:
            return None

        result = await self.classify_message(
            MessageClassificationRequest(message_body=message.body)
        )
        message.ai_lead_score = result.lead_score
        message.ai_intent = result.intent
        message.ai_priority = result.priority
        message.ai_product_relevance = result.product_relevance
        message.ai_sentiment = result.sentiment

        if message.contact_id is not None:
            contact = await self.session.scalar(
                select(Contact)
                .where(Contact.organization_id == organization_id)
                .where(Contact.id == message.contact_id)
            )
            if contact is not None:
                contact.lead_score = max(contact.lead_score, result.lead_score)

        await EventDispatcher(self.session).publish(
            organization_id=organization_id,
            event_type=EventTypes.AI_INSIGHT_CREATED,
            entity_type="message",
            entity_id=str(message.id),
            payload={
                "message_id": str(message.id),
                "intent": result.intent,
                "priority": result.priority,
            },
            source=EventSource.ai,
        )
        await self.session.flush()
        return message

    async def score_deal_from_event(self, organization_id: UUID, deal_id: UUID) -> Deal | None:
        deal = await self.session.scalar(
            select(Deal)
            .where(Deal.organization_id == organization_id)
            .where(Deal.id == deal_id)
        )
        if deal is None:
            return None

        recent_events_result = await self.session.scalars(
            select(Message.ai_intent)
            .where(Message.organization_id == organization_id)
            .where(Message.deal_id == deal_id)
            .order_by(Message.created_at.desc())
            .limit(5)
        )
        recent_events = [item for item in recent_events_result.all() if item]
        result = await self.score_deal(
            DealScoreRequest(
                deal_id=deal.id,
                title=deal.title,
                amount=float(deal.amount),
                stage=deal.pipeline_stage.value,
                recent_events=recent_events,
            )
        )
        deal.probability = result.probability
        await EventDispatcher(self.session).publish(
            organization_id=organization_id,
            event_type=EventTypes.DEAL_SCORED,
            entity_type="deal",
            entity_id=str(deal.id),
            payload={
                "deal_id": str(deal.id),
                "probability": result.probability,
                "rationale": result.rationale,
            },
            source=EventSource.ai,
        )
        await self.session.flush()
        return deal

    async def get_recommendations(self, organization_id: UUID) -> RecommendationsResponse:
        inactivity_threshold = datetime.now(timezone.utc) - timedelta(hours=48)
        inactive_contacts = await self.session.scalar(
            select(func.count(Contact.id))
            .where(Contact.organization_id == organization_id)
            .where(Contact.updated_at < inactivity_threshold)
        )
        stale_deals = await self.session.scalar(
            select(func.count(Deal.id))
            .where(Deal.organization_id == organization_id)
            .where(Deal.updated_at < inactivity_threshold)
        )
        overdue_tasks = await self.session.scalar(
            select(func.count(Task.id))
            .where(Task.organization_id == organization_id)
            .where(Task.status.in_([TaskStatus.open, TaskStatus.in_progress]))
            .where(Task.due_at < datetime.now(timezone.utc))
        )
        fallback = build_recommendations(
            inactive_contact_count=int(inactive_contacts or 0),
            stale_deal_count=int(stale_deals or 0),
            overdue_task_count=int(overdue_tasks or 0),
        )
        llm_result = await self._complete_json(
            recommendation_prompt(
                {
                    "inactive_contact_count": int(inactive_contacts or 0),
                    "stale_deal_count": int(stale_deals or 0),
                    "overdue_task_count": int(overdue_tasks or 0),
                    "fallback_items": [item.model_dump() for item in fallback.items],
                }
            )
        )
        if llm_result is not None:
            try:
                result = RecommendationsResponse.model_validate(llm_result)
                if result.items:
                    return result
            except Exception:
                logger.exception("LLM recommendations payload could not be validated.")

        return fallback

    async def copilot_message(
        self,
        organization_id: UUID,
        payload: AssistantMessageRequest,
    ) -> AssistantMessageResponse:
        default_model = self.settings.llm_model_chat or self.settings.llm_model
        response = await self._complete_text(
            assistant_prompt(
                payload.prompt,
                tone=payload.tone,
                page=payload.page,
                context={
                    **payload.context,
                    "organization_id": str(organization_id),
                },
            ),
            model=payload.model or default_model,
        )
        if response:
            return AssistantMessageResponse(content=response.strip(), mode="llm")

        return AssistantMessageResponse(
            content=self._fallback_copilot_response(payload),
            mode="fallback",
        )

    async def get_status(self) -> AssistantStatusResponse:
        status = await self.llm_client.get_status(
            requested_model=self.settings.llm_model_chat or self.settings.llm_model,
        )
        return AssistantStatusResponse.model_validate(status)
