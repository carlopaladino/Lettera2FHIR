import pytest

from app.extraction.prompts import PromptError, load_prompt

VALID = """# Prompt di estrazione
Versione: `extract-v1`

## System
```text
Sei un estrattore.
```

## User
```text
Schema:
{{SCHEMA}}

Lettera:
{{LETTER}}
```
"""


def write(tmp_path, name, content):
    (tmp_path / name).write_text(content, encoding="utf-8")


def test_loads_and_builds_messages(tmp_path):
    write(tmp_path, "extract-v1.md", VALID)
    prompt = load_prompt("extract-v1", tmp_path)
    assert prompt.version == "extract-v1"

    messages = prompt.messages("Testo della lettera", schema='{"type": "object"}')
    assert messages[0] == {"role": "system", "content": "Sei un estrattore."}
    assert messages[1]["role"] == "user"
    assert "Testo della lettera" in messages[1]["content"]
    assert '{"type": "object"}' in messages[1]["content"]
    assert "{{" not in messages[1]["content"]


def test_schema_required_when_placeholder_present(tmp_path):
    write(tmp_path, "extract-v1.md", VALID)
    with pytest.raises(PromptError, match="schema"):
        load_prompt("extract-v1", tmp_path).messages("lettera")


def test_schema_optional_when_placeholder_absent(tmp_path):
    write(tmp_path, "extract-v2.md", VALID.replace("extract-v1", "extract-v2")
          .replace("Schema:\n{{SCHEMA}}\n\n", ""))
    messages = load_prompt("extract-v2", tmp_path).messages("lettera")
    assert messages[1]["content"] == "Lettera:\nlettera"


def test_declared_version_must_match_file_name(tmp_path):
    write(tmp_path, "extract-v2.md", VALID)  # file says extract-v1
    with pytest.raises(PromptError, match="must match"):
        load_prompt("extract-v2", tmp_path)


@pytest.mark.parametrize("bad", ["extract-v1.md", "../.env", "extract-vX", "gen-v1", ""])
def test_invalid_version_names(tmp_path, bad):
    with pytest.raises(PromptError, match="invalid"):
        load_prompt(bad, tmp_path)


def test_missing_file(tmp_path):
    with pytest.raises(PromptError, match="not found"):
        load_prompt("extract-v9", tmp_path)


def test_missing_letter_placeholder(tmp_path):
    write(tmp_path, "extract-v1.md", VALID.replace("{{LETTER}}", ""))
    with pytest.raises(PromptError, match="LETTER"):
        load_prompt("extract-v1", tmp_path)


def test_missing_section(tmp_path):
    write(tmp_path, "extract-v1.md", VALID.split("## User")[0])
    with pytest.raises(PromptError, match="sections"):
        load_prompt("extract-v1", tmp_path)