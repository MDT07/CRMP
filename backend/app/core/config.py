from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "CRMP Backend"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(
        default="replace-this-with-a-long-random-local-secret",
    )
    access_token_expire_minutes: int = 60 * 8
    database_url: str = "postgresql+asyncpg://crmp:crmp@localhost:5432/crmp"
    redis_url: str = "redis://localhost:6379/0"
    allowed_cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    session_cookie_name: str = "crmp_session"
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    sql_echo: bool = False
    kafka_enabled: bool = False
    kafka_bootstrap_servers: str = "localhost:9092"
    kafka_topic_events: str = "crmp.events"
    llm_base_url: str = "http://127.0.0.1:1234/v1"
    llm_api_key: str = ""
    lm_api_token: str = ""
    llm_model: str = "local-model"
    llm_model_chat: str = "local-model"
    llm_model_agent: str = "local-model"
    llm_model_project_intel: str = "local-model"
    lm_studio_api_mode: str = "auto"
    local_ai_only: bool = True
    ai_cache_ttl_seconds: int = 900
    rate_limit_ai_requests_per_minute: int = 30

    # Nemotron-3-Nano-4B Configuration
    nemotron_enabled: bool = True
    nemotron_model_id: str = "nvidia/nemotron-3-nano-4b"
    nemotron_temperature: float = 0.3
    nemotron_max_tokens: int = 1024
    nemotron_top_p: float = 0.9
    nemotron_top_k: int = 40
    nemotron_repetition_penalty: float = 1.1
    nemotron_context_window: int = 4096
    nemotron_fallback_on_error: bool = True
    api_key_rate_limit_requests_per_minute: int = 240
    api_key_invalid_attempts_per_minute: int = 60
    event_worker_enabled: bool = True
    event_worker_interval_seconds: float = 2.0
    telemetry_enabled: bool = True
    telemetry_exporter_mode: str = "console"
    telemetry_service_name: str = "crmp-backend"
    telemetry_otlp_endpoint: str = ""
    project_assistant_root: str = str(BACKEND_DIR.parent)
    project_assistant_max_files: int = 3000

    # Email OAuth Settings
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = "http://localhost:5173/email/oauth/callback"
    outlook_client_id: str = ""
    outlook_client_secret: str = ""
    outlook_redirect_uri: str = "http://localhost:5173/email/oauth/callback"
    oauth_state_secret: str = "replace-with-random-secret-for-oauth-state"
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    @field_validator("allowed_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str] | tuple[str, ...] | None) -> list[str]:
        if isinstance(value, list):
            return value
        if isinstance(value, tuple):
            return [origin.strip() for origin in value if origin.strip()]
        if not value:
            return []
        return [origin.strip() for origin in value.split(",") if origin.strip()]

    @field_validator("secret_key", mode="before")
    @classmethod
    def normalize_secret_key(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if len(normalized) >= 32:
            return normalized
        if not normalized:
            return "replace-this-with-a-long-random-local-secret"

        padded = f"{normalized}-private-local-secret"
        if len(padded) < 32:
            padded = padded.ljust(32, "0")
        return padded

    @field_validator(
        "debug",
        "sql_echo",
        "session_cookie_secure",
        "kafka_enabled",
        "local_ai_only",
        "event_worker_enabled",
        "telemetry_enabled",
        mode="before",
    )
    @classmethod
    def parse_boolean_like_values(cls, value: bool | str | None) -> bool | None:
        if isinstance(value, bool) or value is None:
            return value

        normalized = value.strip().lower()
        truthy_values = {"1", "true", "yes", "on", "debug", "development", "dev"}
        falsy_values = {"0", "false", "no", "off", "release", "production", "prod"}

        if normalized in truthy_values:
            return True
        if normalized in falsy_values:
            return False
        return value

    @field_validator("lm_studio_api_mode", mode="before")
    @classmethod
    def normalize_lm_studio_api_mode(cls, value: str | None) -> str:
        normalized = (value or "auto").strip().lower()
        allowed_modes = {"auto", "native", "openai"}
        if normalized not in allowed_modes:
            raise ValueError("LM_STUDIO_API_MODE must be one of: auto, native, openai.")
        return normalized

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
