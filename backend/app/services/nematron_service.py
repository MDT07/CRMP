"""Nematron CRM Service - Multi-purpose AI assistant using NVIDIA Nemotron-3-Nano-4B.

This service provides comprehensive CRM assistance including:
- Contact analysis and scoring
- Deal health assessment
- Email drafting
- Follow-up suggestions
- Meeting preparation
- Pipeline analysis
- Task prioritization
- Smart summaries
- Automation advice
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import LLMClient
from app.ai.nemotron_config import (
    DEFAULT_NEMOTRON_CONFIG,
    NemotronCapabilities,
    NemotronTaskType,
)
from app.ai.nemotron_prompts import (
    nemotron_automation_advice_prompt,
    nemotron_contact_analysis_prompt,
    nemotron_deal_analysis_prompt,
    nemotron_email_draft_prompt,
    nemotron_follow_up_suggestion_prompt,
    nemotron_general_chat_prompt,
    nemotron_meeting_prep_prompt,
    nemotron_multitask_prompt,
    nemotron_pipeline_analysis_prompt,
    nemotron_summary_generation_prompt,
    nemotron_task_prioritization_prompt,
)
from app.core.config import get_settings
from app.models.ai_chat_message import AIChatMessage, AIChatRole
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import DealStage, TaskStatus
from app.models.message import Message
from app.models.task import Task

logger = logging.getLogger(__name__)


class NematronCRMService:
    """Multi-purpose CRM assistant powered by NVIDIA Nemotron-3-Nano-4B."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.llm_client = LLMClient()
        self.config = DEFAULT_NEMOTRON_CONFIG

    @property
    def model_id(self) -> str:
        """Get the configured nemotron model ID."""
        return self.config.model_id

    async def _complete_with_nemotron(
        self,
        prompt: str,
        task_type: NemotronTaskType,
        system_prompt: str | None = None,
        expect_json: bool = True,
    ) -> dict[str, Any] | str | None:
        """Execute completion with nemotron-specific settings."""
        if not self.llm_client.enabled:
            logger.warning("LLM client not enabled for nemotron completion")
            return None

        task_config = self.config.get_task_config(task_type)
        model = task_config.get("model", self.model_id)

        try:
            if expect_json:
                # Try JSON completion first
                result = await self.llm_client.complete_json(
                    prompt=prompt,
                    model=model,
                )
                if result is not None:
                    return result

            # Fallback to text completion
            result = await self.llm_client.complete_text(
                prompt=prompt,
                model=model,
            )
            return result

        except Exception as e:
            logger.exception(f"Nemotron completion failed for {task_type.value}: {e}")
            return None

    async def chat(
        self,
        message: str,
        organization_id: UUID | None = None,
        user_id: UUID | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """General chat with nematron CRM assistant with conversation history."""
        import time

        # Generate session ID if not provided
        if not session_id:
            session_id = f"crmagent_{int(time.time())}_{organization_id or 'anonymous'}"

        try:
            # Save user message to database
            user_message = AIChatMessage(
                organization_id=organization_id,
                user_id=user_id,
                session_id=session_id,
                role=AIChatRole.user,
                content=message,
                message_metadata={"source": "crm_agent_chat"}
            )
            self.session.add(user_message)
            await self.session.commit()

            # Get recent conversation history (last 10 messages from this session)
            conversation_history = []
            query = select(AIChatMessage).where(AIChatMessage.session_id == session_id)
            if organization_id:
                query = query.where(AIChatMessage.organization_id == organization_id)
            recent_messages = await self.session.scalars(
                query.order_by(AIChatMessage.created_at.desc()).limit(10)
            )
            # Reverse to get chronological order
            messages = list(recent_messages)[::-1]
            conversation_history = [
                {"role": msg.role.value, "content": msg.content}
                for msg in messages
            ]

            # Get CRM context if organization_id is provided
            crm_context = None
            if organization_id:
                crm_context = await self._get_crm_context(organization_id)

            # Generate prompt with conversation history
            prompt = nemotron_general_chat_prompt(
                user_message=message,
                conversation_history=conversation_history[-9:] if len(conversation_history) > 9 else conversation_history,  # Keep last 9 + current = 10 total
                crm_context=crm_context
            )

            start_time = time.time()
            result = await self._complete_with_nemotron(
                prompt=prompt,
                task_type=NemotronTaskType.GENERAL_CHAT,
                expect_json=False
            )
            response_time = int((time.time() - start_time) * 1000)

            if result:
                response_text = result if isinstance(result, str) else str(result)

                # Save assistant response to database
                assistant_message = AIChatMessage(
                    organization_id=organization_id,
                    user_id=user_id,
                    session_id=session_id,
                    role=AIChatRole.assistant,
                    content=response_text,
                    message_metadata={
                        "source": "crm_agent_chat",
                        "model": self.model_id,
                        "response_time_ms": response_time
                    },
                    model_used=self.model_id,
                    response_time_ms=response_time
                )
                self.session.add(assistant_message)
                await self.session.commit()

                return {
                    "response": response_text,
                    "mode": "llm",
                    "session_id": session_id,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            else:
                # Fallback response
                fallback_response = "I'm CRMagent, ready to help with your CRM tasks. What would you like assistance with?"
                if organization_id:
                    assistant_message = AIChatMessage(
                        organization_id=organization_id,
                        user_id=user_id,
                        session_id=session_id,
                        role=AIChatRole.assistant,
                        content=fallback_response,
                        message_metadata={"source": "crm_agent_chat", "mode": "fallback"}
                    )
                    self.session.add(assistant_message)
                    await self.session.commit()

                return {
                    "response": fallback_response,
                    "mode": "fallback",
                    "session_id": session_id,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }

        except Exception as e:
            logger.exception(f"CRM Agent chat failed: {e}")
            return {
                "response": f"I encountered an issue: {str(e)}",
                "mode": "fallback",
                "session_id": session_id,
            }

    async def analyze_contact(
        self,
        organization_id: UUID,
        contact_id: UUID,
    ) -> dict[str, Any] | None:
        """Analyze a contact and provide actionable insights."""
        # Fetch contact data
        contact = await self.session.scalar(
            select(Contact)
            .where(Contact.organization_id == organization_id)
            .where(Contact.id == contact_id)
        )
        if not contact:
            return None

        # Fetch recent interactions
        recent_messages = await self.session.scalars(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(Message.contact_id == contact_id)
            .order_by(Message.created_at.desc())
            .limit(5)
        )

        interactions = [
            {
                "channel": msg.channel.value,
                "direction": msg.direction.value,
                "subject": msg.subject,
                "date": msg.created_at.isoformat() if msg.created_at else None,
            }
            for msg in recent_messages.all()
        ]

        contact_data = {
            "name": contact.name,
            "status": contact.status.value,
            "lead_score": contact.lead_score,
            "tags": contact.tags,
            "email": contact.email,
            "phone": contact.phone,
        }

        prompt = nemotron_contact_analysis_prompt(
            contact_name=contact.name,
            contact_data=contact_data,
            recent_interactions=interactions,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.CONTACT_ANALYSIS,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "contact_id": str(contact_id),
                "analysis": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_contact_analysis(contact, interactions)

    async def analyze_deal(
        self,
        organization_id: UUID,
        deal_id: UUID,
    ) -> dict[str, Any] | None:
        """Analyze a deal and provide scoring/insights."""
        deal = await self.session.scalar(
            select(Deal).where(Deal.organization_id == organization_id).where(Deal.id == deal_id)
        )
        if not deal:
            return None

        # Get related contact and messages
        contact = None
        if deal.contact_id:
            contact = await self.session.scalar(
                select(Contact)
                .where(Contact.organization_id == organization_id)
                .where(Contact.id == deal.contact_id)
            )

        recent_messages = await self.session.scalars(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(Message.deal_id == deal_id)
            .order_by(Message.created_at.desc())
            .limit(5)
        )

        contact_history = [
            {
                "intent": msg.ai_intent,
                "sentiment": msg.ai_sentiment,
                "priority": msg.ai_priority,
            }
            for msg in recent_messages.all()
            if msg.ai_intent
        ]

        deal_data = {
            "title": deal.title,
            "stage": deal.pipeline_stage.value,
            "amount": float(deal.amount),
            "currency": deal.currency,
            "probability": deal.probability,
            "contact_name": contact.name if contact else None,
            "created_at": deal.created_at.isoformat() if deal.created_at else None,
        }

        prompt = nemotron_deal_analysis_prompt(
            deal_title=deal.title,
            deal_data=deal_data,
            contact_history=contact_history or None,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.DEAL_SCORING,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "deal_id": str(deal_id),
                "analysis": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_deal_analysis(deal, contact)

    async def draft_email_reply(
        self,
        organization_id: UUID,
        message_id: UUID,
        tone: str = "professional",
    ) -> dict[str, Any] | None:
        """Draft an email reply for a message."""
        message = await self.session.scalar(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(Message.id == message_id)
        )
        if not message:
            return None

        context = {
            "original_subject": message.subject,
            "original_body": message.body[:500] if message.body else "",
            "direction": message.direction.value,
            "channel": message.channel.value,
        }

        if message.contact_id:
            contact = await self.session.scalar(
                select(Contact).where(Contact.id == message.contact_id)
            )
            if contact:
                context["contact_name"] = contact.name
                context["contact_status"] = contact.status.value

        prompt = nemotron_email_draft_prompt(
            context=context,
            tone=tone,
            purpose="Reply to customer inquiry",
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.EMAIL_REPLY,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "message_id": str(message_id),
                "draft": result,
                "tone": tone,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_email_draft(message, tone)

    async def suggest_follow_up(
        self,
        organization_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> dict[str, Any] | None:
        """Suggest follow-up action for an entity."""
        entity_data = await self._fetch_entity_data(organization_id, entity_type, entity_id)
        if not entity_data:
            return None

        # Get last contact
        last_message = await self.session.scalar(
            select(Message)
            .where(Message.organization_id == organization_id)
            .where(
                (Message.contact_id == entity_id if entity_type == "contact" else False)
                | (Message.deal_id == entity_id if entity_type == "deal" else False)
            )
            .order_by(Message.created_at.desc())
        )

        last_contact = None
        if last_message:
            last_contact = {
                "date": last_message.created_at.isoformat() if last_message.created_at else None,
                "channel": last_message.channel.value,
            }

        workspace_context = await self._get_workspace_context(organization_id)

        prompt = nemotron_follow_up_suggestion_prompt(
            entity_type=entity_type,
            entity_data=entity_data,
            last_contact=last_contact,
            workspace_context=workspace_context,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.FOLLOW_UP_SUGGESTION,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "suggestion": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_follow_up(entity_type, entity_data)

    async def prepare_meeting_brief(
        self,
        organization_id: UUID,
        contact_ids: list[UUID],
        deal_ids: list[UUID] | None = None,
        meeting_type: str = "discovery",
    ) -> dict[str, Any] | None:
        """Prepare a meeting brief with attendees and context."""
        attendees = []
        for contact_id in contact_ids:
            contact = await self.session.scalar(
                select(Contact)
                .where(Contact.organization_id == organization_id)
                .where(Contact.id == contact_id)
            )
            if contact:
                attendees.append(
                    {
                        "name": contact.name,
                        "role": "Contact",
                        "status": contact.status.value,
                        "lead_score": contact.lead_score,
                        "tags": contact.tags,
                    }
                )

        related_deals = []
        if deal_ids:
            for deal_id in deal_ids:
                deal = await self.session.scalar(
                    select(Deal)
                    .where(Deal.organization_id == organization_id)
                    .where(Deal.id == deal_id)
                )
                if deal:
                    related_deals.append(
                        {
                            "title": deal.title,
                            "stage": deal.pipeline_stage.value,
                            "amount": float(deal.amount),
                            "probability": deal.probability,
                        }
                    )

        prompt = nemotron_meeting_prep_prompt(
            meeting_type=meeting_type,
            attendees=attendees,
            related_deals=related_deals or None,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.MEETING_PREP,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "meeting_type": meeting_type,
                "attendees": [a["name"] for a in attendees],
                "brief": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_meeting_brief(attendees, meeting_type)

    async def analyze_pipeline(
        self,
        organization_id: UUID,
        timeframe: str = "current quarter",
    ) -> dict[str, Any] | None:
        """Analyze overall pipeline health."""
        # Gather pipeline stats
        deals = await self.session.scalars(
            select(Deal).where(Deal.organization_id == organization_id)
        )
        deals_list = list(deals.all())

        stage_counts = {}
        total_value = 0.0
        weighted_value = 0.0
        for deal in deals_list:
            stage = deal.pipeline_stage.value
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            amount = float(deal.amount)
            total_value += amount
            weighted_value += amount * (deal.probability / 100)

        pipeline_data = {
            "total_deals": len(deals_list),
            "total_value": total_value,
            "weighted_forecast": weighted_value,
            "stage_distribution": stage_counts,
            "timeframe": timeframe,
        }

        prompt = nemotron_pipeline_analysis_prompt(
            pipeline_data=pipeline_data,
            timeframe=timeframe,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.PIPELINE_ANALYSIS,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "organization_id": str(organization_id),
                "pipeline_analysis": result,
                "raw_stats": pipeline_data,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_pipeline_analysis(pipeline_data)

    async def prioritize_tasks(
        self,
        organization_id: UUID,
        user_id: UUID | None = None,
        limit: int = 20,
    ) -> dict[str, Any] | None:
        """Intelligently prioritize tasks."""
        query = (
            select(Task)
            .where(Task.organization_id == organization_id)
            .where(Task.status.in_([TaskStatus.open, TaskStatus.in_progress]))
        )
        if user_id:
            query = query.where(Task.assignee_id == user_id)

        query = query.order_by(Task.due_at.asc()).limit(limit)
        tasks_result = await self.session.scalars(query)
        tasks_list = list(tasks_result.all())

        tasks_data = [
            {
                "id": str(task.id),
                "title": task.title,
                "status": task.status.value,
                "source": task.source.value,
                "due_at": task.due_at.isoformat() if task.due_at else None,
                "priority": task.priority if hasattr(task, "priority") else "normal",
            }
            for task in tasks_list
        ]

        user_context = {"user_id": str(user_id)} if user_id else {}

        prompt = nemotron_task_prioritization_prompt(
            tasks=tasks_data,
            user_context=user_context,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.TASK_PRIORITIZATION,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "task_count": len(tasks_list),
                "prioritization": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_task_prioritization(tasks_list)

    async def generate_summary(
        self,
        organization_id: UUID,
        summary_type: str,
        entity_ids: list[UUID] | None = None,
        focus_areas: list[str] | None = None,
    ) -> dict[str, Any] | None:
        """Generate smart summaries of CRM data."""
        data = {}

        if summary_type == "deals":
            if entity_ids:
                deals = await self.session.scalars(
                    select(Deal)
                    .where(Deal.organization_id == organization_id)
                    .where(Deal.id.in_(entity_ids))
                )
            else:
                deals = await self.session.scalars(
                    select(Deal).where(Deal.organization_id == organization_id).limit(10)
                )
            data["deals"] = [
                {
                    "title": d.title,
                    "stage": d.pipeline_stage.value,
                    "amount": float(d.amount),
                }
                for d in deals.all()
            ]

        elif summary_type == "contacts":
            if entity_ids:
                contacts = await self.session.scalars(
                    select(Contact)
                    .where(Contact.organization_id == organization_id)
                    .where(Contact.id.in_(entity_ids))
                )
            else:
                contacts = await self.session.scalars(
                    select(Contact).where(Contact.organization_id == organization_id).limit(10)
                )
            data["contacts"] = [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "lead_score": c.lead_score,
                }
                for c in contacts.all()
            ]

        prompt = nemotron_summary_generation_prompt(
            summary_type=summary_type,
            data=data,
            focus_areas=focus_areas,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.SUMMARY_GENERATION,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "summary_type": summary_type,
                "summary": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_summary(summary_type, data)

    async def suggest_automation(
        self,
        workflow_description: str,
        organization_id: UUID | None = None,
    ) -> dict[str, Any] | None:
        """Suggest automation improvements."""
        current_process = {}
        if organization_id:
            # Get current stats to inform suggestions
            task_count = await self.session.scalar(
                select(func.count(Task.id)).where(Task.organization_id == organization_id)
            )
            deal_count = await self.session.scalar(
                select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
            )
            current_process = {
                "total_tasks": task_count or 0,
                "total_deals": deal_count or 0,
            }

        prompt = nemotron_automation_advice_prompt(
            workflow_description=workflow_description,
            current_process=current_process or None,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.AUTOMATION_ADVICE,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "workflow": workflow_description,
                "automation_suggestions": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return self._fallback_automation(workflow_description)

    async def execute_multitask(
        self,
        tasks: list[dict[str, Any]],
        organization_id: UUID,
    ) -> dict[str, Any] | None:
        """Execute multiple CRM tasks efficiently."""
        shared_context = await self._get_workspace_context(organization_id)

        prompt = nemotron_multitask_prompt(
            tasks=tasks,
            shared_context=shared_context,
        )

        result = await self._complete_with_nemotron(
            prompt=prompt,
            task_type=NemotronTaskType.GENERAL_CHAT,
            expect_json=True,
        )

        if result and isinstance(result, dict):
            return {
                "task_count": len(tasks),
                "results": result,
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }

        return None

    async def _fetch_entity_data(
        self,
        organization_id: UUID,
        entity_type: str,
        entity_id: UUID,
    ) -> dict[str, Any] | None:
        """Fetch data for a specific entity."""
        if entity_type == "contact":
            contact = await self.session.scalar(
                select(Contact)
                .where(Contact.organization_id == organization_id)
                .where(Contact.id == entity_id)
            )
            if contact:
                return {
                    "name": contact.name,
                    "status": contact.status.value,
                    "lead_score": contact.lead_score,
                    "tags": contact.tags,
                }

        elif entity_type == "deal":
            deal = await self.session.scalar(
                select(Deal)
                .where(Deal.organization_id == organization_id)
                .where(Deal.id == entity_id)
            )
            if deal:
                return {
                    "title": deal.title,
                    "stage": deal.pipeline_stage.value,
                    "amount": float(deal.amount),
                    "probability": deal.probability,
                }

        return None

    async def _get_workspace_context(self, organization_id: UUID) -> dict[str, Any]:
        """Get high-level workspace context."""
        companies = await self.session.scalar(
            select(func.count(Company.id)).where(Company.organization_id == organization_id)
        )
        contacts = await self.session.scalar(
            select(func.count(Contact.id)).where(Contact.organization_id == organization_id)
        )
        deals = await self.session.scalar(
            select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
        )
        tasks = await self.session.scalar(
            select(func.count(Task.id)).where(Task.organization_id == organization_id)
        )

        return {
            "companies": companies or 0,
            "contacts": contacts or 0,
            "deals": deals or 0,
            "tasks": tasks or 0,
        }

    # Fallback methods for when LLM is unavailable
    def _fallback_contact_analysis(
        self,
        contact: Contact,
        interactions: list[dict],
    ) -> dict[str, Any]:
        """Provide basic contact analysis without LLM."""
        engagement = (
            "high" if len(interactions) > 3 else "medium" if len(interactions) > 0 else "low"
        )
        lead_quality = (
            "hot" if contact.lead_score > 70 else "warm" if contact.lead_score > 40 else "cold"
        )

        return {
            "contact_id": str(contact.id),
            "analysis": {
                "engagement_level": engagement,
                "lead_quality": lead_quality,
                "next_best_action": "Schedule follow-up call",
                "risk_factors": ["No recent activity"] if not interactions else [],
                "opportunity_signals": [f"Lead score: {contact.lead_score}"],
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_deal_analysis(
        self,
        deal: Deal,
        contact: Contact | None,
    ) -> dict[str, Any]:
        """Provide basic deal analysis without LLM."""
        stage_values = {
            "lead": 10,
            "qualified": 35,
            "proposal": 60,
            "negotiation": 80,
            "closed_won": 100,
        }
        expected_prob = stage_values.get(deal.pipeline_stage.value, 30)

        return {
            "deal_id": str(deal.id),
            "analysis": {
                "health_score": min(deal.probability + 20, 100),
                "stage_confidence": "medium",
                "key_blockers": [],
                "acceleration_opportunities": ["Follow up within 24 hours"],
                "recommended_next_steps": ["Schedule demo", "Send proposal"],
                "close_probability": expected_prob,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_email_draft(
        self,
        message: Message,
        tone: str,
    ) -> dict[str, Any]:
        """Provide basic email draft without LLM."""
        return {
            "message_id": str(message.id),
            "draft": {
                "subject": f"Re: {message.subject or 'Your message'}",
                "body": "Thank you for reaching out. I'll get back to you shortly with more information.",
                "tone_check": tone,
                "cta": "Let me know if you have any questions",
                "follow_up_needed": True,
            },
            "tone": tone,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_follow_up(
        self,
        entity_type: str,
        entity_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Provide basic follow-up suggestion without LLM."""
        return {
            "entity_type": entity_type,
            "entity_id": entity_data.get("id", "unknown"),
            "suggestion": {
                "suggested_action": "Send follow-up email",
                "timing": "within 24 hours",
                "channel": "email",
                "message_template": "Hi, just following up on our previous conversation.",
                "priority_score": 7,
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_meeting_brief(
        self,
        attendees: list[dict],
        meeting_type: str,
    ) -> dict[str, Any]:
        """Provide basic meeting brief without LLM."""
        return {
            "meeting_type": meeting_type,
            "attendees": [a.get("name", "Unknown") for a in attendees],
            "brief": {
                "attendee_insights": [
                    {"name": a.get("name"), "notes": "Key contact"} for a in attendees
                ],
                "talking_points": ["Review current status", "Discuss next steps"],
                "objection_handling": [],
                "desired_outcomes": ["Clear next steps", "Agreement on timeline"],
                "materials_needed": ["Deal summary", "Product demo"],
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_pipeline_analysis(
        self,
        pipeline_data: dict[str, Any],
    ) -> dict[str, Any]:
        """Provide basic pipeline analysis without LLM."""
        total_deals = pipeline_data.get("total_deals", 0)
        health = "healthy" if total_deals > 10 else "at-risk" if total_deals > 5 else "concerning"

        return {
            "pipeline_analysis": {
                "overall_health": health,
                "stage_distribution": pipeline_data.get("stage_distribution", {}),
                "velocity_concerns": [],
                "win_rate_trends": "stable",
                "revenue_forecast": pipeline_data.get("weighted_forecast", 0),
                "action_items": [
                    "Focus on deals in proposal stage",
                    "Follow up with qualified leads",
                ],
            },
            "raw_stats": pipeline_data,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_task_prioritization(
        self,
        tasks: list[Task],
    ) -> dict[str, Any]:
        """Provide basic task prioritization without LLM."""
        return {
            "task_count": len(tasks),
            "prioritization": {
                "prioritized_order": [str(task.id) for task in tasks],
                "priority_rationale": "Sorted by due date",
                "time_estimates": {},
                "batch_suggestions": [],
                "delegation_candidates": [],
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_summary(
        self,
        summary_type: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Provide basic summary without LLM."""
        count = len(data.get("deals", []) or data.get("contacts", []))
        return {
            "summary_type": summary_type,
            "summary": {
                "headline": f"Summary of {count} {summary_type}",
                "key_points": [f"Total {summary_type}: {count}"],
                "trends": [],
                "anomalies": [],
                "recommendations": ["Review details for more insights"],
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def _fallback_automation(
        self,
        workflow_description: str,
    ) -> dict[str, Any]:
        """Provide basic automation suggestions without LLM."""
        return {
            "workflow": workflow_description,
            "automation_suggestions": {
                "automation_opportunities": [
                    "Task creation from deal stages",
                    "Email notifications",
                ],
                "suggested_rules": [{"trigger": "deal_created", "action": "create_follow_up_task"}],
                "time_savings_estimate": "2-3 hours per week",
                "implementation_complexity": "easy",
                "roi_indicators": ["Reduced manual work", "Faster response times"],
            },
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "fallback",
        }

    def get_capabilities(self) -> dict[str, Any]:
        """Get information about nemotron capabilities."""
        return {
            "model_id": self.model_id,
            "capabilities": NemotronCapabilities.STRENGTHS,
            "optimal_use_cases": NemotronCapabilities.OPTIMAL_USE_CASES,
            "limitations": NemotronCapabilities.LIMITATIONS,
            "config": {
                "context_window": self.config.context_window,
                "max_output_tokens": self.config.max_output_tokens,
                "temperature": self.config.temperature,
            },
        }

    async def _get_crm_context(self, organization_id: UUID) -> dict[str, Any] | None:
        """Get relevant CRM context for the organization."""
        try:
            # Get basic organization stats
            contacts_count = await self.session.scalar(
                select(func.count(Contact.id)).where(Contact.organization_id == organization_id)
            )
            deals_count = await self.session.scalar(
                select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
            )
            active_deals_count = await self.session.scalar(
                select(func.count(Deal.id)).where(
                    Deal.organization_id == organization_id,
                    Deal.stage != DealStage.closed_lost,
                    Deal.stage != DealStage.closed_won
                )
            )

            return {
                "organization_stats": {
                    "total_contacts": contacts_count or 0,
                    "total_deals": deals_count or 0,
                    "active_deals": active_deals_count or 0,
                }
            }
        except Exception as e:
            logger.warning(f"Failed to get CRM context: {e}")
            return None
