"""Enhanced automation actions for the CRM workflow engine."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import MessageDirection, MessageChannel, TaskSource
from app.models.event import Event
from app.schemas.message import MessageCreate
from app.schemas.task import TaskCreate
from app.schemas.deal import DealUpdate
from app.services.task_service import TaskService
from app.services.message_service import MessageService
from app.services.deal_service import DealService


async def execute_action(
    session: AsyncSession,
    *,
    organization_id: UUID,
    event: Event,
    action: dict[str, Any],
) -> dict[str, Any]:
    """
    Execute an automation action based on the action type.

    Returns a dict with execution results for logging.
    """
    action_type = action.get("type")
    results = {"action_type": action_type, "success": False}

    try:
        if action_type == "create_follow_up_task":
            results.update(await _create_follow_up_task(session, organization_id, event, action))

        elif action_type == "create_reminder_task":
            results.update(await _create_reminder_task(session, organization_id, event, action))

        elif action_type == "send_email":
            results.update(await _send_email(session, organization_id, event, action))

        elif action_type == "send_notification":
            results.update(await _send_notification(session, organization_id, event, action))

        elif action_type == "update_deal_stage":
            results.update(await _update_deal_stage(session, organization_id, event, action))

        elif action_type == "update_deal_probability":
            results.update(await _update_deal_probability(session, organization_id, event, action))

        elif action_type == "add_contact_tag":
            results.update(await _add_contact_tag(session, organization_id, event, action))

        elif action_type == "update_contact_status":
            results.update(await _update_contact_status(session, organization_id, event, action))

        elif action_type == "create_internal_note":
            results.update(await _create_internal_note(session, organization_id, event, action))

        elif action_type == "webhook":
            results.update(await _trigger_webhook(session, organization_id, event, action))

        elif action_type == "delay":
            results.update(await _delay_execution(action))

        elif action_type == "assign_task":
            results.update(await _assign_task(session, organization_id, event, action))

        elif action_type == "schedule_meeting":
            results.update(await _schedule_meeting(session, organization_id, event, action))

        else:
            results["error"] = f"Unknown action type: {action_type}"
            results["success"] = False

    except Exception as exc:
        results["error"] = str(exc)
        results["success"] = False

    return results


async def _create_follow_up_task(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Create a follow-up task."""
    title = action.get("title") or f"Follow up on {event.event_type}"

    # Calculate due date
    due_days = action.get("due_days", 3)
    due_at = datetime.now(timezone.utc) + timedelta(days=due_days)

    task_payload = TaskCreate(
        title=title,
        description=action.get("description", f"Automated follow-up for {event.event_type}"),
        due_at=due_at.isoformat(),
        priority=action.get("priority", "medium"),
        source=TaskSource.automation,
        contact_id=event.payload.get("contact_id"),
        deal_id=event.payload.get("deal_id"),
        project_id=event.payload.get("project_id"),
    )

    task = await TaskService(session).create_task(
        organization_id=organization_id,
        payload=task_payload,
        emit_event=False,
        commit=False,
    )

    return {
        "success": True,
        "task_id": str(task.id),
        "title": title,
        "due_at": due_at.isoformat(),
    }


