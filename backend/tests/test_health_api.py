"""Health endpoint used by Compose and the published nginx proxy."""

from __future__ import annotations

import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app


def test_health_returns_200() -> None:
    with TestClient(app) as client:
        response = client.get("/api/health")
        assert response.status_code == 200
