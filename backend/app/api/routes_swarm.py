"""API routes for the agent swarm system."""

from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db_session
from app.ai.swarm_core import SwarmContext, SwarmTask, PriorityLevel
from app.ai.swarm_orchestrator import SwarmOrchestrator
from app.models.user import User

# Initialize orchestrator (singleton)
orchestrator: Optional[SwarmOrchestrator] = None


def get_orchestrator() -> SwarmOrchestrator:
    """Get or create the swarm orchestrator."""
    global orchestrator
    if orchestrator is None:
        # Initialize with Redis if available
        redis_client = None  # Would get from app state in real implementation
        orchestrator = SwarmOrchestrator(redis_client)
    return orchestrator


router = APIRouter(prefix="/swarm", tags=["swarm"])


# Request/Response Models


class SubmitTaskRequest(BaseModel):
    """Request to submit a task to the swarm."""

    task_type: str = Field(..., description="Type of task to execute")
    description: str = Field(..., description="Description of the task")
    priority: str = Field(
        default="normal", description="Task priority: critical, high, normal, low, background"
    )
    required_capabilities: List[str] = Field(
        default_factory=list, description="Required agent capabilities"
    )
    optimal_swarm_size: int = Field(
        default=3, ge=1, le=10, description="Number of agents to involve"
    )
    input_payload: Dict[str, Any] = Field(default_factory=dict, description="Task input data")
    context_location: Optional[str] = Field(
        None, description="CRM entity context (deal_id, contact_id, etc.)"
    )
    timeout_seconds: int = Field(default=60, ge=10, le=300)


class SubmitTaskResponse(BaseModel):
    """Response from task submission."""

    execution_id: UUID
    status: str
    message: str
    participating_agents: List[str]


class SwarmStatusResponse(BaseModel):
    """Response with swarm status."""

    active_agents: int
    idle_agents: int
    executing_agents: int
    queued_tasks: int
    completed_tasks_24h: int
    failed_tasks_24h: int
    avg_task_completion_time_ms: float
    success_rate: float
    pheromone_trails_active: int
    conflict_rate: float
    learning_velocity: float
    agents: Dict[str, Dict[str, Any]]
    registered_agent_classes: List[str]


class AgentListResponse(BaseModel):
    """Response with list of agents."""

    agents: List[Dict[str, Any]]
    total_count: int
    by_class: Dict[str, int]


class PheromoneTrailResponse(BaseModel):
    """Response with pheromone trail data."""

    location: str
    data_type: str
    strength: float
    hint: Optional[str]
    metadata: Dict[str, Any]
    created_at: str


class SwarmLearningResponse(BaseModel):
    """Response with swarm learnings."""

    learnings: List[Dict[str, Any]]
    total_count: int
    by_type: Dict[str, int]


# Routes


