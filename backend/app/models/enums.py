from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    admin = "admin"
    manager = "manager"
    rep = "rep"


class ContactStatus(str, Enum):
    lead = "lead"
    active = "active"
    inactive = "inactive"
    customer = "customer"


class DealStage(str, Enum):
    lead = "lead"
    qualified = "qualified"
    proposal = "proposal"
    negotiation = "negotiation"
    closed_won = "closed_won"
    closed_lost = "closed_lost"


class MessageDirection(str, Enum):
    inbound = "inbound"
    outbound = "outbound"


class MessageChannel(str, Enum):
    email = "email"
    chat = "chat"
    api = "api"


class TaskStatus(str, Enum):
    open = "open"
    in_progress = "in_progress"
    done = "done"
    cancelled = "cancelled"


class TaskSource(str, Enum):
    manual = "manual"
    automation = "automation"


class ProjectStatus(str, Enum):
    planned = "planned"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    cancelled = "cancelled"


class EventSource(str, Enum):
    api = "api"
    automation = "automation"
    ai = "ai"
    system = "system"
