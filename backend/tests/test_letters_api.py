import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import letters


@pytest.fixture
def client(tmp_path, monkeypatch):
    # Point the router to a temporary folder with fake letters.
    (tmp_path / "letter_01.txt").write_text("Lettera di valutazione", encoding="utf-8")
    (tmp_path / "letter_16.txt").write_text("Lettera di sviluppo", encoding="utf-8")
    (tmp_path / "letter_16.meta.json").write_text(
        json.dumps({"specialty": "Nefrologia", "complexity": "bassa"}), encoding="utf-8"
    )
    monkeypatch.setattr(letters, "SYNTHETIC_DIR", tmp_path)
    app = FastAPI()
    app.include_router(letters.router, prefix="/api")
    return TestClient(app)


def test_list_shows_only_dev_letters(client):
    response = client.get("/api/letters")
    assert response.status_code == 200
    assert response.json() == [
        {"id": "letter_16", "title": "Lettera 16 - Nefrologia, complessità bassa"}
    ]


def test_get_dev_letter(client):
    response = client.get("/api/letters/letter_16")
    assert response.status_code == 200
    assert response.json() == {"id": "letter_16", "text": "Lettera di sviluppo"}


def test_evaluation_letter_is_hidden(client):
    assert client.get("/api/letters/letter_01").status_code == 404


@pytest.mark.parametrize("bad_id", ["letter_99", "letter_1", "..%2F.env", "abc"])
def test_invalid_ids_return_404(client, bad_id):
    assert client.get(f"/api/letters/{bad_id}").status_code == 404
