from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedRead


class MessageClassificationRequest(BaseModel):
    message_body: str = Field(min_length=1)
    contact_name: Optional[str] = None
    deal_title: Optional[str] = None
    recent_activity: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class MessageClassificationResult(BaseModel):
    lead_score: float = Field(ge=0, le=100)
    intent: str
    priority: str
    product_relevance: str
    sentiment: float = Field(ge=-1, le=1)
    summary: str


class ReplyGenerationRequest(BaseModel):
    message_body: str = Field(min_length=1)
    contact_name: Optional[str] = None
    deal_title: Optional[str] = None
    tone: str = "professional"
    max_options: int = Field(default=3, ge=1, le=5)
    context: dict[str, Any] = Field(default_factory=dict)


class ReplyOption(BaseModel):
    text: str
    tone: str
    confidence: float = Field(ge=0, le=1)


class ReplyGenerationResult(BaseModel):
    options: list[ReplyOption]


class DealScoreRequest(BaseModel):
    deal_id: Optional[UUID] = None
    title: str
    amount: float = 0.0
    stage: str
    recent_events: list[str] = Field(default_factory=list)
    context: dict[str, Any] = Field(default_factory=dict)


class DealScoreResult(BaseModel):
    probability: float = Field(ge=0, le=100)
    rationale: str


class RecommendationItem(BaseModel):
    title: str
    description: str
    priority: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action_label: Optional[str] = None


class RecommendationsResponse(BaseModel):
    items: list[RecommendationItem]


class AssistantMessageRequest(BaseModel):
    prompt: str = Field(min_length=1)
    page: Optional[str] = None
    tone: str = "focused"
    model: Optional[str] = None
    context: dict[str, Any] = Field(default_factory=dict)


class AssistantMessageResponse(BaseModel):
    content: str
    mode: str = "fallback"


class AssistantStatusResponse(BaseModel):
    mode: str = "fallback"
    reachable: bool = False
    is_local: bool = False
    base_url: str
    configured_model: Optional[str] = None
    available_models: list[str] = Field(default_factory=list)
    loaded_models: list[str] = Field(default_factory=list)
    detail: str


class ProjectAreaSummary(BaseModel):
    path: str
    file_count: int = Field(ge=0)
    last_modified_at: Optional[datetime] = None


class ProjectFileSignal(BaseModel):
    path: str
    reason: str
    score: int = Field(ge=0)
    last_modified_at: datetime


class ProjectDecisionHint(BaseModel):
    title: str
    detail: str
    confidence: Literal["low", "medium", "high"] = "medium"


class ProjectFocusMatch(BaseModel):
    path: str
    source: Literal["path", "content"]
    line: Optional[int] = Field(default=None, ge=1)
    snippet: str


class ProjectIntelligenceSnapshot(BaseModel):
    snapshot_id: str
    generated_at: datetime
    project_root: str
    total_files: int = Field(ge=0)
    total_directories: int = Field(ge=0)
    language_breakdown: dict[str, int] = Field(default_factory=dict)
    areas: list[ProjectAreaSummary] = Field(default_factory=list)
    recent_files: list[ProjectFileSignal] = Field(default_factory=list)
    hotspots: list[ProjectFileSignal] = Field(default_factory=list)
    decision_hints: list[ProjectDecisionHint] = Field(default_factory=list)
    focus: Optional[str] = None
    focus_matches: list[ProjectFocusMatch] = Field(default_factory=list)
    detail: str


class ProjectIntelligenceChatRequest(BaseModel):
    prompt: str = Field(min_length=1)
    focus: Optional[str] = Field(default=None, max_length=120)
    limit: int = Field(default=8, ge=3, le=25)


class ProjectIntelligenceChatResponse(BaseModel):
    content: str
    mode: str = "fallback"
    snapshot: ProjectIntelligenceSnapshot


class GroundedEvidenceItem(BaseModel):
    id: str
    entity_type: str
    entity_id: Optional[str] = None
    title: str
    snippet: str
    source: str


