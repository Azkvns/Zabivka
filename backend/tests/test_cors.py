"""CORS: an allowed Origin is reflected, an unknown one is not."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def test_cors_reflects_allowed_origin_not_unknown(monkeypatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://allowed.example")
    import app.main as main

    importlib.reload(main)
    with TestClient(main.app) as client:
        allowed = client.get(
            "/api/health", headers={"Origin": "https://allowed.example"}
        )
        unknown = client.get(
            "/api/health", headers={"Origin": "https://other.example"}
        )

    assert allowed.headers.get("access-control-allow-origin") == "https://allowed.example"
    assert unknown.headers.get("access-control-allow-origin") != "https://other.example"
