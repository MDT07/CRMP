"""API routes for Multi-Agent CRM Assistant System.

Provides endpoints for:
- Query routing to best agent
- Direct agent execution
- Collaborative multi-agent tasks
- Multi-step workflows
- Agent status and management
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.dependencies import CurrentUserDep, SessionDep
from app.services.multi_agent_service import MultiAgentService

router = APIRouter(prefix="/agents", tags=["multi-agent"])


@router.get("/status")
async def get_agent_system_status(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Get status of the multi-agent system."""
    service = MultiAgentService(session)
    return await service.get_status(
        current_user.organization_id,
        current_user.id,
    )


@router.get("/list")
async def list_available_agents(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[dict[str, Any]]:
    """List all available agents and their capabilities."""
    service = MultiAgentService(session)
    return await service.list_agents(
        current_user.organization_id,
        current_user.id,
    )


@router.post("/query")
async def query_agents(
    query: str,
    session: SessionDep,
    current_user: CurrentUserDep,
    params: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Route a query to the best agent and get response.

    Example:
        POST /api/v1/agents/query
        {
            "query": "What's the status of the Acme deal?"
        }
    """
    service = MultiAgentService(session)
    return await service.query(
        current_user.organization_id,
        current_user.id,
        query,
        params,
    )


@router.post("/chat")
async def chat_with_agents(
    message: str,
    session: SessionDep,
    current_user: CurrentUserDep,
    context: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Chat with the multi-agent system.

    Example:
        POST /api/v1/agents/chat
        {
            "message": "What should I focus on today?"
        }
    """
    service = MultiAgentService(session)
    return await service.chat(
        current_user.organization_id,
        current_user.id,
        message,
        context,
    )


@router.post("/execute/{agent_id}")
async def execute_with_agent(
    agent_id: str,
    task_type: str,
    session: SessionDep,
    current_user: CurrentUserDep,
    params: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Execute a specific task with a specific agent.

    Available agents:
    - contact_analyst: Analyzes contacts and relationships
    - deal_strategist: Focuses on deal progression
    - email_assistant: Handles email composition
    - pipeline_analyst: Analyzes pipeline health
    - task_manager: Manages and prioritizes tasks
    - meeting_assistant: Prepares meeting briefs
    - generalist: Handles general queries

    Example:
        POST /api/v1/agents/execute/contact_analyst
        {
            "task_type": "analyze_contact",
            "params": {"contact_id": "uuid-here"}
        }
    """
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        agent_id,
        task_type,
        params or {},
    )


@router.post("/collaborate")
async def execute_collaborative(
    task_description: str,
    required_capabilities: list[str] = Query(default=[]),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
    params: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Execute a task requiring collaboration between multiple agents.

    Example:
        POST /api/v1/agents/collaborate
        {
            "task_description": "Analyze customer relationship and suggest next steps",
            "required_capabilities": ["analyze_contact", "suggest_engagement"],
            "params": {"contact_id": "uuid-here"}
        }
    """
    service = MultiAgentService(session)
    return await service.execute_collaborative(
        current_user.organization_id,
        current_user.id,
        task_description,
        required_capabilities,
        params or {},
    )


@router.get("/workflows")
async def list_workflows(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> list[dict[str, Any]]:
    """List available predefined multi-agent workflows."""
    service = MultiAgentService(session)
    status = await service.get_status(
        current_user.organization_id,
        current_user.id,
    )
    return status.get("available_workflows", [])


@router.post("/workflows/{workflow_name}/run")
async def run_workflow(
    workflow_name: str,
    params: dict[str, Any],
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Run a predefined multi-agent workflow.

    Available workflows:
    - comprehensive_deal_analysis: Analyze deal from multiple perspectives
    - morning_briefing: Get comprehensive morning briefing
    - meeting_preparation: Prepare for an important meeting
    - follow_up_sequence: Execute comprehensive follow-up workflow

    Example:
        POST /api/v1/agents/workflows/comprehensive_deal_analysis/run
        {
            "params": {"deal_id": "uuid-here"}
        }
    """
    service = MultiAgentService(session)
    return await service.run_workflow(
        current_user.organization_id,
        current_user.id,
        workflow_name,
        params,
    )


@router.post("/analyze/contact/{contact_id}")
async def agent_analyze_contact(
    contact_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Use Contact Analyst agent to analyze a contact."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "contact_analyst",
        "analyze_contact",
        {"contact_id": str(contact_id)},
    )


@router.post("/analyze/deal/{deal_id}")
async def agent_analyze_deal(
    deal_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Use Deal Strategist agent to analyze a deal."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "deal_strategist",
        "analyze_deal",
        {"deal_id": str(deal_id)},
    )


@router.post("/analyze/pipeline")
async def agent_analyze_pipeline(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Use Pipeline Analyst agent to analyze pipeline."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "pipeline_analyst",
        "analyze_pipeline",
        {},
    )


@router.post("/tasks/prioritize")
async def agent_prioritize_tasks(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Use Task Manager agent to prioritize tasks."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "task_manager",
        "prioritize_tasks",
        {},
    )


@router.post("/email/draft")
async def agent_draft_email(
    message_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
    tone: str = Query(default="professional"),
) -> dict[str, Any]:
    """Use Email Assistant agent to draft email reply."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "email_assistant",
        "draft_reply",
        {"message_id": str(message_id), "tone": tone},
    )


@router.post("/meeting/prep")
async def agent_prepare_meeting(
    contact_ids: list[UUID] = Query(default=[]),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
    meeting_type: str = Query(default="discovery"),
) -> dict[str, Any]:
    """Use Meeting Assistant agent to prepare meeting brief."""
    service = MultiAgentService(session)
    return await service.execute_with_agent(
        current_user.organization_id,
        current_user.id,
        "meeting_assistant",
        "prepare_meeting_brief",
        {
            "contact_ids": [str(cid) for cid in contact_ids],
            "meeting_type": meeting_type,
        },
    )


@router.post("/workflows/deal-analysis/{deal_id}")
async def run_comprehensive_deal_analysis(
    deal_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Run comprehensive deal analysis workflow.

    This workflow:
    1. Analyzes the deal health (Deal Strategist)
    2. Analyzes related contact (Contact Analyst)
    3. Suggests closing strategy (Deal Strategist)
    """
    service = MultiAgentService(session)
    return await service.run_workflow(
        current_user.organization_id,
        current_user.id,
        "comprehensive_deal_analysis",
        {"deal_id": str(deal_id)},
    )


@router.post("/workflows/morning-briefing")
async def run_morning_briefing(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> dict[str, Any]:
    """Run morning briefing workflow.

    This workflow:
    1. Checks pipeline health (Pipeline Analyst)
    2. Prioritizes tasks (Task Manager)
    3. Suggests daily focus (Task Manager)
    """
    service = MultiAgentService(session)
    return await service.run_workflow(
        current_user.organization_id,
        current_user.id,
        "morning_briefing",
        {},
    )


@router.post("/workflows/meeting-prep")
async def run_meeting_preparation(
    contact_ids: list[UUID] = Query(default=[]),
    session: SessionDep = None,
    current_user: CurrentUserDep = None,
    meeting_type: str = Query(default="discovery"),
) -> dict[str, Any]:
    """Run meeting preparation workflow.

    This workflow:
    1. Prepares meeting brief (Meeting Assistant)
    2. Analyzes contacts (Contact Analyst)
    3. Checks related deals (Deal Strategist)
    """
    service = MultiAgentService(session)
    return await service.run_workflow(
        current_user.organization_id,
        current_user.id,
        "meeting_preparation",
        {
            "contact_ids": [str(cid) for cid in contact_ids],
            "meeting_type": meeting_type,
        },
    )
