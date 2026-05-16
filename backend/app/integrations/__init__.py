"""Integration services for external platforms."""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event


class SlackIntegration:
    """Slack integration for notifications."""

    def __init__(self, webhook_url: Optional[str] = None, bot_token: Optional[str] = None):
        self.webhook_url = webhook_url
        self.bot_token = bot_token
        self.client = httpx.AsyncClient()

    async def send_notification(
        self,
        message: str,
        channel: Optional[str] = None,
        attachments: Optional[List[Dict]] = None,
        blocks: Optional[List[Dict]] = None,
    ) -> Dict[str, Any]:
        """Send notification to Slack."""
        if not self.webhook_url and not self.bot_token:
            return {"success": False, "error": "Slack not configured"}

        payload = {
            "text": message,
        }

        if channel and self.bot_token:
            payload["channel"] = channel

        if attachments:
            payload["attachments"] = attachments

        if blocks:
            payload["blocks"] = blocks

        try:
            if self.webhook_url:
                response = await self.client.post(self.webhook_url, json=payload)
            else:
                response = await self.client.post(
                    "https://slack.com/api/chat.postMessage",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.bot_token}"},
                )

            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response": response.json() if response.status_code == 200 else None,
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def send_deal_won_notification(
        self,
        deal_name: str,
        deal_value: float,
        customer_name: str,
        channel: str = "#sales",
    ) -> Dict[str, Any]:
        """Send deal won celebration to Slack."""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🎉 Deal Won!",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Deal:*\n{deal_name}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Value:*\n${deal_value:,.2f}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Customer:*\n{customer_name}",
                    },
                ],
            },
        ]

        return await self.send_notification(
            message=f"Deal won: {deal_name} - ${deal_value:,.2f}",
            channel=channel,
            blocks=blocks,
        )

    async def send_task_reminder(
        self,
        task_title: str,
        due_date: datetime,
        assignee_name: str,
        channel: str = "#tasks",
    ) -> Dict[str, Any]:
        """Send task reminder to Slack."""
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "⏰ Task Reminder",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Task:*\n{task_title}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Due:*\n{due_date.strftime('%Y-%m-%d %H:%M')}",
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Assigned to:*\n{assignee_name}",
                    },
                ],
            },
        ]

        return await self.send_notification(
            message=f"Task reminder: {task_title}",
            channel=channel,
            blocks=blocks,
        )


