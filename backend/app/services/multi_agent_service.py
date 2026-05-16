"""Multi-Agent Service for CRMP.

Provides high-level interface for the multi-agent system.
"""

from __future__ import annotations

import logging
from typing import Any, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.agent_orchestrator import (
    AgentOrchestrator,
)
from app.ai.agent_framework import AgentResult

logger = logging.getLogger(__name__)


class MultiAgentService:
    """Service for managing multi-agent CRM operations."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self._orchestrators: dict[str, AgentOrchestrator] = {}

    def _get_orchestrator(
        self,
        organization_id: UUID,
        user_id: UUID,
    ) -> AgentOrchestrator:
        """Get or create an orchestrator for the user."""
        key = f"{organization_id}_{user_id}"
        if key not in self._orchestrators:
            self._orchestrators[key] = AgentOrchestrator(
                organization_id=organization_id,
                user_id=user_id,
                session=self.session,
            )
        return self._orchestrators[key]

    async def query(
        self,
        organization_id: UUID,
        user_id: UUID,
        query: str,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Route a query to the best agent and get response."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        result = await orchestrator.route_and_execute(query, params or {})

        return {
            "success": result.success,
            "query": query,
            "response": result.output,
            "agent": {
                "id": result.agent_id,
                "role": result.agent_role,
            },
            "execution_time_ms": result.execution_time_ms,
            "error": result.error,
        }

    async def execute_with_agent(
        self,
        organization_id: UUID,
        user_id: UUID,
        agent_id: str,
        task_type: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a specific task with a specific agent."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        result = await orchestrator.execute_single_agent(agent_id, task_type, params)

        return {
            "success": result.success,
            "agent_id": result.agent_id,
            "agent_role": result.agent_role,
            "task_type": result.task_type,
            "output": result.output,
            "execution_time_ms": result.execution_time_ms,
            "error": result.error,
        }

    async def execute_collaborative(
        self,
        organization_id: UUID,
        user_id: UUID,
        task_description: str,
        required_capabilities: list[str],
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """Execute a task requiring collaboration between multiple agents."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        results = await orchestrator.execute_collaborative(
            task_description,
            required_capabilities,
            params,
        )

        return {
            "success": all(r.success for r in results),
            "task_description": task_description,
            "agents_involved": len(results),
            "results": [r.to_dict() for r in results],
            "summary": self._summarize_collaborative_results(results),
        }

    def _summarize_collaborative_results(
        self,
        results: list[AgentResult],
    ) -> dict[str, Any]:
        """Create a summary of collaborative results."""
        successful = [r for r in results if r.success]
        failed = [r for r in results if not r.success]

        return {
            "total_agents": len(results),
            "successful": len(successful),
            "failed": len(failed),
            "combined_outputs": {r.agent_role: r.output for r in successful},
            "errors": [r.error for r in failed if r.error],
        }

    async def run_workflow(
        self,
        organization_id: UUID,
        user_id: UUID,
        workflow_name: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """Run a predefined multi-agent workflow."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        execution = await orchestrator.run_predefined_workflow(workflow_name, params)

        if not execution:
            return {
                "success": False,
                "error": f"Workflow '{workflow_name}' not found",
            }

        return {
            "success": execution.status in ["completed", "completed_with_errors"],
            "execution_id": execution.execution_id,
            "workflow_name": execution.workflow_name,
            "status": execution.status,
            "steps_completed": execution.steps_completed,
            "steps_failed": execution.steps_failed,
            "results": {step_id: result.to_dict() for step_id, result in execution.results.items()},
            "shared_data": execution.shared_data,
            "started_at": execution.started_at,
            "completed_at": execution.completed_at,
            "error": execution.error,
        }

    async def get_status(
        self,
        organization_id: UUID,
        user_id: UUID,
    ) -> dict[str, Any]:
        """Get status of the multi-agent system."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        return {
            "orchestrator_status": orchestrator.get_agent_status(),
            "available_workflows": orchestrator.list_predefined_workflows(),
        }

    async def list_agents(
        self,
        organization_id: UUID,
        user_id: UUID,
    ) -> list[dict[str, Any]]:
        """List all available agents."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        return [
            {
                "agent_id": agent_id,
                "role": agent.role.value,
                "status": agent.status.value,
                "capabilities": [
                    {
                        "name": cap.name,
                        "description": cap.description,
                    }
                    for cap in agent.capabilities
                ],
            }
            for agent_id, agent in orchestrator.agents.items()
        ]

    async def chat(
        self,
        organization_id: UUID,
        user_id: UUID,
        message: str,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Chat with the multi-agent system."""
        orchestrator = self._get_orchestrator(organization_id, user_id)

        # Add conversation context
        if context:
            for msg in context.get("conversation_history", []):
                orchestrator.context.add_to_history(
                    msg.get("role", "user"),
                    msg.get("content", ""),
                )

        # Route and execute
        result = await orchestrator.route_and_execute(message)

        return {
            "success": result.success,
            "message": message,
            "response": result.output.get("response") if result.output else None,
            "agent_used": {
                "id": result.agent_id,
                "role": result.agent_role,
            },
            "suggested_actions": self._extract_suggested_actions(result),
            "execution_time_ms": result.execution_time_ms,
        }

    def _extract_suggested_actions(self, result: AgentResult) -> list[dict[str, Any]]:
        """Extract suggested actions from agent result."""
        actions = []

        if result.output:
            # Check for common action fields
            if "next_best_action" in result.output:
                actions.append(
                    {
                        "type": "action",
                        "description": result.output["next_best_action"],
                    }
                )

            if "recommended_next_steps" in result.output:
                for step in result.output["recommended_next_steps"]:
                    actions.append(
                        {
                            "type": "step",
                            "description": step,
                        }
                    )

            if "strategies" in result.output:
                for strategy in result.output["strategies"]:
                    actions.append(
                        {
                            "type": "strategy",
                            "description": strategy,
                        }
                    )

        return actions
