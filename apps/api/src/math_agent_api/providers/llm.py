import json
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Protocol

import httpx

from math_agent_api.core.config import Settings, get_settings


ChatMessage = dict[str, str]


class LLMProviderError(Exception):
    pass


class LLMProvider(Protocol):
    name: str

    async def stream_chat(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        pass


@dataclass(frozen=True)
class MockLLMProvider:
    name: str = "mock"

    async def stream_chat(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        user_message = next(
            (message["content"] for message in reversed(messages) if message.get("role") == "user"),
            "",
        )
        chunks = _build_mock_answer(user_message)
        for chunk in chunks:
            yield chunk


def _build_mock_answer(user_message: str) -> list[str]:
    normalized = user_message.lower().replace(" ", "")
    if "sin(x*y)" in normalized or "z=sin" in normalized:
        return [
            "可以把这个问题看成观察曲面 ",
            "$$z=\\sin(xy)$$",
            " 在平面区域上的起伏。沿着 $xy$ 相同的方向，函数值会保持相近；当 $xy$ 穿过不同的正负区间时，曲面会在波峰和波谷之间切换。你可以先旋转图形，观察四个象限中颜色和高度的对称变化。",
        ]

    if "lim" in normalized and "sin" in normalized:
        return [
            "结论是 ",
            "$$\\lim_{x\\to 0}\\frac{\\sin x}{x}=1.$$",
            " 关键理由可以用夹逼定理理解：在 $x$ 接近 $0$ 时，$\\sin x$ 与 $x$ 的一阶变化量相同，所以二者的比值趋向于 $1$。",
        ]

    return [
        "我先把题目整理成一个可操作的学习步骤：",
        f"题目是“{user_message[:80]}”。",
        " 先判断它属于概念、计算、证明还是可视化问题，再选择直接解答、分步引导或只给提示。你可以继续要求我展开关键步骤。",
    ]


@dataclass(frozen=True)
class OpenAICompatibleLLMProvider:
    base_url: str
    api_key: str
    model: str
    timeout_seconds: float
    name: str = "openai_compatible"

    async def stream_chat(self, messages: Sequence[ChatMessage]) -> AsyncIterator[str]:
        endpoint = f"{self.base_url.rstrip('/')}/chat/completions"
        payload = {
            "model": self.model,
            "messages": list(messages),
            "stream": True,
            "temperature": 0.3,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        timeout = httpx.Timeout(self.timeout_seconds, connect=15.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream("POST", endpoint, json=payload, headers=headers) as response:
                    if response.status_code >= 400:
                        error_body = await response.aread()
                        raise LLMProviderError(
                            f"LLM provider returned {response.status_code}: {error_body[:300]!r}"
                        )

                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        data = line.removeprefix("data:").strip()
                        if data == "[DONE]":
                            break
                        if not data:
                            continue
                        try:
                            event = json.loads(data)
                        except json.JSONDecodeError as exc:
                            raise LLMProviderError("LLM provider returned invalid stream JSON") from exc

                        delta = event.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
            except httpx.HTTPError as exc:
                raise LLMProviderError("LLM provider request failed") from exc


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    resolved = settings or get_settings()
    provider_name = resolved.llm_provider.strip().lower()

    if provider_name in {"mock", "none"}:
        return MockLLMProvider()

    if provider_name == "openai_compatible" and resolved.has_llm_credentials:
        return OpenAICompatibleLLMProvider(
            base_url=resolved.llm_base_url,
            api_key=resolved.llm_api_key,
            model=resolved.llm_model,
            timeout_seconds=resolved.llm_timeout_seconds,
        )

    if resolved.llm_mock_fallback:
        return MockLLMProvider()

    raise LLMProviderError(
        "LLM provider is not configured. Set LLM_BASE_URL, LLM_MODEL, and LLM_API_KEY."
    )
