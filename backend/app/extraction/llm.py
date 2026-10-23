"""Shared client for OpenAI-compatible LLM endpoints (OpenRouter, Ollama).

This module only handles transport: sending a request, retrying on temporary
failures and turning the raw response into a small, typed result. It knows
nothing about letters, prompts or schemas; callers decide what to do with the
text they get back.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable

import openai
from openai import OpenAI

# Errors where sending the same request again cannot help:
# 400 bad request (wrong parameter for this model), 401 bad key,
# 402 no credits, 403 forbidden, 404 unknown model.
FATAL_STATUS_CODES = {400, 401, 402, 403, 404}

DEFAULT_MAX_ATTEMPTS = 3


class LLMError(Exception):
    """The request failed after all retries (network, rate limit, server error)."""


class FatalLLMError(LLMError):
    """The request can never succeed as written: fix configuration, not code."""


class TruncatedError(LLMError):
    """The model hit max_tokens before finishing its answer."""

    def __init__(self, message: str, partial_text: str):
        super().__init__(message)
        self.partial_text = partial_text


@dataclass(frozen=True)
class LLMResponse:
    text: str
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    reasoning_tokens: int | None


def make_client(base_url: str, api_key: str) -> OpenAI:
    # max_retries=0: retries are handled below, so they are visible and testable.
    return OpenAI(base_url=base_url, api_key=api_key, max_retries=0)


def chat(
    client: OpenAI,
    *,
    model: str,
    messages: list[dict[str, str]],
    max_tokens: int,
    temperature: float | None = None,
    response_format: dict[str, Any] | None = None,
    extra_body: dict[str, Any] | None = None,
    max_attempts: int = DEFAULT_MAX_ATTEMPTS,
    sleep: Callable[[float], None] = time.sleep,
) -> LLMResponse:
    """Send one chat request, retrying only on temporary failures."""
    kwargs: dict[str, Any] = {"model": model, "messages": messages, "max_tokens": max_tokens}
    if temperature is not None:
        kwargs["temperature"] = temperature
    if response_format is not None:
        kwargs["response_format"] = response_format
    if extra_body is not None:
        kwargs["extra_body"] = extra_body

    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            response = client.chat.completions.create(**kwargs)
        except openai.APIStatusError as exc:
            if exc.status_code in FATAL_STATUS_CODES:
                raise FatalLLMError(f"{exc.status_code}: {exc.message}") from exc
            last_error = exc  # 429 rate limit or 5xx server error: retry
        except openai.APIConnectionError as exc:
            last_error = exc  # network problem or timeout: retry
        else:
            return _to_response(response, model)
        if attempt < max_attempts:
            sleep(2 ** attempt)  # 2s, 4s, ...

    raise LLMError(f"failed after {max_attempts} attempts: {last_error}") from last_error


def _to_response(response: Any, requested_model: str) -> LLMResponse:
    choice = response.choices[0]
    text = choice.message.content or ""
    usage = getattr(response, "usage", None)
    details = getattr(usage, "completion_tokens_details", None)
    reasoning = getattr(details, "reasoning_tokens", None)
    completion = getattr(usage, "completion_tokens", None)

    if choice.finish_reason == "length":
        raise TruncatedError(
            f"output truncated at {completion} tokens (reasoning: {reasoning})",
            partial_text=text,
        )
    return LLMResponse(
        text=text,
        model=getattr(response, "model", None) or requested_model,
        prompt_tokens=getattr(usage, "prompt_tokens", None),
        completion_tokens=completion,
        reasoning_tokens=reasoning,
    )
