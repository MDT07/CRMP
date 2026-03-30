from __future__ import annotations

from typing import Annotated, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from fastapi import status as http_status

from app.api.dependencies import CurrentUserDep, SessionDep
from app.schemas.ai import (
    AgentRunCreateResponse,
    AgentRunDetailResponse,
    AgentRunRead,
    AgentRunRequest,
    AIActionProposalRead,
    AssistantMessageRequest,
    AssistantMessageResponse,
    AssistantStatusResponse,
    DealScoreRequest,
    DealScoreResult,
    GroundedInboxCopilotRequest,
    GroundedInboxCopilotResponse,
    MessageClassificationRequest,
    MessageClassificationResult,
    ProjectIntelligenceChatRequest,
    ProjectIntelligenceChatResponse,
    ProjectIntelligenceSnapshot,
    ProposalBulkDecisionItem,
    ProposalBulkDecisionRequest,
    ProposalBulkDecisionResponse,
    ProposalDecisionRequest,
    ProposalDecisionResponse,
    RecommendationsResponse,
    ReplyGenerationRequest,
    ReplyGenerationResult,
)
from app.services.ai_agent_service import AIAgentService
from app.services.ai_service import AIService
from app.services.grounded_ai_service import GroundedInboxService
from app.services.project_intelligence_service import ProjectIntelligenceService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/classify-message", response_model=MessageClassificationResult)
async def classify_message(
    payload: MessageClassificationRequest,
    session: SessionDep,
    _: CurrentUserDep,
) -> MessageClassificationResult:
    return await AIService(session).classify_message(payload)


@router.post("/generate-reply", response_model=ReplyGenerationResult)
async def generate_reply(
    payload: ReplyGenerationRequest,
    session: SessionDep,
    _: CurrentUserDep,
) -> ReplyGenerationResult:
    return await AIService(session).generate_reply(payload)


@router.post("/score-deal", response_model=DealScoreResult)
async def score_deal(
    payload: DealScoreRequest,
    session: SessionDep,
    _: CurrentUserDep,
) -> DealScoreResult:
    return await AIService(session).score_deal(payload)


