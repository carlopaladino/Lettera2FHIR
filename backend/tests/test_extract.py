import json
from types import SimpleNamespace as NS
from unittest.mock import MagicMock

import pytest

from app.extraction.extract import (
    ExtractionError,
    extract,
    load_schema,
    parse_json,
)
from app.extraction.prompts import ExtractionPrompt

PROMPT = ExtractionPrompt(
    version="extract-v1",
    system="Regole.",
    user_template="Schema:\n{{SCHEMA}}\nLettera:\n{{LETTER}}",
)

VALID = {
    "conditions": [
        {
            "text": "scompenso cardiaco",
            "role": "principale",
            "clinical_status": "active",
            "verification_status": "confirmed",
            "evidence": "scompenso cardiaco",
        }
    ],
    "medications": [],
    "observations": [],
}


def answer(text):
    return NS(
        model="test-model",
        choices=[NS(finish_reason="stop", message=NS(content=text))],
        usage=NS(prompt_tokens=100, completion_tokens=50,
                 completion_tokens_details=NS(reasoning_tokens=None)),
    )


def client_with(*texts):
    client = MagicMock()
    client.chat.completions.create.side_effect = [answer(t) for t in texts]
    return client


@pytest.fixture(scope="module")
def schema():
    return load_schema()  # the real schema from schemas/


def run(client, schema, **kwargs):
    return extract("Lettera: scompenso cardiaco.", client=client, model="m",
                   prompt=PROMPT, schema=schema, **kwargs)


def test_valid_answer(schema):
    result = run(client_with(json.dumps(VALID)), schema)
    assert result.data == VALID
    assert result.attempts == 1
    assert result.prompt_version == "extract-v1"
    assert result.model == "test-model"
    assert result.warnings == []


def test_letter_and_schema_are_sent(schema):
    client = client_with(json.dumps(VALID))
    run(client, schema)
    sent = client.chat.completions.create.call_args.kwargs
    user = sent["messages"][1]["content"]
    assert "Lettera: scompenso cardiaco." in user
    assert '"conditions"' in user
    assert sent["response_format"]["type"] == "json_schema"
    assert sent["temperature"] == 0.0


def test_structured_output_can_be_disabled(schema):
    client = client_with(json.dumps(VALID))
    run(client, schema, structured_output=False)
    assert "response_format" not in client.chat.completions.create.call_args.kwargs


def test_fenced_json_is_accepted(schema):
    result = run(client_with("```json\n" + json.dumps(VALID) + "\n```"), schema)
    assert result.data == VALID


def test_invalid_json_is_retried(schema):
    client = client_with("non è JSON", json.dumps(VALID))
    result = run(client, schema)
    assert result.attempts == 2
    assert result.warnings == ["valid answer only at attempt 2"]


def test_schema_violation_is_retried_then_fails(schema):
    bad = json.loads(json.dumps(VALID))
    bad["conditions"][0]["role"] = "importante"  # not in the enum
    client = client_with(*[json.dumps(bad)] * 3)
    with pytest.raises(ExtractionError) as info:
        run(client, schema)
    assert client.chat.completions.create.call_count == 3
    assert any("role" in e for e in info.value.errors)
    assert "importante" in info.value.raw_text


def test_missing_list_is_a_schema_error(schema):
    client = client_with(*[json.dumps({"conditions": []})] * 3)
    with pytest.raises(ExtractionError, match="required"):
        run(client, schema)


@pytest.mark.parametrize("text", ["[]", "42", "nulla"])
def test_parse_json_rejects_non_objects(text):
    with pytest.raises(ValueError):
        parse_json(text)
