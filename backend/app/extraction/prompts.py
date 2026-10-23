"""Load versioned extraction prompts from the prompts/ folder.

A prompt version is a file: prompts/extract-v1.md, prompts/extract-v2.md, ...
Files are never edited after use; a change means a new file with a new version.
The version written inside the file must match the file name, so the version
recorded in results and in the audit log is always the prompt actually used.

Expected file format:

    # any title
    Versione: `extract-v1`

    ## System
    ```text
    ...instructions...
    ```

    ## User
    ```text
    ...text containing {{LETTER}} and optionally {{SCHEMA}}...
    ```
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
PROMPTS_DIR = REPO_ROOT / "prompts"

VERSION_NAME = re.compile(r"^extract-v\d+$")
DECLARED_VERSION = re.compile(r"Versione:\s*`([^`]+)`")
SECTION = r"##\s*{name}\s*```(?:text)?\n(.*?)\n```"


class PromptError(Exception):
    """The prompt file is missing or malformed."""


@dataclass(frozen=True)
class ExtractionPrompt:
    version: str
    system: str
    user_template: str

    def messages(self, letter: str, schema: str | None = None) -> list[dict[str, str]]:
        """Build the chat messages for one letter."""
        user = self.user_template.replace("{{LETTER}}", letter)
        if "{{SCHEMA}}" in user:
            if schema is None:
                raise PromptError(f"{self.version} needs the schema but none was given")
            user = user.replace("{{SCHEMA}}", schema)
        return [
            {"role": "system", "content": self.system},
            {"role": "user", "content": user},
        ]


def load_prompt(version: str, prompts_dir: Path = PROMPTS_DIR) -> ExtractionPrompt:
    # Strict name check: also prevents reading files outside prompts/.
    if not VERSION_NAME.match(version):
        raise PromptError(f"invalid prompt version {version!r}, expected e.g. 'extract-v1'")

    path = prompts_dir / f"{version}.md"
    if not path.exists():
        raise PromptError(f"prompt file not found: {path}")
    text = path.read_text(encoding="utf-8")

    declared = DECLARED_VERSION.search(text)
    if not declared:
        raise PromptError(f"{path.name}: missing 'Versione: `...`' line")
    if declared.group(1) != version:
        raise PromptError(
            f"{path.name} declares version {declared.group(1)!r}: "
            "file name and declared version must match"
        )

    system = re.search(SECTION.format(name="System"), text, re.DOTALL)
    user = re.search(SECTION.format(name="User"), text, re.DOTALL)
    if not system or not user:
        raise PromptError(f"{path.name}: needs '## System' and '## User' sections with a ``` block")
    if "{{LETTER}}" not in user.group(1):
        raise PromptError(f"{path.name}: the User section must contain {{{{LETTER}}}}")

    return ExtractionPrompt(version=version, system=system.group(1), user_template=user.group(1))