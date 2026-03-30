import pytest
from pydantic import ValidationError

from app.ai.llm_client import LLMClient
from app.core.config import get_settings


def test_local_llm_base_url_enables_client_without_api_key(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("LLM_API_KEY", "")

    client = LLMClient()

    assert client.is_local is True
    assert client.enabled is True

    get_settings.cache_clear()


def test_extract_json_object_from_chat_completion_payload() -> None:
    payload = {
        "choices": [
            {
                "message": {
                    "content": '```json\n{"title": "Follow up", "priority": "high"}\n```'
                }
            }
        ]
    }

    assert LLMClient._extract_json_object(payload) == {
        "title": "Follow up",
        "priority": "high",
    }


def test_extract_text_content_from_native_chat_payload() -> None:
    payload = {
        "output": [
            {
                "type": "message",
                "content": "Local LM Studio response",
            }
        ]
    }

    assert LLMClient._extract_text_content(payload) == "Local LM Studio response"


def test_extract_model_ids_prefers_loaded_models_when_reported() -> None:
    payload = {
        "data": [
            {"id": "qwen/qwen3.5-9b", "state": "loaded"},
            {"id": "meta-llama-3.1-8b-instruct", "state": "not-loaded"},
        ]
    }

    available_models, loaded_models = LLMClient._extract_model_ids(payload)

    assert available_models == [
        "qwen/qwen3.5-9b",
        "meta-llama-3.1-8b-instruct",
    ]
    assert loaded_models == ["qwen/qwen3.5-9b"]


def test_extract_model_ids_from_lmstudio_native_models_payload() -> None:
    payload = {
        "models": [
            {
                "key": "nvidia/nemotron-3-nano-4b",
                "loaded_instances": [
                    {"id": "local-model"},
                    {"id": "nvidia/nemotron-3-nano-4b"},
                ],
            },
            {
                "key": "text-embedding-nomic-embed-text-v1.5",
                "loaded_instances": [],
            },
        ]
    }

    available_models, loaded_models = LLMClient._extract_model_ids(payload)

    assert "nvidia/nemotron-3-nano-4b" in available_models
    assert "local-model" in loaded_models
    assert "nvidia/nemotron-3-nano-4b" in loaded_models


def test_openai_base_url_is_normalized_from_native_api_base(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1234/api/v1")
    monkeypatch.setenv("LLM_API_KEY", "")

    client = LLMClient()

    assert client.openai_base_url == "http://localhost:1234/v1"
    assert client.native_api_root == "http://localhost:1234"
    assert "http://localhost:1234/api/v1/models" in client._status_urls()
    assert "http://localhost:1234/v1/models" in client._status_urls()

    get_settings.cache_clear()


def test_status_urls_respect_native_mode(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("LM_STUDIO_API_MODE", "native")
    monkeypatch.setenv("LLM_API_KEY", "")

    client = LLMClient()

    assert client.use_native_api is True
    assert client.use_openai_compat is False
    assert client._status_urls() == ["http://localhost:1234/api/v1/models"]

    get_settings.cache_clear()


def test_status_urls_respect_openai_mode(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("LM_STUDIO_API_MODE", "openai")
    monkeypatch.setenv("LLM_API_KEY", "")

    client = LLMClient()
    urls = client._status_urls()

    assert client.use_native_api is False
    assert client.use_openai_compat is True
    assert "http://localhost:1234/v1/models" in urls
    assert "http://localhost:1234/api/v0/models" in urls
    assert "http://localhost:1234/api/v1/models" not in urls

    get_settings.cache_clear()


def test_invalid_lm_studio_api_mode_raises_validation_error(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("LM_STUDIO_API_MODE", "invalid-mode")

    with pytest.raises(ValidationError):
        LLMClient()

    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_remote_llm_is_disabled_when_local_ai_only(monkeypatch) -> None:
    get_settings.cache_clear()
    monkeypatch.setenv("LLM_BASE_URL", "https://api.example-llm.com/v1")
    monkeypatch.setenv("LLM_API_KEY", "secret")
    monkeypatch.setenv("LOCAL_AI_ONLY", "true")

    client = LLMClient()
    status = await client.get_status()

    assert client.remote_blocked is True
    assert client.enabled is False
    assert status["mode"] == "disabled"
    assert "outbound model traffic is blocked" in status["detail"]

    get_settings.cache_clear()
