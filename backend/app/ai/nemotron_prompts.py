"""Stub for nemotron prompts."""
from __future__ import annotations
from typing import Any


def get_nemotron_system_prompt(**kwargs: Any) -> str:
    return "You are a CRM assistant."


def nemotron_contact_analysis_prompt(**kwargs: Any) -> str:
    return "Analyze contact."


def nemotron_deal_analysis_prompt(**kwargs: Any) -> str:
    return "Analyze deal."


def nemotron_email_draft_prompt(**kwargs: Any) -> str:
    return "Draft email."


def nemotron_follow_up_suggestion_prompt(**kwargs: Any) -> str:
    return "Suggest follow-up."


def nemotron_meeting_prep_prompt(**kwargs: Any) -> str:
    return "Prepare meeting."


def nemotron_general_chat_prompt(**kwargs: Any) -> str:
    return "General chat."


def nemotron_automation_advice_prompt(**kwargs: Any) -> str:
    return "Automation advice."


def nemotron_multitask_prompt(**kwargs: Any) -> str:
    return "Multitask."


def nemotron_pipeline_analysis_prompt(**kwargs: Any) -> str:
    return "Pipeline analysis."


def nemotron_summary_generation_prompt(**kwargs: Any) -> str:
    return "Summary generation."


def nemotron_system_prompt(**kwargs: Any) -> str:
    return "System prompt."


def nemotron_task_prioritization_prompt(**kwargs: Any) -> str:
    return "Task prioritization."
