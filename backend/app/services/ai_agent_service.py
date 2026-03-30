from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.llm_client import LLMClient
from app.ai.prompt_templates import crm_operator_prompt
from app.core.config import get_settings
from app.core.telemetry import get_current_span_trace_id, get_request_trace_id
from app.events.dispatcher import EventDispatcher
from app.events.event_types import EventTypes
from app.models.ai_action_proposal import AIActionProposal
from app.models.ai_agent_run import AIAgentRun
from app.models.automation_rule import AutomationRule
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.enums import (
    DealStage,
    EventSource,
    MessageChannel,
    MessageDirection,
    TaskSource,
)
from app.models.message import Message
from app.models.project import Project
from app.models.task import Task
from app.schemas.ai import AgentRunRequest, AgentSelectionContext, GroundedEvidenceItem
from app.services.ai_action_registry import normalize_action_blueprints


class AIAgentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.settings = get_settings()
        self.llm_client = LLMClient()

    async def run_sync(
        self,
        organization_id: UUID,
        requested_by_user_id: UUID,
        payload: AgentRunRequest,
    ) -> tuple[AIAgentRun, list[AIActionProposal]]:
        trace_id = (
            payload.client_trace_id
            or get_current_span_trace_id()
            or get_request_trace_id()
            or uuid4().hex
        )
        run = AIAgentRun(
            organization_id=organization_id,
            requested_by_user_id=requested_by_user_id,
            trace_id=trace_id,
            status="running",
            run_kind="sync",
            prompt=payload.prompt,
            tone=payload.tone,
            page=payload.page or payload.selection.page,
            route=payload.selection.route,
            model=payload.model,
            selection_context=payload.selection.model_dump(mode="json"),
            context_snapshot={"input_context": payload.context},
            started_at=datetime.now(timezone.utc),
        )
        self.session.add(run)
        await self.session.flush()

        try:
            await self._execute_run_payload(
                run=run,
                organization_id=organization_id,
                requested_by_user_id=requested_by_user_id,
                payload=payload,
            )
        except Exception as exc:
            run.status = "failed"
            run.error_detail = str(exc)[:500]
            run.finished_at = datetime.now(timezone.utc)
            await self.session.commit()
            await self.session.refresh(run)
            return run, []

        await self.session.commit()
        await self.session.refresh(run)
        refreshed_proposals = await self._list_proposals_for_trace(
            organization_id,
            trace_id=run.trace_id,
            limit=50,
        )
        return run, refreshed_proposals

    async def create_async_run(
        self,
        organization_id: UUID,
        requested_by_user_id: UUID,
        payload: AgentRunRequest,
    ) -> AIAgentRun:
        trace_id = (
            payload.client_trace_id
            or get_current_span_trace_id()
            or get_request_trace_id()
            or uuid4().hex
        )
        run = AIAgentRun(
            organization_id=organization_id,
            requested_by_user_id=requested_by_user_id,
            trace_id=trace_id,
            status="queued",
            run_kind="async",
            prompt=payload.prompt,
            tone=payload.tone,
            page=payload.page or payload.selection.page,
            route=payload.selection.route,
            model=payload.model,
            selection_context=payload.selection.model_dump(mode="json"),
            context_snapshot={"input_context": payload.context},
        )
        self.session.add(run)
        await self.session.flush()

        await EventDispatcher(self.session).publish(
            organization_id=organization_id,
            event_type=EventTypes.AI_AGENT_RUN_REQUESTED,
            entity_type="ai_agent_run",
            entity_id=str(run.id),
            payload={
                "run_id": str(run.id),
                "requested_by_user_id": str(requested_by_user_id),
            },
            source=EventSource.ai,
        )
        await self.session.commit()
        await self.session.refresh(run)
        return run

    async def list_runs(
        self,
        organization_id: UUID,
        requested_by_user_id: UUID,
        *,
        limit: int = 25,
    ) -> list[AIAgentRun]:
        records = await self.session.scalars(
            select(AIAgentRun)
            .where(AIAgentRun.organization_id == organization_id)
            .where(AIAgentRun.requested_by_user_id == requested_by_user_id)
            .order_by(AIAgentRun.created_at.desc())
            .limit(limit)
        )
        return list(records.all())

    async def get_run(
        self,
        organization_id: UUID,
        requested_by_user_id: UUID,
        run_id: UUID,
    ) -> AIAgentRun | None:
        return await self.session.scalar(
            select(AIAgentRun)
            .where(AIAgentRun.organization_id == organization_id)
            .where(AIAgentRun.requested_by_user_id == requested_by_user_id)
            .where(AIAgentRun.id == run_id)
        )

    async def execute_queued_run(self, organization_id: UUID, run_id: UUID) -> None:
        run = await self.session.scalar(
            select(AIAgentRun)
            .where(AIAgentRun.organization_id == organization_id)
            .where(AIAgentRun.id == run_id)
        )
        if run is None:
            return
        if run.status not in {"queued", "running"}:
            return

        if run.status == "queued":
            run.status = "running"
            run.started_at = datetime.now(timezone.utc)
            run.error_detail = None
            await self.session.commit()
            await self.session.refresh(run)

        payload = AgentRunRequest(
            prompt=run.prompt,
            tone=run.tone,
            model=run.model,
            page=run.page,
            selection=AgentSelectionContext.model_validate(run.selection_context or {}),
            context=(run.context_snapshot or {}).get("input_context", {}),
            client_trace_id=run.trace_id,
        )

        try:
            await self._execute_run_payload(
                run=run,
                organization_id=organization_id,
                requested_by_user_id=run.requested_by_user_id,
                payload=payload,
            )
        except Exception as exc:
            run.status = "failed"
            run.error_detail = str(exc)[:500]
            run.finished_at = datetime.now(timezone.utc)
            await self.session.commit()
            return

        await self.session.commit()

    async def list_run_proposals(
        self,
        organization_id: UUID,
        trace_id: str,
        *,
        limit: int = 50,
    ) -> list[AIActionProposal]:
        return await self._list_proposals_for_trace(
            organization_id,
            trace_id=trace_id,
            limit=limit,
        )

    async def _execute_run_payload(
        self,
        *,
        run: AIAgentRun,
        organization_id: UUID,
        requested_by_user_id: UUID,
        payload: AgentRunRequest,
    ) -> list[AIActionProposal]:
        context_snapshot = await self._build_context_snapshot(
            organization_id=organization_id,
            payload=payload,
        )
        evidence = self._build_evidence_items(context_snapshot)
        content, mode = await self._generate_content(payload, context_snapshot)
        action_plans = self._suggest_action_plans(
            requested_by_user_id=requested_by_user_id,
            payload=payload,
            context_snapshot=context_snapshot,
            evidence=evidence,
        )
        proposals = await self._persist_proposals(
            organization_id=organization_id,
            requested_by_user_id=requested_by_user_id,
            trace_id=run.trace_id,
            thread_id=f"agent-run:{run.id}",
            action_plans=action_plans,
        )

        run.status = "completed"
        run.output_mode = mode
        run.output_content = content
        run.error_detail = None
        run.evidence = [item.model_dump(mode="json") for item in evidence]
        run.context_snapshot = {
            "input_context": payload.context,
            "resolved_context": context_snapshot,
            "validation_errors": [
                plan.get("validation_error")
                for plan in action_plans
                if plan.get("validation_error")
            ],
        }
        run.finished_at = datetime.now(timezone.utc)
        await self.session.flush()
        return proposals

    async def _build_context_snapshot(
        self,
        *,
        organization_id: UUID,
        payload: AgentRunRequest,
    ) -> dict[str, Any]:
        selected_entities: list[dict[str, Any]] = []
        for item in payload.selection.selected_entities[:24]:
            parsed = await self._resolve_selected_entity(
                organization_id=organization_id,
                entity_type=item.entity_type,
                entity_id=item.entity_id,
            )
            if parsed is not None:
                selected_entities.append(parsed)

        workspace_stats = await self._load_workspace_stats(organization_id)
        return {
            "page": payload.page or payload.selection.page or "unknown",
            "route": payload.selection.route,
            "data_source": payload.selection.data_source,
            "thread_id": payload.selection.thread_id,
            "selected_entities": selected_entities,
            "workspace_stats": workspace_stats,
            "context": payload.context,
        }

    async def _resolve_selected_entity(
        self,
        *,
        organization_id: UUID,
        entity_type: str,
        entity_id: str,
    ) -> dict[str, Any] | None:
        normalized_type = entity_type.strip().lower()
        try:
            entity_uuid = UUID(str(entity_id))
        except ValueError:
            return None

        if normalized_type == "company":
            company = await self.session.scalar(
                select(Company)
                .where(Company.organization_id == organization_id)
                .where(Company.id == entity_uuid)
            )
            if company is None:
                return None
            return {
                "entity_type": "company",
                "entity_id": str(company.id),
                "title": company.name,
                "snippet": f"Industry: {company.industry or 'n/a'}, domain: {company.domain or 'n/a'}.",
            }

        if normalized_type == "contact":
            contact = await self.session.scalar(
                select(Contact)
                .where(Contact.organization_id == organization_id)
                .where(Contact.id == entity_uuid)
            )
            if contact is None:
                return None
            return {
                "entity_type": "contact",
                "entity_id": str(contact.id),
                "title": contact.name,
                "snippet": (
                    f"Status: {contact.status.value}, lead score: {contact.lead_score:.0f}, "
                    f"tags: {', '.join(contact.tags) or 'none'}."
                ),
            }

        if normalized_type == "deal":
            deal = await self.session.scalar(
                select(Deal)
                .where(Deal.organization_id == organization_id)
                .where(Deal.id == entity_uuid)
            )
            if deal is None:
                return None
            return {
                "entity_type": "deal",
                "entity_id": str(deal.id),
                "title": deal.title,
                "snippet": (
                    f"Stage: {deal.pipeline_stage.value}, probability: {deal.probability:.0f}, "
                    f"amount: {float(deal.amount):.2f} {deal.currency}."
                ),
            }

        if normalized_type == "task":
            task = await self.session.scalar(
                select(Task)
                .where(Task.organization_id == organization_id)
                .where(Task.id == entity_uuid)
            )
            if task is None:
                return None
            return {
                "entity_type": "task",
                "entity_id": str(task.id),
                "title": task.title,
                "snippet": (
                    f"Status: {task.status.value}, source: {task.source.value}, "
                    f"due: {task.due_at.isoformat() if task.due_at else 'not set'}."
                ),
            }

        if normalized_type == "project":
            project = await self.session.scalar(
                select(Project)
                .where(Project.organization_id == organization_id)
                .where(Project.id == entity_uuid)
            )
            if project is None:
                return None
            return {
                "entity_type": "project",
                "entity_id": str(project.id),
                "title": project.name,
                "snippet": (
                    f"Status: {project.status.value}, deal: {project.deal_id}, "
                    f"target end: {project.target_end_date or 'not set'}."
                ),
            }

        if normalized_type == "message":
            message = await self.session.scalar(
                select(Message)
                .where(Message.organization_id == organization_id)
                .where(Message.id == entity_uuid)
            )
            if message is None:
                return None
            return {
                "entity_type": "message",
                "entity_id": str(message.id),
                "title": message.subject or f"{message.channel.value} {message.direction.value}",
                "snippet": message.body[:220],
            }

        if normalized_type == "automation_rule":
            rule = await self.session.scalar(
                select(AutomationRule)
                .where(AutomationRule.organization_id == organization_id)
                .where(AutomationRule.id == entity_uuid)
            )
            if rule is None:
                return None
            return {
                "entity_type": "automation_rule",
                "entity_id": str(rule.id),
                "title": rule.name,
                "snippet": (
                    f"Event: {rule.event_type}, active: {rule.is_active}, "
                    f"actions: {len(rule.actions)}."
                ),
            }

        return None

    async def _load_workspace_stats(self, organization_id: UUID) -> dict[str, int]:
        companies = await self.session.scalar(
            select(func.count(Company.id)).where(Company.organization_id == organization_id)
        )
        contacts = await self.session.scalar(
            select(func.count(Contact.id)).where(Contact.organization_id == organization_id)
        )
        deals = await self.session.scalar(
            select(func.count(Deal.id)).where(Deal.organization_id == organization_id)
        )
        projects = await self.session.scalar(
            select(func.count(Project.id)).where(Project.organization_id == organization_id)
        )
        tasks = await self.session.scalar(
            select(func.count(Task.id)).where(Task.organization_id == organization_id)
        )
        messages = await self.session.scalar(
            select(func.count(Message.id)).where(Message.organization_id == organization_id)
        )
        return {
            "companies": int(companies or 0),
            "contacts": int(contacts or 0),
            "deals": int(deals or 0),
            "projects": int(projects or 0),
            "tasks": int(tasks or 0),
            "messages": int(messages or 0),
        }

    def _build_evidence_items(
        self,
        context_snapshot: dict[str, Any],
    ) -> list[GroundedEvidenceItem]:
        evidence: list[GroundedEvidenceItem] = []
        for item in context_snapshot.get("selected_entities", [])[:8]:
            evidence.append(
                GroundedEvidenceItem(
                    id=f"{item['entity_type']}:{item['entity_id']}",
                    entity_type=item["entity_type"],
                    entity_id=item["entity_id"],
                    title=item["title"],
                    snippet=item["snippet"],
                    source=f"crm-{item['entity_type']}",
                )
            )

        stats = context_snapshot.get("workspace_stats", {})
        evidence.append(
            GroundedEvidenceItem(
                id="workspace:stats",
                entity_type="workspace",
                entity_id=None,
                title="Workspace activity snapshot",
                snippet=(
                    f"Companies {stats.get('companies', 0)}, contacts {stats.get('contacts', 0)}, "
                    f"deals {stats.get('deals', 0)}, projects {stats.get('projects', 0)}, "
                    f"tasks {stats.get('tasks', 0)}, messages {stats.get('messages', 0)}."
                ),
                source="crm-workspace",
            )
        )
        return evidence

    async def _generate_content(
        self,
        payload: AgentRunRequest,
        context_snapshot: dict[str, Any],
    ) -> tuple[str, str]:
        default_model = self.settings.llm_model_agent or self.settings.llm_model
        if self.llm_client.enabled:
            try:
                response = await self.llm_client.complete_text(
                    crm_operator_prompt(
                        prompt=payload.prompt,
                        tone=payload.tone,
                        page=payload.page or payload.selection.page,
                        route=payload.selection.route,
                        context=context_snapshot,
                    ),
                    model=payload.model or default_model,
                )
            except Exception:
                response = None
            if response:
                return response.strip(), "llm"

        return self._fallback_content(payload.prompt, context_snapshot), "fallback"

    @staticmethod
    def _fallback_content(prompt: str, context_snapshot: dict[str, Any]) -> str:
        prompt_lower = prompt.lower()
        page = context_snapshot.get("page") or "current CRM page"
        selected = context_snapshot.get("selected_entities", [])
        stats = context_snapshot.get("workspace_stats", {})

        if "summary" in prompt_lower or "summarize" in prompt_lower:
            return (
                f"{page} is active. There are {len(selected)} selected CRM records in focus. "
                f"Workspace pressure is strongest around {stats.get('deals', 0)} deals, "
                f"{stats.get('tasks', 0)} tasks, and {stats.get('messages', 0)} conversations. "
                "Keep the next step explicit and ownership clear."
            )

        if "next" in prompt_lower or "action" in prompt_lower:
            return (
                "The safest next move is to prioritize the highest-intent record in view, "
                "create one tracked follow-up task, and keep all updates tied to the selected CRM entities."
            )

        return (
            f"You are operating from {page}. Use the selected records as ground truth, "
            "propose the smallest useful CRM updates, and keep every write approval-gated."
        )

    def _suggest_action_plans(
        self,
        *,
        requested_by_user_id: UUID,
        payload: AgentRunRequest,
        context_snapshot: dict[str, Any],
        evidence: list[GroundedEvidenceItem],
    ) -> list[dict[str, Any]]:
        if payload.selection.data_source != "live":
            return []

        prompt_lower = payload.prompt.lower()
        selected_entities = context_snapshot.get("selected_entities", [])
        entity_index: dict[str, list[dict[str, Any]]] = {}
        for item in selected_entities:
            entity_index.setdefault(item["entity_type"], []).append(item)

        evidence_slice = [item.model_dump(mode="json") for item in evidence[:3]]
        action_plans: list[dict[str, Any]] = []

        primary_contact = next(iter(entity_index.get("contact", [])), None)
        primary_deal = next(iter(entity_index.get("deal", [])), None)
        primary_task = next(iter(entity_index.get("task", [])), None)
        primary_project = next(iter(entity_index.get("project", [])), None)
        primary_message = next(iter(entity_index.get("message", [])), None)
        primary_company = next(iter(entity_index.get("company", [])), None)
        primary_rule = next(iter(entity_index.get("automation_rule", [])), None)

        if any(token in prompt_lower for token in ("follow", "next step", "task")):
            due_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            action_plans.append(
                {
                    "action_type": "create_follow_up_task",
                    "title": "Create follow-up task from current context",
                    "detail": "Track the next action in the CRM.",
                    "reasoning": "Prompt asks for a concrete next step.",
                    "target_entity_type": "task",
                    "target_entity_id": None,
                    "action_payload": {
                        "contact_id": primary_contact["entity_id"] if primary_contact else None,
                        "deal_id": primary_deal["entity_id"] if primary_deal else None,
                        "assignee_id": str(requested_by_user_id),
                        "title": "Follow up on current CRM thread",
                        "description": "Generated by CRM operator agent.",
                        "status": "open",
                        "due_at": due_at,
                        "source": TaskSource.automation.value,
                    },
                    "diff_payload": {
                        "before": None,
                        "after": {"title": "Follow up on current CRM thread", "due_at": due_at},
                    },
                    "evidence": evidence_slice,
                }
            )

        if "create company" in prompt_lower:
            action_plans.append(
                {
                    "action_type": "create_company",
                    "title": "Create company record",
                    "detail": "Add a new account-level company profile.",
                    "reasoning": "The operator explicitly asked to create a company.",
                    "target_entity_type": "company",
                    "target_entity_id": None,
                    "action_payload": {
                        "name": "New CRM Company",
                        "industry": "Unknown",
                    },
                    "diff_payload": {"before": None, "after": {"name": "New CRM Company"}},
                    "evidence": evidence_slice,
                }
            )

        if "create contact" in prompt_lower:
            company_id = primary_company["entity_id"] if primary_company else None
            action_plans.append(
                {
                    "action_type": "create_contact",
                    "title": "Create contact record",
                    "detail": "Capture a new contact in the active workspace.",
                    "reasoning": "The operator explicitly asked to create a contact.",
                    "target_entity_type": "contact",
                    "target_entity_id": None,
                    "action_payload": {
                        "company_id": company_id,
                        "name": "New CRM Contact",
                        "status": "lead",
                        "tags": ["ai-proposed"],
                    },
                    "diff_payload": {"before": None, "after": {"name": "New CRM Contact"}},
                    "evidence": evidence_slice,
                }
            )

        if "create deal" in prompt_lower and primary_contact:
            action_plans.append(
                {
                    "action_type": "create_deal",
                    "title": "Create deal for selected contact",
                    "detail": "Open a deal in the pipeline from the active context.",
                    "reasoning": "The operator asked for deal creation.",
                    "target_entity_type": "deal",
                    "target_entity_id": None,
                    "action_payload": {
                        "contact_id": primary_contact["entity_id"],
                        "title": f"{primary_contact['title']} opportunity",
                        "pipeline_stage": "lead",
                        "probability": 35,
                        "amount": 0,
                        "currency": "USD",
                    },
                    "diff_payload": {"before": None, "after": {"pipeline_stage": "lead"}},
                    "evidence": evidence_slice,
                }
            )

        if any(token in prompt_lower for token in ("reply", "draft", "send message")):
            action_plans.append(
                {
                    "action_type": "create_message",
                    "title": "Create outbound message draft",
                    "detail": "Prepare an outbound CRM message linked to current entities.",
                    "reasoning": "The operator asked for a response workflow action.",
                    "target_entity_type": "message",
                    "target_entity_id": None,
                    "action_payload": {
                        "contact_id": primary_contact["entity_id"] if primary_contact else None,
                        "deal_id": primary_deal["entity_id"] if primary_deal else None,
                        "direction": MessageDirection.outbound.value,
                        "channel": MessageChannel.email.value,
                        "subject": "Follow-up from CRMP",
                        "body": "Thanks for the update. I will share the next step shortly.",
                        "author_user_id": str(requested_by_user_id),
                        "payload_meta": {"source": "ai-operator-agent"},
                    },
                    "diff_payload": {
                        "before": None,
                        "after": {"direction": MessageDirection.outbound.value},
                    },
                    "evidence": evidence_slice,
                }
            )

        if any(token in prompt_lower for token in ("convert", "project")) and primary_deal:
            action_plans.append(
                {
                    "action_type": "convert_deal_to_project",
                    "title": "Convert selected deal to project",
                    "detail": "Create a delivery project from the selected deal.",
                    "reasoning": "Prompt references project conversion.",
                    "target_entity_type": "project",
                    "target_entity_id": None,
                    "action_payload": {
                        "deal_id": primary_deal["entity_id"],
                        "owner_user_id": str(requested_by_user_id),
                        "name": f"{primary_deal['title']} - Delivery",
                    },
                    "diff_payload": {"before": None, "after": {"deal_id": primary_deal["entity_id"]}},
                    "evidence": evidence_slice,
                }
            )

        if "update" in prompt_lower and primary_contact:
            action_plans.append(
                {
                    "action_type": "update_contact",
                    "title": f"Update {primary_contact['title']} contact status",
                    "detail": "Promote the contact to active and tag as engaged.",
                    "reasoning": "Prompt requests an update and a contact is selected.",
                    "target_entity_type": "contact",
                    "target_entity_id": primary_contact["entity_id"],
                    "action_payload": {
                        "contact_id": primary_contact["entity_id"],
                        "status": "active",
                        "tags": ["engaged", "ai-updated"],
                    },
                    "diff_payload": {
                        "before": {"status": "lead"},
                        "after": {"status": "active", "tags": ["engaged", "ai-updated"]},
                    },
                    "evidence": evidence_slice,
                }
            )

        if "update" in prompt_lower and primary_deal:
            action_plans.append(
                {
                    "action_type": "update_deal",
                    "title": f"Update {primary_deal['title']} stage",
                    "detail": "Refresh stage/probability from the latest context.",
                    "reasoning": "Prompt requests an update and a deal is selected.",
                    "target_entity_type": "deal",
                    "target_entity_id": primary_deal["entity_id"],
                    "action_payload": {
                        "deal_id": primary_deal["entity_id"],
                        "pipeline_stage": DealStage.qualified.value,
                        "probability": 55,
                    },
                    "diff_payload": {"before": None, "after": {"pipeline_stage": "qualified"}},
                    "evidence": evidence_slice,
                }
            )

        if "update" in prompt_lower and primary_task:
            action_plans.append(
                {
                    "action_type": "update_task",
                    "title": f"Update task {primary_task['title']}",
                    "detail": "Mark the selected task as in progress.",
                    "reasoning": "Prompt requests updates for selected work.",
                    "target_entity_type": "task",
                    "target_entity_id": primary_task["entity_id"],
                    "action_payload": {
                        "task_id": primary_task["entity_id"],
                        "status": "in_progress",
                    },
                    "diff_payload": {"before": None, "after": {"status": "in_progress"}},
                    "evidence": evidence_slice,
                }
            )

        if "update" in prompt_lower and primary_project:
            action_plans.append(
                {
                    "action_type": "update_project",
                    "title": f"Update project {primary_project['title']}",
                    "detail": "Set the selected project to active.",
                    "reasoning": "Prompt requests updates and a project is selected.",
                    "target_entity_type": "project",
                    "target_entity_id": primary_project["entity_id"],
                    "action_payload": {
                        "project_id": primary_project["entity_id"],
                        "status": "active",
                    },
                    "diff_payload": {"before": None, "after": {"status": "active"}},
                    "evidence": evidence_slice,
                }
            )

        if "update company" in prompt_lower and primary_company:
            action_plans.append(
                {
                    "action_type": "update_company",
                    "title": f"Update company {primary_company['title']}",
                    "detail": "Refresh selected company metadata.",
                    "reasoning": "Prompt directly asks for company updates.",
                    "target_entity_type": "company",
                    "target_entity_id": primary_company["entity_id"],
                    "action_payload": {
                        "company_id": primary_company["entity_id"],
                        "industry": "Updated by AI operator",
                    },
                    "diff_payload": {"before": None, "after": {"industry": "Updated by AI operator"}},
                    "evidence": evidence_slice,
                }
            )

        if "create automation" in prompt_lower:
            action_plans.append(
                {
                    "action_type": "create_automation_rule",
                    "title": "Create follow-up automation rule",
                    "detail": "Add a workflow rule tied to contact creation.",
                    "reasoning": "Prompt asks for automation setup.",
                    "target_entity_type": "automation_rule",
                    "target_entity_id": None,
                    "action_payload": {
                        "name": "AI Follow-up Rule",
                        "description": "Auto-create follow-up task for new contacts.",
                        "event_type": "contact_created",
                        "conditions": {},
                        "actions": [
                            {
                                "type": "create_follow_up_task",
                                "title": "Follow up new contact",
                            }
                        ],
                        "is_active": True,
                    },
                    "diff_payload": {"before": None, "after": {"event_type": "contact_created"}},
                    "evidence": evidence_slice,
                }
            )

        if "update automation" in prompt_lower and primary_rule:
            action_plans.append(
                {
                    "action_type": "update_automation_rule",
                    "title": f"Update automation {primary_rule['title']}",
                    "detail": "Activate and refresh selected automation rule actions.",
                    "reasoning": "Prompt asks to adjust an existing automation.",
                    "target_entity_type": "automation_rule",
                    "target_entity_id": primary_rule["entity_id"],
                    "action_payload": {
                        "rule_id": primary_rule["entity_id"],
                        "is_active": True,
                    },
                    "diff_payload": {"before": None, "after": {"is_active": True}},
                    "evidence": evidence_slice,
                }
            )

        if "note" in prompt_lower and primary_message:
            action_plans.append(
                {
                    "action_type": "add_internal_note",
                    "title": "Capture internal note from selected message",
                    "detail": "Persist a concise operator note for later context.",
                    "reasoning": "Prompt asks to preserve context.",
                    "target_entity_type": "message",
                    "target_entity_id": primary_message["entity_id"],
                    "action_payload": {
                        "entity_type": "message",
                        "entity_id": primary_message["entity_id"],
                        "body": f"AI summary note: {primary_message['snippet'][:180]}",
                    },
                    "diff_payload": {"before": None, "after": {"body": "AI summary note"}},
                    "evidence": evidence_slice,
                }
            )

        normalized, errors = normalize_action_blueprints(action_plans)
        if errors:
            normalized.append(
                {
                    "action_type": "add_internal_note",
                    "title": "AI action validation warning",
                    "detail": "Some actions were dropped during validation.",
                    "reasoning": "; ".join(errors)[:450],
                    "target_entity_type": "message" if primary_message else "contact",
                    "target_entity_id": (
                        primary_message["entity_id"]
                        if primary_message
                        else primary_contact["entity_id"]
                        if primary_contact
                        else None
                    ),
                    "action_payload": {
                        "entity_type": "message" if primary_message else "contact",
                        "entity_id": (
                            primary_message["entity_id"]
                            if primary_message
                            else primary_contact["entity_id"]
                            if primary_contact
                            else ""
                        ),
                        "body": "AI action validation dropped unsupported or invalid proposals.",
                    },
                    "diff_payload": {"before": None, "after": {"validation": "warnings"}},
                    "evidence": evidence_slice,
                    "validation_error": "; ".join(errors),
                }
            )
            normalized, _ = normalize_action_blueprints(normalized)
        return normalized[:8]

    async def _persist_proposals(
        self,
        *,
        organization_id: UUID,
        requested_by_user_id: UUID,
        trace_id: str,
        thread_id: str,
        action_plans: list[dict[str, Any]],
    ) -> list[AIActionProposal]:
        proposals: list[AIActionProposal] = []
        for blueprint in action_plans:
            existing = await self.session.scalar(
                select(AIActionProposal)
                .where(AIActionProposal.organization_id == organization_id)
                .where(AIActionProposal.thread_id == thread_id)
                .where(AIActionProposal.action_type == blueprint["action_type"])
                .where(AIActionProposal.status == "pending")
                .where(AIActionProposal.title == blueprint["title"])
                .order_by(AIActionProposal.created_at.desc())
            )
            if existing is not None:
                proposals.append(existing)
                continue

            proposal = AIActionProposal(
                organization_id=organization_id,
                requested_by_user_id=requested_by_user_id,
                thread_id=thread_id,
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
                evidence=blueprint.get("evidence", []),
                expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            )
            self.session.add(proposal)
            await self.session.flush()
            proposals.append(proposal)
        return proposals

    async def _list_proposals_for_trace(
        self,
        organization_id: UUID,
        *,
        trace_id: str,
        limit: int,
    ) -> list[AIActionProposal]:
        rows = await self.session.scalars(
            select(AIActionProposal)
            .where(AIActionProposal.organization_id == organization_id)
            .where(AIActionProposal.trace_id == trace_id)
            .order_by(AIActionProposal.created_at.asc())
            .limit(limit)
        )
        return list(rows.all())