@router.get("/recommendations", response_model=RecommendationsResponse)
async def recommendations(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> RecommendationsResponse:
    return await AIService(session).get_recommendations(current_user.organization_id)


@router.get("/status", response_model=AssistantStatusResponse)
async def status(
    session: SessionDep,
    _: CurrentUserDep,
) -> AssistantStatusResponse:
    return await AIService(session).get_status()


@router.get("/project-intelligence", response_model=ProjectIntelligenceSnapshot)
async def project_intelligence_snapshot(
    session: SessionDep,
    current_user: CurrentUserDep,
    focus: Annotated[Optional[str], Query(max_length=120)] = None,
    limit: Annotated[int, Query(ge=3, le=25)] = 8,
) -> ProjectIntelligenceSnapshot:
    return await ProjectIntelligenceService(session).get_snapshot(
        current_user.organization_id,
        focus=focus,
        limit=limit,
    )


@router.post("/project-intelligence/chat", response_model=ProjectIntelligenceChatResponse)
async def project_intelligence_chat(
    payload: ProjectIntelligenceChatRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ProjectIntelligenceChatResponse:
    return await ProjectIntelligenceService(session).chat(
        current_user.organization_id,
        prompt=payload.prompt,
        focus=payload.focus,
        limit=payload.limit,
    )


@router.post("/copilot", response_model=AssistantMessageResponse)
async def copilot(
    payload: AssistantMessageRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> AssistantMessageResponse:
    return await AIService(session).copilot_message(current_user.organization_id, payload)


@router.post("/inbox/copilot", response_model=GroundedInboxCopilotResponse)
async def inbox_copilot(
    payload: GroundedInboxCopilotRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> GroundedInboxCopilotResponse:
    return await GroundedInboxService(session).run_copilot(
        current_user.organization_id,
        current_user.id,
        payload,
    )


@router.get("/proposals", response_model=list[AIActionProposalRead])
async def list_proposals(
    session: SessionDep,
    current_user: CurrentUserDep,
    thread_id: Optional[str] = None,
    proposal_status: Annotated[Optional[str], Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> list[AIActionProposalRead]:
    return await GroundedInboxService(session).list_proposals(
        current_user.organization_id,
        thread_id=thread_id,
        status_filter=proposal_status,
        limit=limit,
    )


@router.post("/proposals/{proposal_id}/approve", response_model=ProposalDecisionResponse)
async def approve_proposal(
    proposal_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ProposalDecisionResponse:
    return await GroundedInboxService(session).approve_proposal(
        current_user.organization_id,
        proposal_id,
        current_user.id,
    )


@router.post("/proposals/{proposal_id}/reject", response_model=ProposalDecisionResponse)
async def reject_proposal(
    proposal_id: UUID,
    payload: ProposalDecisionRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ProposalDecisionResponse:
    return await GroundedInboxService(session).reject_proposal(
        current_user.organization_id,
        proposal_id,
        current_user.id,
        reason=payload.reason,
    )


@router.post("/proposals/bulk-decision", response_model=ProposalBulkDecisionResponse)
async def bulk_decide_proposals(
    payload: ProposalBulkDecisionRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> ProposalBulkDecisionResponse:
    service = GroundedInboxService(session)
    results: list[ProposalBulkDecisionItem] = []
    for proposal_id in payload.proposal_ids:
        try:
            if payload.decision == "approve":
                decision = await service.approve_proposal(
                    current_user.organization_id,
                    proposal_id,
                    current_user.id,
                )
            else:
                decision = await service.reject_proposal(
                    current_user.organization_id,
                    proposal_id,
                    current_user.id,
                    reason=payload.reason,
                )
            results.append(
                ProposalBulkDecisionItem(
                    proposal_id=proposal_id,
                    status="ok",
                    decision=decision,
                )
            )
        except HTTPException as exc:
            results.append(
                ProposalBulkDecisionItem(
                    proposal_id=proposal_id,
                    status="failed",
                    detail=exc.detail if isinstance(exc.detail, str) else str(exc.detail),
                )
            )

    return ProposalBulkDecisionResponse(results=results)


@router.post("/agent/run", response_model=AgentRunDetailResponse)
async def run_operator_agent(
    payload: AgentRunRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> AgentRunDetailResponse:
    run, proposals = await AIAgentService(session).run_sync(
        current_user.organization_id,
        current_user.id,
        payload,
    )
    return AgentRunDetailResponse(
        run=AgentRunRead.model_validate(run),
        proposed_actions=[AIActionProposalRead.model_validate(item) for item in proposals],
    )


@router.post(
    "/agent/runs",
    response_model=AgentRunCreateResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def queue_operator_agent_run(
    payload: AgentRunRequest,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> AgentRunCreateResponse:
    run = await AIAgentService(session).create_async_run(
        current_user.organization_id,
        current_user.id,
        payload,
    )
    return AgentRunCreateResponse(run=AgentRunRead.model_validate(run))


@router.get("/agent/runs", response_model=list[AgentRunRead])
async def list_operator_agent_runs(
    session: SessionDep,
    current_user: CurrentUserDep,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> list[AgentRunRead]:
    runs = await AIAgentService(session).list_runs(
        current_user.organization_id,
        current_user.id,
        limit=limit,
    )
    return [AgentRunRead.model_validate(item) for item in runs]


@router.get("/agent/runs/{run_id}", response_model=AgentRunDetailResponse)
async def get_operator_agent_run(
    run_id: UUID,
    session: SessionDep,
    current_user: CurrentUserDep,
) -> AgentRunDetailResponse:
    service = AIAgentService(session)
    run = await service.get_run(current_user.organization_id, current_user.id, run_id)
    if run is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="AI agent run not found.",
        )

    proposals = await service.list_run_proposals(
        current_user.organization_id,
        run.trace_id,
        limit=100,
    )
    return AgentRunDetailResponse(
        run=AgentRunRead.model_validate(run),
        proposed_actions=[AIActionProposalRead.model_validate(item) for item in proposals],
    )