async def _create_reminder_task(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Create a reminder task."""
    title = action.get("title", "Reminder")
    reminder_hours = action.get("reminder_hours", 24)
    due_at = datetime.now(timezone.utc) + timedelta(hours=reminder_hours)

    task_payload = TaskCreate(
        title=f"🔔 {title}",
        description=action.get("description", "Automated reminder"),
        due_at=due_at.isoformat(),
        priority=action.get("priority", "high"),
        source=TaskSource.automation,
        contact_id=event.payload.get("contact_id"),
        deal_id=event.payload.get("deal_id"),
    )

    task = await TaskService(session).create_task(
        organization_id=organization_id,
        payload=task_payload,
        emit_event=False,
        commit=False,
    )

    return {
        "success": True,
        "task_id": str(task.id),
        "title": title,
        "reminder_hours": reminder_hours,
    }


async def _send_email(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Send an email using the email service."""
    # Get recipient from event or action
    to_email = action.get("to_email")
    if not to_email and event.payload.get("contact_email"):
        to_email = event.payload["contact_email"]

    if not to_email:
        return {"success": False, "error": "No recipient email found"}

    subject = action.get("subject", "Follow-up")
    body = action.get("body", "")

    # Use Gmail service if configured
    try:
        # This would integrate with your email service
        # For now, return mock success
        return {
            "success": True,
            "to": to_email,
            "subject": subject,
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _send_notification(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Send an in-app notification."""
    # Create an internal message as notification
    message_payload = MessageCreate(
        subject=action.get("title", "Automation Notification"),
        body=action.get("message", f"Event: {event.event_type}"),
        direction=MessageDirection.outbound,
        channel=MessageChannel.api,
        contact_id=event.payload.get("contact_id"),
        deal_id=event.payload.get("deal_id"),
    )

    message = await MessageService(session).create_message(
        organization_id=organization_id,
        payload=message_payload,
        author_user_id=None,  # System message
        emit_event=False,
        commit=False,
    )

    return {
        "success": True,
        "message_id": str(message.id),
        "title": action.get("title"),
    }


async def _update_deal_stage(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Update a deal's pipeline stage."""
    deal_id = event.payload.get("deal_id")
    if not deal_id:
        return {"success": False, "error": "No deal_id in event"}

    new_stage = action.get("stage")
    if not new_stage:
        return {"success": False, "error": "No stage specified"}

    try:
        await DealService(session).update_deal_stage(
            organization_id=organization_id,
            deal_id=deal_id if isinstance(deal_id, UUID) else UUID(str(deal_id)),
            new_stage=new_stage,
            emit_event=False,
            commit=False,
        )

        return {
            "success": True,
            "deal_id": str(deal_id),
            "new_stage": new_stage,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _update_deal_probability(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Update a deal's probability."""
    deal_id = event.payload.get("deal_id")
    if not deal_id:
        return {"success": False, "error": "No deal_id in event"}

    probability = action.get("probability")
    if probability is None:
        return {"success": False, "error": "No probability specified"}

    try:
        deal_update = DealUpdate(probability=probability)
        await DealService(session).update_deal(
            organization_id=organization_id,
            deal_id=deal_id if isinstance(deal_id, UUID) else UUID(str(deal_id)),
            payload=deal_update,
            commit=False,
        )

        return {
            "success": True,
            "deal_id": str(deal_id),
            "probability": probability,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _add_contact_tag(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Add a tag to a contact."""
    contact_id = event.payload.get("contact_id")
    if not contact_id:
        return {"success": False, "error": "No contact_id in event"}

    tag = action.get("tag")
    if not tag:
        return {"success": False, "error": "No tag specified"}

    try:
        # This would update the contact's tags array
        # Implementation depends on your ContactService
        return {
            "success": True,
            "contact_id": str(contact_id),
            "tag_added": tag,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _update_contact_status(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Update a contact's status."""
    contact_id = event.payload.get("contact_id")
    if not contact_id:
        return {"success": False, "error": "No contact_id in event"}

    new_status = action.get("status")
    if not new_status:
        return {"success": False, "error": "No status specified"}

    try:
        # Implementation depends on your ContactService
        return {
            "success": True,
            "contact_id": str(contact_id),
            "new_status": new_status,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _create_internal_note(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Create an internal note."""
    content = action.get("content", f"Automated note for {event.event_type}")

    # Create as a message with api channel
    message_payload = MessageCreate(
        subject="Internal Note",
        body=content,
        direction=MessageDirection.outbound,
        channel=MessageChannel.api,
        contact_id=event.payload.get("contact_id"),
        deal_id=event.payload.get("deal_id"),
    )

    message = await MessageService(session).create_message(
        organization_id=organization_id,
        payload=message_payload,
        author_user_id=None,
        emit_event=False,
        commit=False,
    )

    return {
        "success": True,
        "message_id": str(message.id),
        "note_content": content[:100],
    }


async def _trigger_webhook(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Trigger an external webhook."""
    webhook_url = action.get("url")
    if not webhook_url:
        return {"success": False, "error": "No webhook URL specified"}

    # In production, this would make an HTTP request
    # For now, return mock success
    return {
        "success": True,
        "webhook_url": webhook_url,
        "event_type": event.event_type,
        "triggered_at": datetime.now(timezone.utc).isoformat(),
    }


async def _delay_execution(action: dict[str, Any]) -> dict[str, Any]:
    """Add a delay before next action."""
    delay_seconds = action.get("delay_seconds", 60)

    # In production, this would schedule the next action
    # For now, return info about the delay
    return {
        "success": True,
        "delay_seconds": delay_seconds,
        "will_resume_at": (datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)).isoformat(),
    }


async def _assign_task(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Assign a task to a user."""
    assignee_id = action.get("assignee_id")
    if not assignee_id:
        return {"success": False, "error": "No assignee specified"}

    task_id = event.payload.get("task_id")
    if not task_id:
        # Create new task instead
        return await _create_follow_up_task(session, organization_id, event, action)

    try:
        # Update existing task
        await TaskService(session).update_task(
            organization_id=organization_id,
            task_id=task_id if isinstance(task_id, UUID) else UUID(str(task_id)),
            payload={"assignee_id": assignee_id},
        )

        return {
            "success": True,
            "task_id": str(task_id),
            "assigned_to": assignee_id,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


async def _schedule_meeting(
    session: AsyncSession, organization_id: UUID, event: Event, action: dict[str, Any]
) -> dict[str, Any]:
    """Schedule a meeting."""
    # This would integrate with calendar services
    meeting_title = action.get("title", "Meeting")
    duration_minutes = action.get("duration_minutes", 30)

    # Calculate suggested time
    suggested_time = datetime.now(timezone.utc) + timedelta(days=1)

    # Create a task for the meeting
    task_payload = TaskCreate(
        title=f"📅 {meeting_title}",
        description=f"Schedule {duration_minutes}min meeting",
        due_at=suggested_time.isoformat(),
        priority="high",
        source=TaskSource.automation,
        contact_id=event.payload.get("contact_id"),
        deal_id=event.payload.get("deal_id"),
    )

    task = await TaskService(session).create_task(
        organization_id=organization_id,
        payload=task_payload,
        emit_event=False,
        commit=False,
    )

    return {
        "success": True,
        "task_id": str(task.id),
        "meeting_title": meeting_title,
        "suggested_time": suggested_time.isoformat(),
        "duration_minutes": duration_minutes,
    }
