from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import LLMClient
from app.ai.prompt_templates import grounded_inbox_prompt
from app.core.config import get_settings
from app.core.telemetry import get_current_span_trace_id, get_request_trace_id, get_tracer
from app.events.dispatcher import EventDispatcher
from app.models.ai_action_execution import AIActionExecution
from app.models.ai_action_proposal import AIActionProposal
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import ContactStatus, DealStage, TaskSource, TaskStatus
from app.models.event import Event
from app.models.message import Message
from app.models.task import Task
from app.schemas.ai import (
    AIActionExecutionRead,
    AIActionProposalRead,
    GroundedEvidenceItem,
    GroundedInboxCopilotRequest,
    GroundedInboxCopilotResponse,
    ProposalDecisionResponse,
)
from app.schemas.automation import AutomationRuleCreate, AutomationRuleUpdate
from app.schemas.company import CompanyCreate, CompanyUpdate
from app.schemas.contact import ContactCreate, ContactUpdate
from app.schemas.deal import DealCreate, DealStageUpdate, DealUpdate
from app.schemas.message import MessageCreate
from app.schemas.project import ProjectConvertFromDeal, ProjectCreate, ProjectUpdate
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.ai_action_registry import (
    ALLOWED_ACTION_TYPES,
    normalize_action_blueprints,
    validate_action_payload,
)
from app.services.automation_service import AutomationService
from app.services.company_service import CompanyService
from app.services.contact_service import ContactService
from app.services.deal_service import DealService
from app.services.message_service import MessageService
from app.services.note_service import NoteService
from app.services.project_service import ProjectService
from app.services.reference_guard import OrganizationReferenceGuard
from app.services.task_service import TaskService

tracer = get_tracer(__name__)

@dataclass
class GroundingSnapshot:
    messages: list[Message]
    contact: Contact | None
    company: Company | None
    deal: Deal | None
    tasks: list[Task]
    events: list[Event]


