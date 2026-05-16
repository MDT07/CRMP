"""API routes for integrations."""

from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.dependencies import get_current_user
from app.integrations import get_integration_manager
from app.models.user import User

router = APIRouter(prefix="/integrations", tags=["integrations"])


# Request/Response Models


class SlackNotificationRequest(BaseModel):
    message: str = Field(..., description="Message to send")
    channel: Optional[str] = Field(None, description="Slack channel")
    attachments: Optional[list] = Field(None, description="Slack attachments")


class CalendarEventRequest(BaseModel):
    title: str = Field(..., description="Event title")
    start_time: str = Field(..., description="Start time ISO format")
    end_time: str = Field(..., description="End time ISO format")
    attendees: list[str] = Field(default_factory=list, description="Attendee emails")
    description: Optional[str] = Field(None, description="Event description")
    location: Optional[str] = Field(None, description="Event location")


class ZoomMeetingRequest(BaseModel):
    topic: str = Field(..., description="Meeting topic")
    start_time: str = Field(..., description="Start time ISO format")
    duration_minutes: int = Field(default=30, ge=15, le=240)
    password: Optional[str] = Field(None, description="Meeting password")


class IntegrationStatusResponse(BaseModel):
    slack: bool = Field(description="Slack integration status")
    calendar: bool = Field(description="Google Calendar integration status")
    zoom: bool = Field(description="Zoom integration status")


# Routes


@router.get("/status", response_model=IntegrationStatusResponse)
async def get_integration_status(
    current_user: User = Depends(get_current_user),
) -> IntegrationStatusResponse:
    """Get status of all integrations."""
    manager = get_integration_manager()

    return IntegrationStatusResponse(
        slack=manager.slack.webhook_url is not None or manager.slack.bot_token is not None,
        calendar=manager.calendar.access_token is not None,
        zoom=manager.zoom.api_key is not None,
    )


@router.post("/slack/notify")
async def send_slack_notification(
    request: SlackNotificationRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Send notification to Slack."""
    manager = get_integration_manager()

    result = await manager.slack.send_notification(
        message=request.message,
        channel=request.channel,
        attachments=request.attachments,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("error", "Failed to send Slack notification"),
        )

    return result


@router.post("/slack/deal-won")
async def send_deal_won_notification(
    deal_name: str,
    deal_value: float,
    customer_name: str,
    channel: str = "#sales",
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Send deal won celebration to Slack."""
    manager = get_integration_manager()

    result = await manager.slack.send_deal_won_notification(
        deal_name=deal_name,
        deal_value=deal_value,
        customer_name=customer_name,
        channel=channel,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("error", "Failed to send Slack notification"),
        )

    return result


@router.post("/calendar/create-event")
async def create_calendar_event(
    request: CalendarEventRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a Google Calendar event."""
    manager = get_integration_manager()

    from datetime import datetime

    start = datetime.fromisoformat(request.start_time)
    end = datetime.fromisoformat(request.end_time)

    result = await manager.calendar.create_meeting(
        title=request.title,
        start_time=start,
        end_time=end,
        attendees=request.attendees,
        description=request.description,
        location=request.location,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("error", "Failed to create calendar event"),
        )

    return result


@router.post("/zoom/create-meeting")
async def create_zoom_meeting(
    request: ZoomMeetingRequest,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Create a Zoom meeting."""
    manager = get_integration_manager()

    from datetime import datetime

    start = datetime.fromisoformat(request.start_time)

    result = await manager.zoom.create_meeting(
        topic=request.topic,
        start_time=start,
        duration_minutes=request.duration_minutes,
        password=request.password,
    )

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("error", "Failed to create Zoom meeting"),
        )

    return result


@router.post("/execute")
async def execute_integration_action(
    action_type: str,
    params: Dict[str, Any],
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Execute a generic integration action."""
    manager = get_integration_manager()

    result = await manager.execute_integration_action(action_type, params)

    if not result["success"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result.get("error", "Integration action failed"),
        )

    return result