class GroundedInboxCopilotRequest(BaseModel):
    prompt: str = Field(min_length=1)
    thread_id: str = Field(min_length=1, max_length=255)
    message_ids: list[UUID] = Field(default_factory=list)
    contact_id: Optional[UUID] = None
    deal_id: Optional[UUID] = None
    task_ids: list[UUID] = Field(default_factory=list)
    page: Optional[str] = None
    tone: str = "focused"
    model: Optional[str] = None
    client_trace_id: Optional[str] = None
    context: dict[str, Any] = Field(default_factory=dict)


class AgentSelectedEntity(BaseModel):
    entity_type: str = Field(min_length=2, max_length=80)
    entity_id: str = Field(min_length=1, max_length=120)


class AgentSelectionContext(BaseModel):
    page: Optional[str] = Field(default=None, max_length=120)
    route: Optional[str] = Field(default=None, max_length=255)
    data_source: Literal["live", "preview", "loading"] = "live"
    thread_id: Optional[str] = Field(default=None, max_length=255)
    selected_entities: list[AgentSelectedEntity] = Field(default_factory=list)


class AgentRunRequest(BaseModel):
    prompt: str = Field(min_length=1)
    tone: str = "focused"
    model: Optional[str] = None
    page: Optional[str] = None
    client_trace_id: Optional[str] = None
    selection: AgentSelectionContext = Field(default_factory=AgentSelectionContext)
    context: dict[str, Any] = Field(default_factory=dict)


class AIActionProposalRead(TimestampedRead):
    organization_id: UUID
    requested_by_user_id: UUID
    approved_by_user_id: Optional[UUID] = None
    rejected_by_user_id: Optional[UUID] = None
    thread_id: str
    trace_id: str
    action_type: str
    status: str
    title: str
    detail: Optional[str] = None
    reasoning: Optional[str] = None
    target_entity_type: Optional[str] = None
    target_entity_id: Optional[str] = None
    action_payload: dict[str, Any] = Field(default_factory=dict)
    diff_payload: dict[str, Any] = Field(default_factory=dict)
    evidence: list[GroundedEvidenceItem] = Field(default_factory=list)
    rejection_reason: Optional[str] = None
    last_error: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


class AIActionExecutionRead(TimestampedRead):
    proposal_id: UUID
    organization_id: UUID
    executed_by_user_id: Optional[UUID] = None
    trace_id: str
    status: str
    detail: Optional[str] = None
    result_payload: dict[str, Any] = Field(default_factory=dict)


class GroundedInboxCopilotResponse(BaseModel):
    content: str
    mode: str = "fallback"
    grounding_status: str = "fallback"
    trace_id: str
    evidence: list[GroundedEvidenceItem] = Field(default_factory=list)
    proposed_actions: list[AIActionProposalRead] = Field(default_factory=list)


class ProposalDecisionRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)


class ProposalDecisionResponse(BaseModel):
    proposal: AIActionProposalRead
    execution: Optional[AIActionExecutionRead] = None


class AgentRunRead(TimestampedRead):
    organization_id: UUID
    requested_by_user_id: UUID
    trace_id: str
    status: str
    run_kind: str
    prompt: str
    tone: str
    page: Optional[str] = None
    route: Optional[str] = None
    model: Optional[str] = None
    output_mode: Optional[str] = None
    selection_context: dict[str, Any] = Field(default_factory=dict)
    context_snapshot: dict[str, Any] = Field(default_factory=dict)
    evidence: list[GroundedEvidenceItem] = Field(default_factory=list)
    output_content: Optional[str] = None
    error_detail: Optional[str] = None
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None


class AgentRunCreateResponse(BaseModel):
    run: AgentRunRead


class AgentRunDetailResponse(BaseModel):
    run: AgentRunRead
    proposed_actions: list[AIActionProposalRead] = Field(default_factory=list)


class ProposalBulkDecisionRequest(BaseModel):
    proposal_ids: list[UUID] = Field(min_length=1, max_length=100)
    decision: Literal["approve", "reject"]
    reason: Optional[str] = Field(default=None, max_length=500)


class ProposalBulkDecisionItem(BaseModel):
    proposal_id: UUID
    status: str
    detail: Optional[str] = None
    decision: Optional[ProposalDecisionResponse] = None


class ProposalBulkDecisionResponse(BaseModel):
    results: list[ProposalBulkDecisionItem] = Field(default_factory=list)