class GoogleCalendarIntegration:
    """Google Calendar integration for meeting scheduling."""

    def __init__(self, credentials_json: Optional[str] = None, access_token: Optional[str] = None):
        self.credentials_json = credentials_json
        self.access_token = access_token
        self.client = httpx.AsyncClient()

    async def create_meeting(
        self,
        title: str,
        start_time: datetime,
        end_time: datetime,
        attendees: List[str],
        description: Optional[str] = None,
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a Google Calendar event."""
        if not self.access_token:
            return {"success": False, "error": "Google Calendar not authenticated"}

        event = {
            "summary": title,
            "start": {
                "dateTime": start_time.isoformat(),
                "timeZone": "UTC",
            },
            "end": {
                "dateTime": end_time.isoformat(),
                "timeZone": "UTC",
            },
            "attendees": [{"email": email} for email in attendees],
        }

        if description:
            event["description"] = description

        if location:
            event["location"] = location

        try:
            response = await self.client.post(
                "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                json=event,
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "event_id": data["id"],
                    "event_link": data["htmlLink"],
                    "start": data["start"],
                    "end": data["end"],
                }
            else:
                return {
                    "success": False,
                    "error": f"Google Calendar API error: {response.status_code}",
                    "details": response.text,
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def list_available_slots(
        self,
        date: datetime,
        duration_minutes: int = 30,
        attendees: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """List available time slots for a date."""
        if not self.access_token:
            return {"success": False, "error": "Google Calendar not authenticated"}

        # This is a simplified implementation
        # In production, you'd query free/busy API
        suggested_slots = []
        base_time = date.replace(hour=9, minute=0, second=0, microsecond=0)

        for i in range(8):  # 9 AM to 5 PM
            slot_start = base_time + timedelta(minutes=i * 60)
            slot_end = slot_start + timedelta(minutes=duration_minutes)

            suggested_slots.append(
                {
                    "start": slot_start.isoformat(),
                    "end": slot_end.isoformat(),
                }
            )

        return {
            "success": True,
            "date": date.isoformat(),
            "duration_minutes": duration_minutes,
            "suggested_slots": suggested_slots,
        }


class ZoomIntegration:
    """Zoom integration for video conferencing."""

    def __init__(self, api_key: Optional[str] = None, api_secret: Optional[str] = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.client = httpx.AsyncClient()

    async def create_meeting(
        self,
        topic: str,
        start_time: datetime,
        duration_minutes: int = 30,
        password: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a Zoom meeting."""
        if not self.api_key:
            return {"success": False, "error": "Zoom not configured"}

        meeting = {
            "topic": topic,
            "type": 2,  # Scheduled meeting
            "start_time": start_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "duration": duration_minutes,
            "timezone": "UTC",
            "settings": {
                "host_video": True,
                "participant_video": True,
                "join_before_host": False,
                "mute_upon_entry": True,
                "waiting_room": True,
            },
        }

        if password:
            meeting["password"] = password

        try:
            # Note: In production, you'd use OAuth or JWT token
            response = await self.client.post(
                "https://api.zoom.us/v2/users/me/meetings",
                json=meeting,
                headers={"Authorization": f"Bearer {self.api_key}"},
            )

            if response.status_code == 201:
                data = response.json()
                return {
                    "success": True,
                    "meeting_id": data["id"],
                    "join_url": data["join_url"],
                    "start_url": data["start_url"],
                    "password": data.get("password"),
                    "topic": data["topic"],
                }
            else:
                return {
                    "success": False,
                    "error": f"Zoom API error: {response.status_code}",
                    "details": response.text,
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def generate_meeting_link(
        self,
        topic: str,
        start_time: datetime,
        duration_minutes: int = 30,
    ) -> Dict[str, Any]:
        """Generate a Zoom meeting link quickly."""
        return await self.create_meeting(topic, start_time, duration_minutes)


class IntegrationManager:
    """Central manager for all integrations."""

    def __init__(
        self,
        slack_webhook: Optional[str] = None,
        slack_token: Optional[str] = None,
        google_credentials: Optional[str] = None,
        google_token: Optional[str] = None,
        zoom_api_key: Optional[str] = None,
    ):
        self.slack = SlackIntegration(slack_webhook, slack_token)
        self.calendar = GoogleCalendarIntegration(google_credentials, google_token)
        self.zoom = ZoomIntegration(zoom_api_key)

    async def execute_integration_action(
        self,
        action_type: str,
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute an integration action."""
        try:
            if action_type == "slack_notification":
                return await self.slack.send_notification(
                    message=params["message"],
                    channel=params.get("channel"),
                )

            elif action_type == "slack_deal_won":
                return await self.slack.send_deal_won_notification(
                    deal_name=params["deal_name"],
                    deal_value=params["deal_value"],
                    customer_name=params["customer_name"],
                    channel=params.get("channel", "#sales"),
                )

            elif action_type == "calendar_create_event":
                start = datetime.fromisoformat(params["start_time"])
                end = datetime.fromisoformat(params["end_time"])
                return await self.calendar.create_meeting(
                    title=params["title"],
                    start_time=start,
                    end_time=end,
                    attendees=params.get("attendees", []),
                    description=params.get("description"),
                    location=params.get("location"),
                )

            elif action_type == "zoom_create_meeting":
                start = datetime.fromisoformat(params["start_time"])
                return await self.zoom.create_meeting(
                    topic=params["topic"],
                    start_time=start,
                    duration_minutes=params.get("duration_minutes", 30),
                    password=params.get("password"),
                )

            else:
                return {"success": False, "error": f"Unknown integration action: {action_type}"}

        except Exception as e:
            return {"success": False, "error": str(e)}


# Global integration manager instance
integration_manager: Optional[IntegrationManager] = None


def get_integration_manager() -> IntegrationManager:
    """Get or create the global integration manager."""
    global integration_manager
    if integration_manager is None:
        # Initialize with environment variables
        import os

        integration_manager = IntegrationManager(
            slack_webhook=os.getenv("SLACK_WEBHOOK_URL"),
            slack_token=os.getenv("SLACK_BOT_TOKEN"),
            google_credentials=os.getenv("GOOGLE_CREDENTIALS_JSON"),
            google_token=os.getenv("GOOGLE_ACCESS_TOKEN"),
            zoom_api_key=os.getenv("ZOOM_API_KEY"),
        )
    return integration_manager
