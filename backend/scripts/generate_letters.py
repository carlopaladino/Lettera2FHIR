"""Generate synthetic Italian discharge letters and draft gold annotations.

Reads the prompt template and the 30-letter plan from
prompts/generate_synthetic_letter.md, calls an OpenAI-compatible LLM,
and writes for each letter:
    data/synthetic/letter_XX.txt        the letter
    data/synthetic/letter_XX.meta.json  model, prompt version, tokens, warnings
    data/gold/letter_XX.draft.json      draft annotation (to be corrected by hand)

Usage (from the repo root):
    python backend/scripts/generate_letters.py --letters 01
    python backend/scripts/generate_letters.py --letters 02 03 04
    python backend/scripts/generate_letters.py --all
    python backend/scripts/generate_letters.py --letters 05 --overwrite
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import openai
from jsonschema import Draft202012Validator
from openai import OpenAI
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]
PROMPT_PATH = REPO_ROOT / "prompts" / "generate_synthetic_letter.md"
SCHEMA_PATH = REPO_ROOT / "schemas" / "extraction.schema.json"
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic"
GOLD_DIR = REPO_ROOT / "data" / "gold"

MAX_ATTEMPTS = 3

# Target word counts from the prompt; used only to print a warning.
WORD_RANGES = {"bassa": (300, 400), "media": (450, 600), "alta": (650, 850)}
WORD_TOLERANCE = 0.15


class GenSettings(BaseSettings):
    """Settings for generation only.

    GEN_LLM_MODEL is deliberately separate from LLM_MODEL: the generator
    must never be one of the models under evaluation.
    """

    model_config = SettingsConfigDict(env_file=REPO_ROOT / ".env", extra="ignore")

    llm_base_url: str
    llm_api_key: str
    gen_llm_model: str
    # None = provider default. Models with mandatory reasoning (e.g. Claude 5.5)
    # may reject any temperature other than the default.
    gen_temperature: float | None = None
    gen_max_tokens: int = 20000
    # Reasoning cannot be disabled on some models: keep it short instead.
    gen_reasoning_effort: str = "low"


@dataclass(frozen=True)
class LetterSpec:
    number: str
    specialty: str
    complexity: str
    features: str


class GenerationError(Exception):
    """Raised when one attempt produces unusable output; triggers a retry.

    The optional second argument carries the raw model output for debugging.
    """

    def __init__(self, message: str, raw: str = ""):
        super().__init__(message)
        self.raw = raw


class FatalAPIError(Exception):
    """Auth or billing error: retrying cannot help, so the whole run stops."""


# 400 = request rejected as malformed (wrong parameter for this model):
# sending it again unchanged cannot succeed.
FATAL_STATUS_CODES = {400, 401, 402, 403}


# ---------------------------------------------------------------- loading

PLAN_ROW = re.compile(
    r"^\|\s*(\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$",
    re.MULTILINE,
)


def load_prompt_file(path: Path) -> tuple[str, str, dict[str, LetterSpec]]:
    """Return (prompt_version, template, plan) parsed from the markdown file."""
    md = path.read_text(encoding="utf-8")

    version = re.search(r"Versione:\s*`([^`]+)`", md)
    if not version:
        raise ValueError("Prompt version ('Versione: `...`') not found")

    template = re.search(r"## Prompt\s*```\n(.*?)\n```", md, re.DOTALL)
    if not template:
        raise ValueError("Prompt block under '## Prompt' not found")

    plan = {
        num: LetterSpec(num, spec, cx, feat)
        for num, spec, cx, feat in PLAN_ROW.findall(md)
    }
    if not plan:
        raise ValueError("Generation plan table not found")

    return version.group(1), template.group(1), plan


def build_prompt(template: str, spec: LetterSpec, schema_text: str) -> str:
    # str.replace, not str.format: the schema is full of curly braces.
    prompt = (
        template.replace("{{SPECIALITA}}", spec.specialty)
        .replace("{{COMPLESSITA}}", spec.complexity)
        .replace("{{CARATTERISTICHE}}", spec.features)
        .replace("{{SCHEMA}}", schema_text)
    )
    leftover = re.findall(r"\{\{[A-Z_]+\}\}", prompt)
    if leftover:
        raise ValueError(f"Unfilled placeholders: {leftover}")
    return prompt


# ------------------------------------------------------------- generation

def call_llm(client: OpenAI, settings: GenSettings, prompt: str):
    kwargs = {
        "model": settings.gen_llm_model,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": settings.gen_max_tokens,
        # OpenRouter's unified reasoning parameter. Hidden reasoning tokens
        # count against max_tokens, so keep the effort low.
        "extra_body": {"reasoning": {"effort": settings.gen_reasoning_effort}},
    }
    if settings.gen_temperature is not None:
        kwargs["temperature"] = settings.gen_temperature
    response = client.chat.completions.create(**kwargs)
    choice = response.choices[0]
    content = choice.message.content or ""
    if choice.finish_reason == "length":
        usage = response.usage
        details = getattr(usage, "completion_tokens_details", None)
        reasoning = getattr(details, "reasoning_tokens", None)
        raise GenerationError(
            f"output truncated: {getattr(usage, 'completion_tokens', '?')} completion "
            f"tokens ({reasoning} reasoning), {len(content)} visible chars",
            content,
        )
    return content, response.usage


def parse_output(raw: str) -> tuple[str, dict]:
    """Split the model answer into letter text and annotation dict."""
    letter_m = re.search(r"<lettera>\s*(.*?)\s*</lettera>", raw, re.DOTALL)
    ann_m = re.search(r"<annotazione>\s*(.*?)\s*</annotazione>", raw, re.DOTALL)
    if not letter_m or not ann_m:
        raise GenerationError("missing <lettera> or <annotazione> block", raw)

    letter = letter_m.group(1).strip()
    # Some models wrap JSON in ```json fences even when told not to.
    ann_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", ann_m.group(1).strip())
    try:
        annotation = json.loads(ann_text)
    except json.JSONDecodeError as exc:
        raise GenerationError(f"annotation is not valid JSON: {exc}", raw) from exc
    return letter, annotation


def check_schema(validator: Draft202012Validator, annotation: dict) -> None:
    errors = sorted(validator.iter_errors(annotation), key=lambda e: list(e.path))
    if errors:
        details = "; ".join(
            f"{'/'.join(map(str, e.path)) or '<root>'}: {e.message}" for e in errors[:5]
        )
        raise GenerationError(f"{len(errors)} schema error(s): {details}")


def find_missing_evidence(letter: str, annotation: dict) -> list[str]:
    """Quick exact-substring check, only to help manual correction of drafts."""
    missing = []
    for section in ("conditions", "medications", "observations"):
        for i, item in enumerate(annotation[section]):
            if item["evidence"] not in letter:
                missing.append(f"{section}[{i}]: {item['evidence']!r}")
    return missing


def word_count_warning(letter: str, complexity: str) -> str | None:
    if complexity not in WORD_RANGES:
        return None
    low, high = WORD_RANGES[complexity]
    n = len(letter.split())
    if n < low * (1 - WORD_TOLERANCE) or n > high * (1 + WORD_TOLERANCE):
        return f"{n} words, expected {low}-{high} for '{complexity}'"
    return None


# ----------------------------------------------------------------- saving

def output_paths(number: str) -> dict[str, Path]:
    return {
        "letter": SYNTHETIC_DIR / f"letter_{number}.txt",
        "meta": SYNTHETIC_DIR / f"letter_{number}.meta.json",
        "draft": GOLD_DIR / f"letter_{number}.draft.json",
        "gold": GOLD_DIR / f"letter_{number}.json",
        "failed": SYNTHETIC_DIR / f"letter_{number}.failed.txt",
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def generate_one(
    spec: LetterSpec,
    client: OpenAI,
    settings: GenSettings,
    template: str,
    schema_text: str,
    validator: Draft202012Validator,
    prompt_version: str,
) -> bool:
    paths = output_paths(spec.number)
    prompt = build_prompt(template, spec, schema_text)

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw, usage = call_llm(client, settings, prompt)
            letter, annotation = parse_output(raw)
            check_schema(validator, annotation)
        except openai.APIStatusError as exc:
            if exc.status_code in FATAL_STATUS_CODES:
                raise FatalAPIError(f"{exc.status_code}: {exc.message}") from exc
            print(f"  attempt {attempt}/{MAX_ATTEMPTS} failed: {exc}")
            time.sleep(2 * attempt)
            continue
        except (GenerationError, openai.APIError) as exc:
            print(f"  attempt {attempt}/{MAX_ATTEMPTS} failed: {exc}")
            raw_failed = getattr(exc, "raw", "")
            if raw_failed:
                paths["failed"].write_text(raw_failed, encoding="utf-8")
                print(f"  raw output saved to {paths['failed'].relative_to(REPO_ROOT)}")
            time.sleep(2 * attempt)
            continue

        missing = find_missing_evidence(letter, annotation)
        length_warning = word_count_warning(letter, spec.complexity)

        meta = {
            "letter": spec.number,
            "specialty": spec.specialty,
            "complexity": spec.complexity,
            "features": [f.strip() for f in spec.features.split(",")],
            "prompt_version": prompt_version,
            "model": settings.gen_llm_model,
            "temperature": settings.gen_temperature,
            "reasoning_effort": settings.gen_reasoning_effort,
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "attempts": attempt,
            "usage": {
                "prompt_tokens": getattr(usage, "prompt_tokens", None),
                "completion_tokens": getattr(usage, "completion_tokens", None),
            },
            "word_count": len(letter.split()),
            "warnings": {
                "length": length_warning,
                "evidence_not_found": missing,
            },
        }

        paths["letter"].write_text(letter + "\n", encoding="utf-8")
        paths["failed"].unlink(missing_ok=True)
        write_json(paths["draft"], annotation)
        write_json(paths["meta"], meta)

        counts = {k: len(v) for k, v in annotation.items()}
        print(f"  ok: {meta['word_count']} words, {counts}")
        if length_warning:
            print(f"  warning: {length_warning}")
        for m in missing:
            print(f"  warning: evidence not in letter -> {m}")
        return True

    return False


# ------------------------------------------------------------------- main

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    target = parser.add_mutually_exclusive_group(required=True)
    target.add_argument("--letters", nargs="+", help="letter numbers, e.g. 01 02")
    target.add_argument("--all", action="store_true", help="all letters in the plan")
    parser.add_argument("--overwrite", action="store_true",
                        help="regenerate letters that already exist")
    args = parser.parse_args()

    settings = GenSettings()
    prompt_version, template, plan = load_prompt_file(PROMPT_PATH)
    schema_text = SCHEMA_PATH.read_text(encoding="utf-8")
    validator = Draft202012Validator(json.loads(schema_text))
    client = OpenAI(base_url=settings.llm_base_url, api_key=settings.llm_api_key)

    numbers = sorted(plan) if args.all else [n.zfill(2) for n in args.letters]
    unknown = [n for n in numbers if n not in plan]
    if unknown:
        print(f"Not in plan: {unknown}")
        return 2

    SYNTHETIC_DIR.mkdir(parents=True, exist_ok=True)
    GOLD_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Model: {settings.gen_llm_model} | prompt: {prompt_version}")
    failed = []
    for number in numbers:
        spec = plan[number]
        paths = output_paths(number)
        print(f"[{number}] {spec.specialty}, {spec.complexity}: {spec.features}")

        if paths["gold"].exists():
            print("  skip: corrected gold annotation exists, never overwritten")
            continue
        if paths["letter"].exists() and not args.overwrite:
            print("  skip: already generated (use --overwrite)")
            continue

        try:
            ok = generate_one(spec, client, settings, template, schema_text,
                              validator, prompt_version)
        except FatalAPIError as exc:
            print(f"  fatal, stopping run: {exc}")
            return 1
        if not ok:
            failed.append(number)

    if failed:
        print(f"\nFailed: {failed}")
        return 1
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())