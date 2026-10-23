from types import SimpleNamespace as NS
from unittest.mock import MagicMock

import httpx
import openai
import pytest

from app.extraction import llm


def fake_response(text="ok", finish_reason="stop", completion_tokens=10, reasoning=None):
    return NS(
        model="test-model",
        choices=[NS(finish_reason=finish_reason, message=NS(content=text))],
        usage=NS(
            prompt_tokens=5,
            completion_tokens=completion_tokens,
            completion_tokens_details=NS(reasoning_tokens=reasoning),
        ),
    )


def status_error(code):
    request = httpx.Request("POST", "https://example.test")
    return openai.APIStatusError(
        f"error {code}", response=httpx.Response(code, request=request), body=None
    )


def connection_error():
    return openai.APIConnectionError(request=httpx.Request("POST", "https://example.test"))


def make_client(*effects):
    client = MagicMock()
    client.chat.completions.create.side_effect = list(effects)
    return client


def call(client, **kwargs):
    return llm.chat(
        client,
        model="m",
        messages=[{"role": "user", "content": "hi"}],
        max_tokens=100,
        sleep=lambda s: None,  # no real waiting in tests
        **kwargs,
    )


def test_returns_text_and_usage():
    result = call(make_client(fake_response("ciao", reasoning=3)))
    assert result.text == "ciao"
    assert result.model == "test-model"
    assert (result.prompt_tokens, result.completion_tokens, result.reasoning_tokens) == (5, 10, 3)


def test_optional_parameters_are_sent_only_when_set():
    client = make_client(fake_response())
    call(client)
    sent = client.chat.completions.create.call_args.kwargs
    assert "temperature" not in sent and "response_format" not in sent

    client = make_client(fake_response())
    call(client, temperature=0.0, response_format={"type": "json_object"})
    sent = client.chat.completions.create.call_args.kwargs
    assert sent["temperature"] == 0.0
    assert sent["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize("code", [400, 401, 402, 403, 404])
def test_fatal_errors_stop_immediately(code):
    client = make_client(status_error(code))
    with pytest.raises(llm.FatalLLMError):
        call(client)
    assert client.chat.completions.create.call_count == 1


@pytest.mark.parametrize("error", [status_error(429), status_error(503), connection_error()])
def test_temporary_errors_are_retried(error):
    client = make_client(error, fake_response("ok"))
    assert call(client).text == "ok"
    assert client.chat.completions.create.call_count == 2


def test_gives_up_after_max_attempts():
    client = make_client(status_error(503), status_error(503), status_error(503))
    with pytest.raises(llm.LLMError):
        call(client)
    assert client.chat.completions.create.call_count == 3


def test_truncation_raises_with_partial_text():
    client = make_client(fake_response("{\"conditions\": [", finish_reason="length"))
    with pytest.raises(llm.TruncatedError) as info:
        call(client)
    assert info.value.partial_text.startswith("{")
    assert client.chat.completions.create.call_count == 1
