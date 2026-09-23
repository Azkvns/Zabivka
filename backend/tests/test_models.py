"""Model constraints against PostgreSQL from Compose."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, get_database_url
from app.models import Tobacco, User
from app.security import hash_password

_TEST_DB_NAME = "zabivka_test"


def _app_database_url() -> str:
    return os.environ.get("DATABASE_URL") or get_database_url()


def _replace_database(url: str, database: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"/{database}"))


def _ensure_test_database(app_url: str) -> str:
    """Create zabivka_test on the same server; never touch the app database schema."""
    test_url = _replace_database(app_url, _TEST_DB_NAME)
    # Connect to the seeded app DB only to issue CREATE DATABASE (no DDL on tables).
    admin_engine = create_engine(app_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": _TEST_DB_NAME},
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{_TEST_DB_NAME}"'))
    finally:
        admin_engine.dispose()
    return test_url


@pytest.fixture()
def session():
    test_url = _ensure_test_database(_app_database_url())
    engine = create_engine(test_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
        session.rollback()
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_partial_unique_rejects_two_catalog_tobaccos_same_brand_name(session: Session):
    session.add(
        Tobacco(
            brand="Acme",
            name="Berry",
            strength="лёгкая",
            owner_id=None,
            retired=False,
        )
    )
    session.commit()

    session.add(
        Tobacco(
            brand="Acme",
            name="Berry",
            strength="средняя",
            owner_id=None,
            retired=False,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()


def test_owned_tobacco_same_brand_name_allowed_for_different_owners(session: Session):
    alice = User(login="alice", password_hash=hash_password("Alice12345"), role="user")
    bob = User(login="bob", password_hash=hash_password("Bob12345"), role="user")
    session.add_all([alice, bob])
    session.flush()

    session.add(
        Tobacco(
            brand="Acme",
            name="Berry",
            strength="лёгкая",
            owner_id=alice.id,
            retired=False,
        )
    )
    session.add(
        Tobacco(
            brand="Acme",
            name="Berry",
            strength="крепкая",
            owner_id=bob.id,
            retired=False,
        )
    )
    session.commit()

    rows = session.scalars(select(Tobacco).where(Tobacco.brand == "Acme")).all()
    assert len(rows) == 2
    assert {r.owner_id for r in rows} == {alice.id, bob.id}
