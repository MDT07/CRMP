"""Stub for nemotron config."""
from __future__ import annotations
from dataclasses import dataclass
from enum import Enum


class NemotronTaskType(str, Enum):
    chat = "chat"
    analysis = "analysis"
    email = "email"
    contact_analysis = "contact_analysis"
    deal_analysis = "deal_analysis"
    pipeline_analysis = "pipeline_analysis"
    task_prioritization = "task_prioritization"
    summary_generation = "summary_generation"
    automation_advice = "automation_advice"
    meeting_prep = "meeting_prep"
    follow_up = "follow_up"
    email_draft = "email_draft"


@dataclass
class NemotronModelConfig:
    model_id: str = "nvidia/nemotron-3-nano-4b"
    temperature: float = 0.3
    max_tokens: int = 1024
    top_p: float = 0.9
    top_k: int = 40
    repetition_penalty: float = 1.1
    context_window: int = 4096


@dataclass
class NemotronCapabilities:
    contact_analysis: bool = True
    deal_analysis: bool = True
    pipeline_analysis: bool = True
    email_drafting: bool = True
    follow_up_suggestions: bool = True
    meeting_preparation: bool = True
    task_prioritization: bool = True
    summary_generation: bool = True
    automation_advice: bool = True
    general_chat: bool = True


@dataclass
class NemotronConfig:
    model_config: NemotronModelConfig = None
    capabilities: NemotronCapabilities = None
    enabled: bool = True

    def __post_init__(self):
        if self.model_config is None:
            self.model_config = NemotronModelConfig()
        if self.capabilities is None:
            self.capabilities = NemotronCapabilities()


DEFAULT_NEMOTRON_CONFIG = NemotronConfig()
