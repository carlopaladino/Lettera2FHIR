"""Quick manual test: run one extraction on one letter and print the result.

Usage (from the backend folder):
    python scripts/try_extract.py 16
    python scripts/try_extract.py 16 --no-structured
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # make "app" importable

from dotenv import load_dotenv

from app.extraction.extract import ExtractionError, extract, load_schema
from app.extraction.llm import FatalLLMError, LLMError
from app.extraction.prompts import load_prompt

REPO_ROOT = Path(__file__).resolve().parents[2]

parser = argparse.ArgumentParser()
parser.add_argument("letter", help="letter number, e.g. 16")
parser.add_argument("--no-structured", action="store_true", help="do not send response_format")
parser.add_argument("--reasoning", choices=["low", "medium", "high"], default=None,
                    help="ask the model to limit its hidden reasoning")
parser.add_argument("--timeout", type=float, default=180, help="seconds to wait for each attempt")
args = parser.parse_args()

number = args.letter.zfill(2)
if int(number) <= 15:
    sys.exit("Letters 01-15 are the evaluation set: use 16-30 for development.")

load_dotenv(REPO_ROOT / ".env")
from openai import OpenAI

# Same as make_client, plus a time limit so the script never waits forever.
client = OpenAI(base_url=os.environ["LLM_BASE_URL"], api_key=os.environ["LLM_API_KEY"],
                max_retries=0, timeout=args.timeout)
extra_body = {"provider": {"require_parameters": True}}
if args.reasoning:
    extra_body["reasoning"] = {"effort": args.reasoning}
letter = (REPO_ROOT / "data" / "synthetic" / f"letter_{number}.txt").read_text(encoding="utf-8")

print(f"letter {number}: {len(letter.split())} words | model: {os.environ['LLM_MODEL']}")
print(f"sending request (timeout {args.timeout:.0f}s per attempt, structured: {not args.no_structured}, "
      f"reasoning: {args.reasoning or 'default'})... the model may take a few minutes", flush=True)
start = time.monotonic()
try:
    result = extract(
        letter,
        client=client,
        model=os.environ["LLM_MODEL"],
        prompt=load_prompt(os.environ.get("PROMPT_VERSION", "extract-v1")),
        schema=load_schema(),
        structured_output=not args.no_structured,
        extra_body=extra_body,
    )
except FatalLLMError as exc:
    sys.exit(f"API ERROR after {time.monotonic() - start:.0f}s: {exc}")
except LLMError as exc:
    sys.exit(f"NO ANSWER after {time.monotonic() - start:.0f}s: {exc}")
except ExtractionError as exc:
    print("EXTRACTION ERROR:", exc)
    print(exc.raw_text[:2000])
    sys.exit(1)

print(f"answer received in {time.monotonic() - start:.0f}s")
print(f"model: {result.model} | prompt: {result.prompt_version} | attempts: {result.attempts}")
print(f"tokens: {result.prompt_tokens} in, {result.completion_tokens} out, "
      f"reasoning: {result.reasoning_tokens}")
print({key: len(items) for key, items in result.data.items()})
print(json.dumps(result.data, ensure_ascii=False, indent=2))
