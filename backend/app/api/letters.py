"""Read-only endpoints that serve synthetic letters to the review interface.

Only development letters (16-30) are exposed. Letters 01-15 are the held-out
evaluation set and must never appear in the interface.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parents[3]
SYNTHETIC_DIR = REPO_ROOT / "data" / "synthetic"

DEV_LETTERS = range(16, 31)
LETTER_ID = re.compile(r"^letter_(\d{2})$")

router = APIRouter(prefix="/letters", tags=["letters"])


class LetterSummary(BaseModel):
    id: str
    title: str


class Letter(BaseModel):
    id: str
    text: str


def _is_dev_letter(letter_id: str) -> bool:
    match = LETTER_ID.match(letter_id)
    return bool(match) and int(match.group(1)) in DEV_LETTERS


def _title(letter_id: str) -> str:
    """Build a readable title from the .meta.json written by the generator."""
    number = letter_id.removeprefix("letter_")
    meta_path = SYNTHETIC_DIR / f"{letter_id}.meta.json"
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        return f"Lettera {number} - {meta['specialty']}, complessità {meta['complexity']}"
    except (OSError, ValueError, KeyError):
        return f"Lettera {number}"


@router.get("", response_model=list[LetterSummary])
def list_letters() -> list[LetterSummary]:
    letters = []
    for path in sorted(SYNTHETIC_DIR.glob("letter_*.txt")):
        letter_id = path.stem
        if _is_dev_letter(letter_id):
            letters.append(LetterSummary(id=letter_id, title=_title(letter_id)))
    return letters


@router.get("/{letter_id}", response_model=Letter)
def get_letter(letter_id: str) -> Letter:
    # The regex check also blocks path tricks like "../../.env".
    if not _is_dev_letter(letter_id):
        raise HTTPException(status_code=404, detail="Letter not found")
    path = SYNTHETIC_DIR / f"{letter_id}.txt"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Letter not found")
    return Letter(id=letter_id, text=path.read_text(encoding="utf-8"))
