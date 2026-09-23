"""Render hands over postgres://; SQLAlchemy + psycopg need a driver URL."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import get_database_url


def test_get_database_url_normalizes_render_postgres_scheme(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h:5432/db")
    assert get_database_url() == "postgresql+psycopg://u:p@h:5432/db"
