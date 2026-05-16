"""Stub for swarm core."""
from __future__ import annotations
from typing import Any
from enum import Enum


class PriorityLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class SwarmContext:
    def __init__(self, **kwargs: Any) -> None:
        pass


class SwarmTask:
    def __init__(self, **kwargs: Any) -> None:
        pass
