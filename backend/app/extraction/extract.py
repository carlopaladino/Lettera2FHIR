"""Extract structured data from one discharge letter with an LLM.

Flow: build the messages from the versioned prompt, call the model (asking for
JSON that follows the schema when the provider supports it), parse the answer
and validate it against schemas/extraction.schema.json. If the answer is not
valid JSON or breaks the schema, the request is sent again, up to a limit.

This module does not check the evidence quotes against the letter: that is the
job of the evidence check, which runs on the validated result.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from openai import OpenAI

from app.extraction.llm import chat
from app.extraction.prompts import ExtractionPrompt

REPO_ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = REPO_ROOT / "schemas" / "extraction.schema.json"

DEFAULT_MAX_TOKENS = 16000
DEFAULT_ATTEMPTS = 3


class ExtractionError(Exception):
    """The model never produced valid JSON that follows the schema."""

    def __init__(self, message: str, raw_text: str, errors: list[str]):
        super().__init__(message)
        self.raw_text = raw_text  # last answer, for debugging
        self.errors = errors


@dataclass(frozen=True)
class ExtractionResult:
    data: dict[str, Any]
    model: str
    prompt_version: str
    attempts: int
    prompt_tokens: int | None
    completion_tokens: int | None
    reasoning_tokens: int | None
    warnings: list[str] = field(default_factory=list)


def load_schema(path: Path = SCHEMA_PATH) -> dict[str, Any]:
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)  # fails early if the schema itself is broken
    return schema


def response_format_for(schema: dict[str, Any]) -> dict[str, Any]:
    """OpenAI-style structured output: the provider forces the answer into the schema."""
    return {
        "type": "json_schema",
        "json_schema": {"name": "lettera2fhir_extraction", "strict": True, "schema": schema},
    }


def parse_json(text: str) -> dict[str, Any]:
    """Parse the model answer, tolerating a ```json fence around it."""
    cleaned = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("top-level JSON value is not an object")
    return data


def schema_errors(validator: Draft202012Validator, data: dict[str, Any]) -> list[str]:
    errors = sorted(validator.iter_errors(data), key=lambda e: list(e.path))
    return [f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}" for e in errors]


def extract(
    letter: str,
    *,
    client: OpenAI,
    model: str,
    prompt: ExtractionPrompt,
    schema: dict[str, Any],
    structured_output: bool = True,
    temperature: float | None = 0.0,
    max_tokens: int = DEFAULT_MAX_TOKENS,
    extra_body: dict[str, Any] | None = None,
    attempts: int = DEFAULT_ATTEMPTS,
) -> ExtractionResult:
    """Run one extraction. Network errors are handled inside chat(); here we
    retry only when the answer itself is unusable."""
    validator = Draft202012Validator(schema)
    messages = prompt.messages(letter, schema=json.dumps(schema, ensure_ascii=False, indent=2))
    response_format = response_format_for(schema) if structured_output else None

    last_text, last_errors = "", []
    for attempt in range(1, attempts + 1):
        response = chat(
            client,
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            response_format=response_format,
            extra_body=extra_body,
        )
        last_text = response.text
        try:
            data = parse_json(response.text)
        except ValueError as exc:  # json.JSONDecodeError is a ValueError
            last_errors = [f"invalid JSON: {exc}"]
            continue

        last_errors = schema_errors(validator, data)
        if last_errors:
            continue

        warnings = [] if attempt == 1 else [f"valid answer only at attempt {attempt}"]
        return ExtractionResult(
            data=data,
            model=response.model,
            prompt_version=prompt.version,
            attempts=attempt,
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            reasoning_tokens=response.reasoning_tokens,
            warnings=warnings,
        )

    raise ExtractionError(
        f"no valid extraction after {attempts} attempts: {'; '.join(last_errors[:3])}",
        raw_text=last_text,
        errors=last_errors,
    )