class GroundedInboxService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.guard = OrganizationReferenceGuard(session)
        self.llm_client = LLMClient()

    async def run_copilot(
        self,
        organization_id: UUID,
        requested_by_user_id: UUID,
        payload: GroundedInboxCopilotRequest,
    ) -> GroundedInboxCopilotResponse:
        trace_id = (
            payload.client_trace_id
            or get_current_span_trace_id()
            or get_request_trace_id()
            or uuid4().hex
        )

        with tracer.start_as_current_span("crm.ai.grounded_inbox") as span:
            span.set_attribute("crm.organization_id", str(organization_id))
            span.set_attribute("crm.thread_id", payload.thread_id)
            span.set_attribute("crm.trace_id", trace_id)

            snapshot = await self._build_snapshot(organization_id, payload)
            evidence = self._build_evidence(snapshot)
            thread_summary = self._build_thread_summary(payload.thread_id, snapshot)
            grounding_payload = self._build_grounding_payload(snapshot)
            content, mode = await self._generate_content(
                prompt=payload.prompt,
                tone=payload.tone,
                thread_summary=thread_summary,
                grounding_payload=grounding_payload,
                model=payload.model,
            )
            proposals = await self._persist_proposals(
                organization_id=organization_id,
                requested_by_user_id=requested_by_user_id,
                trace_id=trace_id,
                payload=payload,
                snapshot=snapshot,
                evidence=evidence,
            )

            span.set_attribute("crm.grounded_messages", len(snapshot.messages))
            span.set_attribute("crm.proposal_count", len(proposals))
            span.set_attribute("crm.ai_mode", mode)

            return GroundedInboxCopilotResponse(
                content=content,
                mode=mode,
                grounding_status="local-llm" if mode == "llm" else "local-fallback",
                trace_id=trace_id,
                evidence=evidence,
                proposed_actions=proposals,
            )

    async def list_proposals(
        self,
        organization_id: UUID,
        *,
        thread_id: str | None = None,
        status_filter: str | None = None,
        limit: int = 25,
    ) -> list[AIActionProposalRead]:
        statement = (
            select(AIActionProposal)
            .where(AIActionProposal.organization_id == organization_id)
            .order_by(AIActionProposal.created_at.desc())
            .limit(limit)
        )
        if thread_id:
            statement = statement.where(AIActionProposal.thread_id == thread_id)
        if status_filter:
            statement = statement.where(AIActionProposal.status == status_filter)

        proposals = list((await self.session.scalars(statement)).all())
        return [AIActionProposalRead.model_validate(proposal) for proposal in proposals]

    async def approve_proposal(
        self,
        organization_id: UUID,
        proposal_id: UUID,
        approved_by_user_id: UUID,
    ) -> ProposalDecisionResponse:
        proposal = await self._get_proposal(organization_id, proposal_id)
        if proposal.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending proposals can be approved.",
            )

        trace_id = get_current_span_trace_id() or get_request_trace_id() or proposal.trace_id
        execution = AIActionExecution(
            proposal_id=proposal.id,
            organization_id=organization_id,
            executed_by_user_id=approved_by_user_id,
            trace_id=trace_id,
            status="approved",
            detail="Proposal approved and queued for execution.",
            result_payload={},
        )
        self.session.add(execution)
        proposal.status = "approved"
        proposal.approved_by_user_id = approved_by_user_id
        proposal.approved_at = datetime.now(timezone.utc)
        await self.session.flush()

        with tracer.start_as_current_span("crm.ai.approve_proposal") as span:
            span.set_attribute("crm.proposal_id", str(proposal.id))
            span.set_attribute("crm.action_type", proposal.action_type)
            span.set_attribute("crm.trace_id", trace_id)

            try:
                result_payload = await self._execute_proposal(
                    organization_id=organization_id,
                    approved_by_user_id=approved_by_user_id,
                    proposal=proposal,
                )
            except HTTPException:
                raise
            except Exception as exc:
                execution.status = "failed"
                execution.detail = str(exc)[:500]
                proposal.status = "failed"
                proposal.last_error = str(exc)[:500]
                await self.session.commit()
                await self.session.refresh(proposal)
                await self.session.refresh(execution)
                return ProposalDecisionResponse(
                    proposal=AIActionProposalRead.model_validate(proposal),
                    execution=AIActionExecutionRead.model_validate(execution),
                )

        execution.status = "executed"
        execution.detail = "Proposal executed."
        execution.result_payload = result_payload
        proposal.status = "executed"
        proposal.executed_at = datetime.now(timezone.utc)
        proposal.last_error = None
        await self.session.commit()
        await self.session.refresh(proposal)
        await self.session.refresh(execution)
        await EventDispatcher(self.session).process_pending_events(limit=100)

        return ProposalDecisionResponse(
            proposal=AIActionProposalRead.model_validate(proposal),
            execution=AIActionExecutionRead.model_validate(execution),
        )

    async def reject_proposal(
        self,
        organization_id: UUID,
        proposal_id: UUID,
        rejected_by_user_id: UUID,
        *,
        reason: str | None = None,
    ) -> ProposalDecisionResponse:
        proposal = await self._get_proposal(organization_id, proposal_id)
        if proposal.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only pending proposals can be rejected.",
            )

        proposal.status = "rejected"
        proposal.rejected_by_user_id = rejected_by_user_id
        proposal.rejected_at = datetime.now(timezone.utc)
        proposal.rejection_reason = reason
        await self.session.commit()
        await self.session.refresh(proposal)
        return ProposalDecisionResponse(proposal=AIActionProposalRead.model_validate(proposal))

    async def _build_snapshot(
        self,
        organization_id: UUID,
        payload: GroundedInboxCopilotRequest,
    ) -> GroundingSnapshot:
        messages = await self._load_messages(organization_id, payload)
        latest_message = messages[-1] if messages else None

        contact_id = payload.contact_id or (latest_message.contact_id if latest_message else None)
        deal_id = payload.deal_id or (latest_message.deal_id if latest_message else None)

        contact = await self.guard.ensure_contact(organization_id, contact_id, field_name="contact_id")
        deal = await self.guard.ensure_deal(organization_id, deal_id, field_name="deal_id")
        company = None
        if contact and contact.company_id:
            company = await self.guard.ensure_company(
                organization_id,
                contact.company_id,
                field_name="company_id",
            )

        tasks_statement = (
            select(Task)
            .where(Task.organization_id == organization_id)
            .order_by(Task.created_at.desc())
            .limit(8)
        )
        task_filters = []
        if payload.task_ids:
            task_filters.append(Task.id.in_(payload.task_ids))
        if deal_id:
            task_filters.append(Task.deal_id == deal_id)
        if contact_id:
            task_filters.append(Task.contact_id == contact_id)
        if task_filters:
            tasks_statement = tasks_statement.where(or_(*task_filters))
        tasks = list((await self.session.scalars(tasks_statement)).all())

        message_ids = [str(message.id) for message in messages]
        event_filters = []
        if message_ids:
            event_filters.append(
                (Event.entity_type == "message") & (Event.entity_id.in_(message_ids))
            )
        if contact_id:
            event_filters.append(
                (Event.entity_type == "contact") & (Event.entity_id == str(contact_id))
            )
        if deal_id:
            event_filters.append((Event.entity_type == "deal") & (Event.entity_id == str(deal_id)))
        events_statement = (
            select(Event)
            .where(Event.organization_id == organization_id)
            .order_by(Event.created_at.desc())
            .limit(6)
        )
        if event_filters:
            events_statement = events_statement.where(or_(*event_filters))
        events = list((await self.session.scalars(events_statement)).all())

        return GroundingSnapshot(
            messages=messages,
            contact=contact,
            company=company,
            deal=deal,
            tasks=tasks,
            events=events,
        )

    async def _load_messages(
        self,
        organization_id: UUID,
        payload: GroundedInboxCopilotRequest,
    ) -> list[Message]:
        statement = (
            select(Message)
            .where(Message.organization_id == organization_id)
            .order_by(Message.created_at.asc())
        )
        if payload.message_ids:
            statement = statement.where(Message.id.in_(payload.message_ids))
        elif payload.contact_id:
            statement = statement.where(Message.contact_id == payload.contact_id).limit(12)
        elif payload.deal_id:
            statement = statement.where(Message.deal_id == payload.deal_id).limit(12)
        else:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Grounded inbox copilot requires at least one message, contact, or deal reference.",
            )

        messages = list((await self.session.scalars(statement)).all())
        if not messages:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No live messages were found for the selected inbox thread.",
            )
        return messages

    def _build_thread_summary(self, thread_id: str, snapshot: GroundingSnapshot) -> dict[str, Any]:
        latest = snapshot.messages[-1]
        return {
            "thread_id": thread_id,
            "message_count": len(snapshot.messages),
            "latest_direction": latest.direction.value,
            "latest_channel": latest.channel.value,
            "latest_subject": latest.subject,
            "participant": snapshot.contact.name if snapshot.contact else "CRM contact",
            "deal_title": snapshot.deal.title if snapshot.deal else None,
        }

    def _build_grounding_payload(self, snapshot: GroundingSnapshot) -> dict[str, Any]:
        return {
            "messages": [
                {
                    "id": str(message.id),
                    "direction": message.direction.value,
                    "channel": message.channel.value,
                    "subject": message.subject,
                    "body": message.body[:600],
                    "created_at": message.created_at.isoformat(),
                }
                for message in snapshot.messages[-8:]
            ],
            "contact": (
                {
                    "id": str(snapshot.contact.id),
                    "name": snapshot.contact.name,
                    "status": snapshot.contact.status.value,
                    "lead_score": snapshot.contact.lead_score,
                    "tags": snapshot.contact.tags,
                }
                if snapshot.contact
                else None
            ),
            "company": (
                {
                    "id": str(snapshot.company.id),
                    "name": snapshot.company.name,
                    "industry": snapshot.company.industry,
                    "domain": snapshot.company.domain,
                }
                if snapshot.company
                else None
            ),
            "deal": (
                {
                    "id": str(snapshot.deal.id),
                    "title": snapshot.deal.title,
                    "stage": snapshot.deal.pipeline_stage.value,
                    "amount": float(snapshot.deal.amount),
                    "currency": snapshot.deal.currency,
                    "probability": snapshot.deal.probability,
                }
                if snapshot.deal
                else None
            ),
            "tasks": [
                {
                    "id": str(task.id),
                    "title": task.title,
                    "status": task.status.value,
                    "due_at": task.due_at.isoformat() if task.due_at else None,
                    "source": task.source.value,
                }
                for task in snapshot.tasks[:6]
            ],
            "events": [
                {
                    "event_type": event.event_type,
                    "entity_type": event.entity_type,
                    "entity_id": event.entity_id,
                    "created_at": event.created_at.isoformat(),
                }
                for event in snapshot.events
            ],
        }

    def _build_evidence(self, snapshot: GroundingSnapshot) -> list[GroundedEvidenceItem]:
        evidence: list[GroundedEvidenceItem] = []
        for message in snapshot.messages[-5:]:
            evidence.append(
                GroundedEvidenceItem(
                    id=f"message:{message.id}",
                    entity_type="message",
                    entity_id=str(message.id),
                    title=message.subject or f"{message.channel.value} {message.direction.value}",
                    snippet=message.body[:220],
                    source="thread-message",
                )
            )

        if snapshot.contact:
            evidence.append(
                GroundedEvidenceItem(
                    id=f"contact:{snapshot.contact.id}",
                    entity_type="contact",
                    entity_id=str(snapshot.contact.id),
                    title=snapshot.contact.name,
                    snippet=(
                        f"Status {snapshot.contact.status.value}, "
                        f"lead score {snapshot.contact.lead_score:.0f}, "
                        f"tags: {', '.join(snapshot.contact.tags) or 'none'}."
                    ),
                    source="crm-contact",
                )
            )

        if snapshot.deal:
            evidence.append(
                GroundedEvidenceItem(
                    id=f"deal:{snapshot.deal.id}",
                    entity_type="deal",
                    entity_id=str(snapshot.deal.id),
                    title=snapshot.deal.title,
                    snippet=(
                        f"Stage {snapshot.deal.pipeline_stage.value}, "
                        f"probability {snapshot.deal.probability:.0f}, "
                        f"value {float(snapshot.deal.amount):.2f} {snapshot.deal.currency}."
                    ),
                    source="crm-deal",
                )
            )

        for task in snapshot.tasks[:3]:
            evidence.append(
                GroundedEvidenceItem(
                    id=f"task:{task.id}",
                    entity_type="task",
                    entity_id=str(task.id),
                    title=task.title,
                    snippet=f"Status {task.status.value}. Due {task.due_at.isoformat() if task.due_at else 'not set'}.",
                    source="crm-task",
                )
            )

        return evidence

    async def _generate_content(
        self,
        *,
        prompt: str,
        tone: str,
        thread_summary: dict[str, Any],
        grounding_payload: dict[str, Any],
        model: str | None,
    ) -> tuple[str, str]:
        default_model = self.settings.llm_model_chat or self.settings.llm_model
        if self.llm_client.enabled:
            try:
                content = await self.llm_client.complete_text(
                    grounded_inbox_prompt(prompt, tone, thread_summary, grounding_payload),
                    model=model or default_model,
                )
            except Exception:
                content = None
            if content:
                return content.strip(), "llm"

        return self.build_fallback_content(prompt, thread_summary, grounding_payload), "fallback"

    @staticmethod
    def build_fallback_content(
        prompt: str,
        thread_summary: dict[str, Any],
        grounding_payload: dict[str, Any],
    ) -> str:
        prompt_lower = prompt.lower()
        latest_message = (grounding_payload.get("messages") or [{}])[-1]
        latest_body = str(latest_message.get("body") or "").strip()
        participant = thread_summary.get("participant") or "the contact"
        deal_title = thread_summary.get("deal_title") or "the current opportunity"
        deal = grounding_payload.get("deal") or {}
        tasks = grounding_payload.get("tasks") or []

        if "reply" in prompt_lower or "draft" in prompt_lower:
            return (
                f"Hi {participant.split(' ')[0]}, thanks for the update. I reviewed the latest thread "
                f"about {deal_title} and the clearest next step is to confirm timing and any open "
                "questions today. If helpful, I can send a brief recap and lock the follow-up."
            )

        if "summary" in prompt_lower or "summarize" in prompt_lower:
            return (
                f"{participant} is discussing {deal_title}. "
                f"The latest signal is: '{latest_body[:120] or 'No recent message text was available.'}' "
                f"There are {len(tasks)} related open tasks in the current CRM view, so the safest move is "
                "to capture the next step explicitly and keep the thread active."
            )

        if "next" in prompt_lower or "action" in prompt_lower:
            return (
                f"The next best move is to follow up with {participant}, create a tracked task, "
                f"and keep {deal_title} moving without losing the message context."
            )

        return (
            f"{participant} is active in the inbox and tied to {deal_title}. "
            "Use the latest message to confirm intent, capture the next step, and keep the CRM record current."
        )

    async def _persist_proposals(
        self,
        *,
        organization_id: UUID,
        requested_by_user_id: UUID,
        trace_id: str,
        payload: GroundedInboxCopilotRequest,
        snapshot: GroundingSnapshot,
        evidence: list[GroundedEvidenceItem],
    ) -> list[AIActionProposalRead]:
        raw_blueprints = self.suggest_action_plans(
            requested_by_user_id=requested_by_user_id,
            thread_id=payload.thread_id,
            prompt=payload.prompt,
            snapshot=snapshot,
            evidence=evidence,
        )
        blueprints, _ = normalize_action_blueprints(raw_blueprints)
        proposals: list[AIActionProposalRead] = []

        for blueprint in blueprints:
            existing = await self.session.scalar(
                select(AIActionProposal)
                .where(AIActionProposal.organization_id == organization_id)
                .where(AIActionProposal.thread_id == payload.thread_id)
                .where(AIActionProposal.action_type == blueprint["action_type"])
                .where(AIActionProposal.status == "pending")
                .where(AIActionProposal.title == blueprint["title"])
                .order_by(AIActionProposal.created_at.desc())
            )
            if existing is not None:
                proposals.append(AIActionProposalRead.model_validate(existing))
                continue

            proposal = AIActionProposal(
                organization_id=organization_id,
                requested_by_user_id=requested_by_user_id,
                thread_id=payload.thread_id,
                trace_id=trace_id,
                action_type=blueprint["action_type"],
                status="pending",
                title=blueprint["title"],
                detail=blueprint.get("detail"),
                reasoning=blueprint.get("reasoning"),
                target_entity_type=blueprint.get("target_entity_type"),
                target_entity_id=blueprint.get("target_entity_id"),
                action_payload=blueprint.get("action_payload", {}),
                diff_payload=blueprint.get("diff_payload", {}),
                evidence=[
                    item.model_dump(mode="json")
                    if isinstance(item, GroundedEvidenceItem)
                    else dict(item)
                    for item in blueprint.get("evidence", [])
                ],
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
            self.session.add(proposal)
            await self.session.flush()
            proposals.append(AIActionProposalRead.model_validate(proposal))

        await self.session.commit()
        return proposals

    @staticmethod
    def suggest_action_plans(
        *,
        requested_by_user_id: UUID,
        thread_id: str,
        prompt: str,
        snapshot: GroundingSnapshot,
        evidence: list[GroundedEvidenceItem],
    ) -> list[dict[str, Any]]:
        latest_message = snapshot.messages[-1]
        latest_body = latest_message.body.lower()
        action_plans: list[dict[str, Any]] = []
        prompt_lower = prompt.lower()
        evidence_slice = evidence[:3]

        has_open_follow_up = any(
            task.status in {TaskStatus.open, TaskStatus.in_progress} for task in snapshot.tasks
        )
        if latest_message.direction.value == "inbound" and not has_open_follow_up:
            due_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            task_title = (
                f"Follow up {snapshot.contact.name}"
                if snapshot.contact
                else "Follow up inbox thread"
            )
            action_plans.append(
                {
                    "action_type": "create_follow_up_task",
                    "title": f"Create follow-up task for {snapshot.contact.name if snapshot.contact else thread_id}",
                    "detail": "Capture the next reply window as a tracked CRM task.",
                    "reasoning": "The latest inbound message does not have an active follow-up task yet.",
                    "target_entity_type": "task",
                    "target_entity_id": None,
                    "action_payload": {
                        "contact_id": str(snapshot.contact.id) if snapshot.contact else None,
                        "deal_id": str(snapshot.deal.id) if snapshot.deal else None,
                        "assignee_id": str(requested_by_user_id),
                        "title": task_title,
                        "description": "Created from the grounded inbox copilot review.",
                        "status": "open",
                        "due_at": due_at,
                        "source": TaskSource.automation.value,
                    },
                    "diff_payload": {
                        "before": None,
                        "after": {
                            "title": task_title,
                            "status": "open",
                            "due_at": due_at,
                        },
                    },
                    "evidence": evidence_slice,
                }
            )

        if snapshot.contact and snapshot.contact.status == ContactStatus.lead and any(
            keyword in latest_body for keyword in ("proposal", "pricing", "contract", "call", "demo", "timeline")
        ):
            next_tags = sorted(set([*snapshot.contact.tags, "engaged"]))
            action_plans.append(
                {
                    "action_type": "update_contact",
                    "title": f"Promote {snapshot.contact.name} to active",
                    "detail": "Mark the contact as engaged and add an `engaged` tag.",
                    "reasoning": "The latest thread shows active buying or scheduling intent.",
                    "target_entity_type": "contact",
                    "target_entity_id": str(snapshot.contact.id),
                    "action_payload": {
                        "contact_id": str(snapshot.contact.id),
                        "status": ContactStatus.active.value,
                        "tags": next_tags,
                    },
                    "diff_payload": {
                        "before": {
                            "status": snapshot.contact.status.value,
                            "tags": snapshot.contact.tags,
                        },
                        "after": {
                            "status": ContactStatus.active.value,
                            "tags": next_tags,
                        },
                    },
                    "evidence": evidence_slice,
                }
            )

        if snapshot.deal:
            next_stage = None
            next_probability = None
            if any(keyword in latest_body for keyword in ("contract", "legal", "final review")):
                next_stage = DealStage.negotiation
                next_probability = max(snapshot.deal.probability, 80)
            elif any(keyword in latest_body for keyword in ("proposal", "pricing", "quote")):
                next_stage = DealStage.proposal
                next_probability = max(snapshot.deal.probability, 70)
            elif any(keyword in latest_body for keyword in ("demo", "call", "interested")):
                next_stage = DealStage.qualified
                next_probability = max(snapshot.deal.probability, 55)

            if next_stage and (
                next_stage != snapshot.deal.pipeline_stage
                or (next_probability is not None and next_probability > snapshot.deal.probability)
            ):
                action_plans.append(
                    {
                        "action_type": "update_deal",
                        "title": f"Refresh {snapshot.deal.title} stage and probability",
                        "detail": "Adjust the deal to match the latest inbox signal.",
                        "reasoning": "The latest thread suggests the opportunity is further along than the current record.",
                        "target_entity_type": "deal",
                        "target_entity_id": str(snapshot.deal.id),
                        "action_payload": {
                            "deal_id": str(snapshot.deal.id),
                            "pipeline_stage": next_stage.value,
                            "probability": next_probability,
                        },
                        "diff_payload": {
                            "before": {
                                "pipeline_stage": snapshot.deal.pipeline_stage.value,
                                "probability": snapshot.deal.probability,
                            },
                            "after": {
                                "pipeline_stage": next_stage.value,
                                "probability": next_probability,
                            },
                        },
                        "evidence": evidence_slice,
                    }
                )

        if "note" in prompt_lower or "summary" in prompt_lower:
            note_body = (
                f"Grounded inbox summary for {snapshot.contact.name if snapshot.contact else thread_id}: "
                f"{latest_message.body[:220]}"
            )
            action_plans.append(
                {
                    "action_type": "add_internal_note",
                    "title": "Capture an internal note from the current thread",
                    "detail": "Store a concise internal note so the latest context is visible later.",
                    "reasoning": "The operator asked for a summary-style action and the thread contains a clear customer signal.",
                    "target_entity_type": "deal" if snapshot.deal else "contact" if snapshot.contact else "message",
                    "target_entity_id": (
                        str(snapshot.deal.id)
                        if snapshot.deal
                        else str(snapshot.contact.id)
                        if snapshot.contact
                        else str(latest_message.id)
                    ),
                    "action_payload": {
                        "entity_type": "deal" if snapshot.deal else "contact" if snapshot.contact else "message",
                        "entity_id": (
                            str(snapshot.deal.id)
                            if snapshot.deal
                            else str(snapshot.contact.id)
                            if snapshot.contact
                            else str(latest_message.id)
                        ),
                        "body": note_body,
                    },
                    "diff_payload": {
                        "before": None,
                        "after": {
                            "body": note_body,
                        },
                    },
                    "evidence": evidence_slice,
                }
            )

        normalized, _ = normalize_action_blueprints(action_plans)
        return [item for item in normalized if item["action_type"] in ALLOWED_ACTION_TYPES][:4]

    async def _get_proposal(self, organization_id: UUID, proposal_id: UUID) -> AIActionProposal:
        proposal = await self.session.scalar(
            select(AIActionProposal)
            .where(AIActionProposal.organization_id == organization_id)
            .where(AIActionProposal.id == proposal_id)
        )
        if proposal is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found.")
        return proposal

    async def _execute_proposal(
        self,
        *,
        organization_id: UUID,
        approved_by_user_id: UUID,
        proposal: AIActionProposal,
    ) -> dict[str, Any]:
        action_type = proposal.action_type.strip().lower()
        try:
            payload = validate_action_payload(action_type, proposal.action_payload or {})
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid action payload for '{action_type}': {exc}",
            ) from exc

        if action_type == "create_follow_up_task":
            task = await TaskService(self.session).create_task(
                organization_id,
                TaskCreate.model_validate(payload),
                commit=False,
            )
            return {
                "task_id": str(task.id),
                "title": task.title,
            }

        if action_type == "update_contact":
            contact_id = UUID(str(payload["contact_id"]))
            updates = {key: value for key, value in payload.items() if key != "contact_id"}
            contact = await ContactService(self.session).update_contact(
                organization_id,
                contact_id,
                ContactUpdate.model_validate(updates),
                commit=False,
            )
            return {
                "contact_id": str(contact.id),
                "status": contact.status.value,
                "tags": contact.tags,
            }

        if action_type == "create_company":
            company = await CompanyService(self.session).create_company(
                organization_id,
                CompanyCreate.model_validate(payload),
            )
            return {
                "company_id": str(company.id),
                "name": company.name,
            }

        if action_type == "update_company":
            company_id = UUID(str(payload["company_id"]))
            updates = {key: value for key, value in payload.items() if key != "company_id"}
            company = await CompanyService(self.session).update_company(
                organization_id,
                company_id,
                CompanyUpdate.model_validate(updates),
            )
            return {
                "company_id": str(company.id),
                "name": company.name,
            }

        if action_type == "create_contact":
            contact = await ContactService(self.session).create_contact(
                organization_id,
                ContactCreate.model_validate(payload),
            )
            return {
                "contact_id": str(contact.id),
                "name": contact.name,
                "status": contact.status.value,
            }

        if action_type == "update_deal":
            deal_id = UUID(str(payload["deal_id"]))
            updates = {key: value for key, value in payload.items() if key != "deal_id"}
            if set(updates.keys()).issubset({"pipeline_stage", "probability"}):
                deal = await DealService(self.session).update_stage(
                    organization_id,
                    deal_id,
                    DealStageUpdate.model_validate(updates),
                    commit=False,
                )
            else:
                deal = await DealService(self.session).update_deal(
                    organization_id,
                    deal_id,
                    DealUpdate.model_validate(updates),
                    commit=False,
                )
            return {
                "deal_id": str(deal.id),
                "pipeline_stage": deal.pipeline_stage.value,
                "probability": deal.probability,
            }

        if action_type == "create_deal":
            deal = await DealService(self.session).create_deal(
                organization_id,
                DealCreate.model_validate(payload),
            )
            return {
                "deal_id": str(deal.id),
                "pipeline_stage": deal.pipeline_stage.value,
            }

        if action_type == "create_message":
            message = await MessageService(self.session).create_message(
                organization_id,
                MessageCreate.model_validate(payload),
            )
            return {
                "message_id": str(message.id),
                "direction": message.direction.value,
                "channel": message.channel.value,
            }

        if action_type == "create_task":
            task = await TaskService(self.session).create_task(
                organization_id,
                TaskCreate.model_validate(payload),
                commit=False,
            )
            return {
                "task_id": str(task.id),
                "title": task.title,
                "status": task.status.value,
            }

        if action_type == "update_task":
            task_id = UUID(str(payload["task_id"]))
            updates = {key: value for key, value in payload.items() if key != "task_id"}
            task = await TaskService(self.session).update_task(
                organization_id,
                task_id,
                TaskUpdate.model_validate(updates),
            )
            return {
                "task_id": str(task.id),
                "status": task.status.value,
            }

        if action_type == "create_project":
            project = await ProjectService(self.session).create_project(
                organization_id,
                ProjectCreate.model_validate(payload),
            )
            return {
                "project_id": str(project.id),
                "status": project.status.value,
            }

        if action_type == "update_project":
            project_id = UUID(str(payload["project_id"]))
            updates = {key: value for key, value in payload.items() if key != "project_id"}
            project = await ProjectService(self.session).update_project(
                organization_id,
                project_id,
                ProjectUpdate.model_validate(updates),
            )
            return {
                "project_id": str(project.id),
                "status": project.status.value,
            }

        if action_type == "convert_deal_to_project":
            deal_id = UUID(str(payload["deal_id"]))
            updates = {key: value for key, value in payload.items() if key != "deal_id"}
            project = await ProjectService(self.session).convert_from_deal(
                organization_id,
                deal_id,
                ProjectConvertFromDeal.model_validate(updates),
            )
            return {
                "project_id": str(project.id),
                "deal_id": str(project.deal_id),
                "status": project.status.value,
            }

        if action_type == "create_automation_rule":
            rule = await AutomationService(self.session).create_rule(
                organization_id,
                AutomationRuleCreate.model_validate(payload),
            )
            return {
                "rule_id": str(rule.id),
                "name": rule.name,
                "is_active": rule.is_active,
            }

        if action_type == "update_automation_rule":
            rule_id = UUID(str(payload["rule_id"]))
            updates = {key: value for key, value in payload.items() if key != "rule_id"}
            rule = await AutomationService(self.session).update_rule(
                organization_id,
                rule_id,
                AutomationRuleUpdate.model_validate(updates),
            )
            return {
                "rule_id": str(rule.id),
                "name": rule.name,
                "is_active": rule.is_active,
            }

        if action_type == "add_internal_note":
            note = await NoteService(self.session).create_note(
                organization_id,
                entity_type=str(payload["entity_type"]),
                entity_id=str(payload["entity_id"]),
                body=str(payload["body"]),
                author_user_id=approved_by_user_id,
                payload_meta={"source": "grounded-inbox-copilot"},
                commit=False,
            )
            return {
                "note_id": str(note.id),
                "entity_type": note.entity_type,
                "entity_id": note.entity_id,
            }

        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported proposal action '{action_type}'.",
        )