@router.post("/tasks", response_model=SubmitTaskResponse)
async def submit_task(
    request: SubmitTaskRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> SubmitTaskResponse:
    """
    Submit a task to the agent swarm for execution.

    The swarm will automatically select the best agents, execute the task,
    resolve any conflicts, and return the result.
    """
    swarm = get_orchestrator()

    # Map priority string to enum
    priority_map = {
        "critical": PriorityLevel.CRITICAL,
        "high": PriorityLevel.HIGH,
        "normal": PriorityLevel.NORMAL,
        "low": PriorityLevel.LOW,
        "background": PriorityLevel.BACKGROUND,
    }
    priority = priority_map.get(request.priority.lower(), PriorityLevel.NORMAL)

    # Create task
    task = SwarmTask(
        task_type=request.task_type,
        description=request.description,
        priority=priority,
        required_capabilities=request.required_capabilities,
        optimal_swarm_size=request.optimal_swarm_size,
        input_payload=request.input_payload,
        context=SwarmContext(
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            location=request.context_location,
        ),
        timeout_seconds=request.timeout_seconds,
    )

    # Initialize swarm if needed
    if not swarm.agents:
        await swarm.initialize_default_swarm()

    # Execute task
    execution = await swarm.submit_task(task)

    return SubmitTaskResponse(
        execution_id=execution.id,
        status=execution.status,
        message=f"Task submitted with {len(execution.agents)} agents"
        if execution.agents
        else "Task submitted",
        participating_agents=[str(a.id) for a in execution.agents] if execution.agents else [],
    )


@router.get("/status", response_model=SwarmStatusResponse)
async def get_swarm_status(
    current_user: User = Depends(get_current_user),
) -> SwarmStatusResponse:
    """Get current status and metrics of the agent swarm."""
    swarm = get_orchestrator()

    # Initialize if needed
    if not swarm.agents:
        await swarm.initialize_default_swarm()

    status = await swarm.get_swarm_status()
    metrics = status["metrics"]

    return SwarmStatusResponse(
        active_agents=metrics["active_agents"],
        idle_agents=metrics["idle_agents"],
        executing_agents=metrics["executing_agents"],
        queued_tasks=metrics["queued_tasks"],
        completed_tasks_24h=metrics["completed_tasks_24h"],
        failed_tasks_24h=metrics["failed_tasks_24h"],
        avg_task_completion_time_ms=metrics["avg_task_completion_time_ms"],
        success_rate=metrics["success_rate"],
        pheromone_trails_active=metrics["pheromone_trails_active"],
        conflict_rate=metrics["conflict_rate"],
        learning_velocity=metrics["learning_velocity"],
        agents=status["agents"],
        registered_agent_classes=status["registered_agent_classes"],
    )


@router.get("/agents", response_model=AgentListResponse)
async def list_agents(
    agent_class: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> AgentListResponse:
    """List all agents in the swarm with optional filtering."""
    swarm = get_orchestrator()

    # Initialize if needed
    if not swarm.agents:
        await swarm.initialize_default_swarm()

    agents = []
    by_class = {}

    for agent_id, agent in swarm.agents.items():
        # Apply filters
        if agent_class and agent.agent_class.value != agent_class:
            continue
        if status and agent.status.value != status:
            continue

        agent_info = agent.get_metrics()
        agents.append(agent_info)

        # Count by class
        class_name = agent.agent_class.value
        by_class[class_name] = by_class.get(class_name, 0) + 1

    return AgentListResponse(agents=agents, total_count=len(agents), by_class=by_class)


@router.get("/agents/{agent_id}")
async def get_agent_details(
    agent_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Get detailed information about a specific agent."""
    swarm = get_orchestrator()

    if agent_id not in swarm.agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Agent {agent_id} not found"
        )

    agent = swarm.agents[agent_id]

    return {
        "agent_id": agent.agent_id,
        "agent_type": agent.agent_type,
        "agent_class": agent.agent_class.value,
        "status": agent.status.value,
        "capabilities": [
            {"name": cap.name, "description": cap.description}
            for cap in agent.capabilities.values()
        ],
        "metrics": agent.get_metrics(),
        "current_task": str(agent.current_task.task_id) if agent.current_task else None,
        "executed_tasks_count": len(agent.executed_tasks),
    }


@router.get("/pheromones")
async def get_pheromone_trails(
    location: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> List[PheromoneTrailResponse]:
    """
    Get active pheromone trails.

    Pheromone trails are left by agents during successful task execution
    and guide other agents to follow successful paths.
    """
    swarm = get_orchestrator()

    if location:
        trails = await swarm.memory.sense_pheromones(location, current_user.organization_id)
    else:
        # Would get all trails in real implementation
        trails = []

    return [
        PheromoneTrailResponse(
            location=trail.location,
            data_type=trail.data_type,
            strength=trail.strength,
            hint=trail.hint,
            metadata=trail.metadata,
            created_at=trail.created_at.isoformat(),
        )
        for trail in trails
    ]


@router.post("/emergency-stop")
async def emergency_stop(
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """
    Emergency stop all swarm activities.

    This will cancel all active tasks and set all agents to offline.
    Use with caution!
    """
    swarm = get_orchestrator()
    await swarm.emergency_stop()

    return {"status": "stopped", "message": "All swarm activities have been halted"}


@router.post("/initialize")
async def initialize_swarm(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Initialize the swarm with default agents."""
    swarm = get_orchestrator()
    await swarm.initialize_default_swarm()

    return {
        "status": "initialized",
        "agent_count": len(swarm.agents),
        "agents": [
            {"id": a.agent_id, "type": a.agent_type, "class": a.agent_class.value}
            for a in swarm.agents.values()
        ],
    }


@router.post("/shutdown")
async def shutdown_swarm(
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    """Gracefully shutdown the swarm."""
    swarm = get_orchestrator()
    await swarm.shutdown()

    return {"status": "shutdown", "message": "Swarm has been gracefully shutdown"}


# Predefined swarm task endpoints


@router.post("/tasks/analyze-deal/{deal_id}")
async def analyze_deal_with_swarm(
    deal_id: UUID,
    current_user: User = Depends(get_current_user),
) -> SubmitTaskResponse:
    """Analyze a deal using the agent swarm."""
    request = SubmitTaskRequest(
        task_type="analyze_deal_health",
        description=f"Analyze deal health for deal {deal_id}",
        priority="high",
        required_capabilities=["analyze_deal_health"],
        optimal_swarm_size=3,
        input_payload={"deal_id": str(deal_id)},
        context_location=f"deal:{deal_id}",
    )

    return await submit_task(request, db=None, current_user=current_user)


@router.post("/tasks/draft-reply")
async def draft_reply_with_swarm(
    email_id: str,
    tone: str = "professional",
    current_user: User = Depends(get_current_user),
) -> SubmitTaskResponse:
    """Draft an email reply using the agent swarm."""
    request = SubmitTaskRequest(
        task_type="draft_reply",
        description=f"Draft reply to email {email_id}",
        priority="normal",
        required_capabilities=["draft_reply"],
        optimal_swarm_size=2,
        input_payload={"email_id": email_id, "tone": tone},
    )

    return await submit_task(request, db=None, current_user=current_user)


@router.post("/tasks/create-follow-up")
async def create_follow_up_task(
    entity_type: str,  # deal, contact, email
    entity_id: str,
    current_user: User = Depends(get_current_user),
) -> SubmitTaskResponse:
    """Create a follow-up task using the agent swarm."""
    request = SubmitTaskRequest(
        task_type="create_task",
        description=f"Create follow-up task for {entity_type} {entity_id}",
        priority="normal",
        required_capabilities=["create_task"],
        optimal_swarm_size=1,
        input_payload={
            "entity_type": entity_type,
            "entity_id": entity_id,
            "task_type": "follow_up",
            "assignee": str(current_user.id),
        },
        context_location=f"{entity_type}:{entity_id}",
    )

    return await submit_task(request, db=None, current_user=current_user)
