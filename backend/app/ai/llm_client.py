from __future__ import annotations

import json
from typing import Any
from urllib.parse import urlparse

import httpx

from app.core.config import get_settings

LOCAL_LLM_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "host.docker.internal",
}


class LLMClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def base_url(self) -> str:
        return self.settings.llm_base_url.rstrip("/")

    @property
    def openai_base_url(self) -> str:
        base_url = self.base_url
        if base_url.endswith("/api/v1"):
            return f"{base_url.rsplit('/api/v1', 1)[0]}/v1"
        return base_url

    @property
    def native_api_root(self) -> str:
        base_url = self.base_url
        if base_url.endswith("/api/v1"):
            return base_url.rsplit("/api/v1", 1)[0]
        if base_url.endswith("/v1"):
            return base_url.rsplit("/v1", 1)[0]
        return base_url

    @property
    def lm_studio_api_mode(self) -> str:
        return self.settings.lm_studio_api_mode

    @property
    def has_base_url(self) -> bool:
        return bool(self.base_url)

    @property
    def is_local(self) -> bool:
        hostname = urlparse(self.base_url).hostname
        return bool(hostname and hostname in LOCAL_LLM_HOSTS)

    @property
    def remote_blocked(self) -> bool:
        return self.settings.local_ai_only and self.has_base_url and not self.is_local

    @property
    def use_native_api(self) -> bool:
        return self.is_local and self.lm_studio_api_mode in {"auto", "native"}

    @property
    def use_openai_compat(self) -> bool:
        if not self.is_local:
            return True
        return self.lm_studio_api_mode in {"auto", "openai"}

    @property
    def enabled(self) -> bool:
        if self.remote_blocked:
            return False
        return bool((self.is_local and self.has_base_url) or self.settings.llm_api_key)

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.settings.llm_api_key:
            headers["Authorization"] = f"Bearer {self.settings.llm_api_key}"
        return headers

    def _status_urls(self) -> list[str]:
        if not self.base_url:
            return []

        urls: list[str] = []

        if self.use_native_api:
            urls.append(f"{self.native_api_root}/api/v1/models")

        if self.use_openai_compat:
            urls.append(f"{self.openai_base_url}/models")

            if self.is_local and self.openai_base_url.endswith("/v1"):
                urls.append(f"{self.openai_base_url.rsplit('/v1', 1)[0]}/api/v0/models")
            elif self.is_local:
                urls.append(f"{self.openai_base_url}/api/v0/models")

        return list(dict.fromkeys(urls))

    async def _post(
        self,
        endpoint: str,
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        return await self._post_url(f"{self.openai_base_url}{endpoint}", payload)

    async def _post_url(
        self,
        url: str,
        payload: dict[str, Any],
    ) -> dict[str, Any] | None:
        if self.remote_blocked:
            raise RuntimeError(
                "Local AI only is enabled, so CRM prompts cannot be sent to a remote model."
            )

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                json=payload,
                headers=self._headers(),
            )
            response.raise_for_status()
            data = response.json()
            return data if isinstance(data, dict) else None

    async def _post_native_chat(
        self,
        *,
        model: str,
        input_text: str,
        system_prompt: str | None = None,
    ) -> dict[str, Any] | None:
        payload: dict[str, Any] = {
            "model": model,
            "input": input_text,
        }
        if system_prompt:
            payload["system_prompt"] = system_prompt
        return await self._post_url(f"{self.native_api_root}/api/v1/chat", payload)

    @staticmethod
    def _strip_code_fences(text: str) -> str:
        normalized = text.strip()
        if normalized.startswith("```") and normalized.endswith("```"):
            lines = normalized.splitlines()
            if len(lines) >= 3:
                return "\n".join(lines[1:-1]).strip()
        return normalized

    @classmethod
    def _extract_text_content(cls, payload: dict[str, Any] | None) -> str | None:
        if not payload:
            return None

        output_text = payload.get("output_text")
        if isinstance(output_text, str) and output_text.strip():
            return output_text.strip()

        choices = payload.get("choices")
        if isinstance(choices, list) and choices:
            first_choice = choices[0]
            if isinstance(first_choice, dict):
                message = first_choice.get("message")
                if isinstance(message, dict):
                    content = message.get("content")
                    if isinstance(content, str) and content.strip():
                        return content.strip()
                    if isinstance(content, list):
                        text_parts: list[str] = []
                        for item in content:
                            if isinstance(item, dict):
                                text = item.get("text")
                                if isinstance(text, str) and text.strip():
                                    text_parts.append(text.strip())
                        if text_parts:
                            return "\n".join(text_parts)

        output = payload.get("output")
        if isinstance(output, list):
            text_parts: list[str] = []
            for item in output:
                if not isinstance(item, dict):
                    continue
                content = item.get("content")
                if isinstance(content, str) and content.strip():
                    text_parts.append(content.strip())
                    continue
                if not isinstance(content, list):
                    continue
                for content_item in content:
                    if isinstance(content_item, dict):
                        text = content_item.get("text")
                        if isinstance(text, str) and text.strip():
                            text_parts.append(text.strip())
            if text_parts:
                return "\n".join(text_parts)

        return None

    @classmethod
    def _extract_json_object(cls, payload: dict[str, Any] | None) -> dict[str, Any] | None:
        if not payload:
            return None

        output = payload.get("output")
        if isinstance(output, dict):
            return output

        content = cls._extract_text_content(payload)
        if not content:
            return None

        normalized = cls._strip_code_fences(content)
        try:
            parsed = json.loads(normalized)
        except json.JSONDecodeError:
            return None

        return parsed if isinstance(parsed, dict) else None

    @staticmethod
    def _extract_model_ids(payload: dict[str, Any] | None) -> tuple[list[str], list[str]]:
        if not payload:
            return [], []

        data = payload.get("data")
        models = payload.get("models")

        items: list[dict[str, Any]] = []
        if isinstance(data, list):
            items.extend([item for item in data if isinstance(item, dict)])
        if isinstance(models, list):
            items.extend([item for item in models if isinstance(item, dict)])
        if not items:
            return [], []

        available_models: list[str] = []
        loaded_models: list[str] = []

        for item in items:
            model_id = item.get("id")
            model_key = item.get("key")

            if isinstance(model_id, str) and model_id.strip():
                normalized = model_id.strip()
                available_models.append(normalized)
                if item.get("state") == "loaded":
                    loaded_models.append(normalized)

            if isinstance(model_key, str) and model_key.strip():
                available_models.append(model_key.strip())

            loaded_instances = item.get("loaded_instances")
            if isinstance(loaded_instances, list):
                if isinstance(model_key, str) and model_key.strip():
                    loaded_models.append(model_key.strip())
                for instance in loaded_instances:
                    if not isinstance(instance, dict):
                        continue
                    instance_id = instance.get("id")
                    if isinstance(instance_id, str) and instance_id.strip():
                        loaded_models.append(instance_id.strip())

        available_models = list(dict.fromkeys(available_models))
        loaded_models = list(dict.fromkeys(loaded_models))

        if available_models and not loaded_models:
            loaded_models = available_models.copy()

        return available_models, loaded_models

    async def get_status(self, requested_model: str | None = None) -> dict[str, Any]:
        configured_model = requested_model or self.settings.llm_model or None
        base_url = self.base_url
        unauthorized_detail: str | None = None

        if self.remote_blocked:
            return {
                "mode": "disabled",
                "reachable": False,
                "is_local": self.is_local,
                "base_url": base_url,
                "configured_model": configured_model,
                "available_models": [],
                "loaded_models": [],
                "detail": (
                    "Local AI only is enabled, so outbound model traffic is blocked until "
                    "the configured runtime points to localhost."
                ),
            }

        if not self.enabled:
            return {
                "mode": "disabled",
                "reachable": False,
                "is_local": self.is_local,
                "base_url": base_url,
                "configured_model": configured_model,
                "available_models": [],
                "loaded_models": [],
                "detail": "No LLM server is configured yet.",
            }

        async with httpx.AsyncClient(timeout=2.5) as client:
            for url in self._status_urls():
                try:
                    response = await client.get(url, headers=self._headers())
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict):
                        continue

                    available_models, loaded_models = self._extract_model_ids(payload)
                    usable_models = loaded_models or available_models
                    if not usable_models:
                        return {
                            "mode": "fallback",
                            "reachable": True,
                            "is_local": self.is_local,
                            "base_url": base_url,
                            "configured_model": configured_model,
                            "available_models": available_models,
                            "loaded_models": loaded_models,
                            "detail": (
                                "The LLM server is reachable, but it did not report any usable "
                                "models."
                            ),
                        }

                    if configured_model and configured_model not in usable_models:
                        configured_model_is_available = configured_model in available_models
                        detail = (
                            f"The LLM server is reachable, but '{configured_model}' is not loaded."
                            if configured_model_is_available
                            else (
                                f"The LLM server is reachable, but '{configured_model}' is not "
                                "available."
                            )
                        )
                        return {
                            "mode": "fallback",
                            "reachable": True,
                            "is_local": self.is_local,
                            "base_url": base_url,
                            "configured_model": configured_model,
                            "available_models": available_models,
                            "loaded_models": loaded_models,
                            "detail": detail,
                        }

                    active_model = configured_model or usable_models[0]
                    return {
                        "mode": "llm",
                        "reachable": True,
                        "is_local": self.is_local,
                        "base_url": base_url,
                        "configured_model": configured_model,
                        "available_models": available_models,
                        "loaded_models": loaded_models,
                        "detail": f"Copilot is ready with '{active_model}'.",
                    }
                except httpx.HTTPStatusError as exc:
                    if exc.response.status_code in {401, 403}:
                        detail = "The LLM server requires a valid API token."
                        try:
                            payload = exc.response.json()
                            if isinstance(payload, dict):
                                error = payload.get("error")
                                if isinstance(error, dict):
                                    message = error.get("message")
                                    if isinstance(message, str) and message.strip():
                                        detail = message.strip()
                        except ValueError:
                            pass
                        unauthorized_detail = unauthorized_detail or detail
                    continue
                except (httpx.HTTPError, ValueError):
                    continue

        if unauthorized_detail is not None:
            return {
                "mode": "disabled",
                "reachable": True,
                "is_local": self.is_local,
                "base_url": base_url,
                "configured_model": configured_model,
                "available_models": [],
                "loaded_models": [],
                "detail": unauthorized_detail,
            }

        detail = (
            f"Unable to reach the local LLM server at {base_url}."
            if self.is_local
            else f"Unable to reach the configured LLM server at {base_url}."
        )
        return {
            "mode": "fallback",
            "reachable": False,
            "is_local": self.is_local,
            "base_url": base_url,
            "configured_model": configured_model,
            "available_models": [],
            "loaded_models": [],
            "detail": detail,
        }

    async def complete_text(self, prompt: str, model: str | None = None) -> str | None:
        if not self.enabled:
            return None

        selected_model = model or self.settings.llm_model

        if self.use_native_api:
            try:
                native_payload = await self._post_native_chat(
                    model=selected_model,
                    input_text=prompt,
                    system_prompt="Respond as a concise CRM copilot.",
                )
                native_text = self._extract_text_content(native_payload)
                if native_text:
                    return native_text
            except httpx.HTTPError:
                pass

        if not self.use_openai_compat:
            return None

        chat_payload: dict[str, Any] = {
            "model": selected_model,
            "messages": [
                {
                    "role": "system",
                    "content": "Respond as a concise CRM copilot.",
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
        }

        payload: dict[str, Any] | None = None
        try:
            payload = await self._post("/chat/completions", chat_payload)
        except httpx.HTTPError:
            try:
                payload = await self._post(
                    "/responses",
                    {
                        "model": selected_model,
                        "input": prompt,
                    },
                )
            except httpx.HTTPError:
                return None

        return self._extract_text_content(payload)

    async def complete_json(self, prompt: str, model: str | None = None) -> dict[str, Any] | None:
        if not self.enabled:
            return None

        selected_model = model or self.settings.llm_model

        if self.use_native_api:
            try:
                native_payload = await self._post_native_chat(
                    model=selected_model,
                    input_text=prompt,
                    system_prompt="Return valid JSON only. Do not use markdown fences.",
                )
                native_json = self._extract_json_object(native_payload)
                if native_json is not None:
                    return native_json
            except httpx.HTTPError:
                pass

        if not self.use_openai_compat:
            return None

        base_messages = [
            {
                "role": "system",
                "content": "Return valid JSON only. Do not use markdown fences.",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ]
        chat_payload: dict[str, Any] = {
            "model": selected_model,
            "messages": base_messages,
            "response_format": {"type": "json_object"},
        }

        payload: dict[str, Any] | None = None
        try:
            payload = await self._post("/chat/completions", chat_payload)
        except httpx.HTTPError:
            try:
                payload = await self._post(
                    "/chat/completions",
                    {
                        "model": selected_model,
                        "messages": base_messages,
                    },
                )
            except httpx.HTTPError:
                try:
                    payload = await self._post(
                        "/responses",
                        {
                            "model": selected_model,
                            "input": prompt,
                            "response_format": {"type": "json_object"},
                        },
                    )
                except httpx.HTTPError:
                    return None

        return self._extract_json_object(payload)
