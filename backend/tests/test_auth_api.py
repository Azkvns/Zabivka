"""Auth and tobacco catalog API against PostgreSQL zabivka_test."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import jwt
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, get_database_url
from app.models import Tobacco, TobaccoFlavor, User
from app.security import hash_password

_TEST_DB_NAME = "zabivka_test"
_TEST_JWT_SECRET = "test-jwt-secret-32-bytes-minimum!"


def _app_database_url() -> str:
    return os.environ.get("DATABASE_URL") or get_database_url()


def _replace_database(url: str, database: str) -> str:
    parsed = urlparse(url)
    return urlunparse(parsed._replace(path=f"/{database}"))


def _ensure_test_database(app_url: str) -> str:
    """Create zabivka_test on the same server; never touch the app database schema."""
    test_url = _replace_database(app_url, _TEST_DB_NAME)
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
def engine():
    os.environ["JWT_SECRET"] = _TEST_JWT_SECRET
    test_url = _ensure_test_database(_app_database_url())
    engine = create_engine(test_url)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def session(engine):
    with Session(engine) as session:
        yield session
        session.rollback()


@pytest.fixture()
def client(engine):
    from fastapi.testclient import TestClient

    from app.db import get_db
    from app.main import app

    factory = sessionmaker(bind=engine)

    def _get_db():
        db = factory()
        try:
            yield db
            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _add_user(session: Session, login: str, password: str, role: str = "user") -> User:
    user = User(login=login, password_hash=hash_password(password), role=role)
    session.add(user)
    session.flush()
    return user


def _add_tobacco(
    session: Session,
    *,
    brand: str,
    name: str,
    strength: str,
    flavors: tuple[str, ...],
    owner_id: int | None = None,
    retired: bool = False,
) -> Tobacco:
    tobacco = Tobacco(
        brand=brand,
        name=name,
        strength=strength,
        owner_id=owner_id,
        retired=retired,
    )
    session.add(tobacco)
    session.flush()
    for flavor in flavors:
        session.add(TobaccoFlavor(tobacco_id=tobacco.id, flavor=flavor))
    session.commit()
    return tobacco


def test_register_creates_user_with_user_role(client, session: Session):
    response = client.post(
        "/api/auth/register",
        json={"login": "alice", "password": "Alice12345"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["login"] == "alice"
    assert body["role"] == "user"

    stored = session.get(User, body["id"])
    assert stored is not None
    assert stored.role == "user"


def test_register_rejects_self_assigned_admin_role(client, session: Session):
    response = client.post(
        "/api/auth/register",
        json={"login": "mallory", "password": "Mallory12345", "role": "admin"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "user"

    stored = session.get(User, body["id"])
    assert stored is not None
    assert stored.role == "user"


def test_register_duplicate_login_returns_409(client):
    payload = {"login": "alice", "password": "Alice12345"}
    assert client.post("/api/auth/register", json=payload).status_code == 201
    response = client.post("/api/auth/register", json=payload)
    assert response.status_code == 409


def test_login_returns_jwt_with_sub_and_role(client, session: Session):
    user = _add_user(session, "bob", "Bob12345", role="user")
    session.commit()

    response = client.post(
        "/api/auth/login",
        json={"login": "bob", "password": "Bob12345"},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    payload = jwt.decode(token, _TEST_JWT_SECRET, algorithms=["HS256"])
    assert payload["sub"] == str(user.id)
    assert payload["role"] == "user"


def test_list_tobaccos_filters_by_strength(client, session: Session):
    _add_tobacco(
        session,
        brand="Acme",
        name="Light",
        strength="лёгкая",
        flavors=("мята",),
    )
    _add_tobacco(
        session,
        brand="Acme",
        name="Strong",
        strength="крепкая",
        flavors=("ягоды",),
    )

    response = client.get("/api/tobaccos", params={"strength": "лёгкая"})
    assert response.status_code == 200
    items = response.json()
    assert [item["name"] for item in items] == ["Light"]
    assert items[0]["strength"] == "лёгкая"


def test_list_tobaccos_hides_other_users_shelf(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345")
    bob = _add_user(session, "bob", "Bob12345")
    session.commit()
    _add_tobacco(
        session,
        brand="Acme",
        name="AliceMint",
        strength="лёгкая",
        flavors=("мята",),
        owner_id=alice.id,
    )
    _add_tobacco(
        session,
        brand="Acme",
        name="BobBerry",
        strength="средняя",
        flavors=("ягоды",),
        owner_id=bob.id,
    )

    token = client.post(
        "/api/auth/login",
        json={"login": "alice", "password": "Alice12345"},
    ).json()["access_token"]

    response = client.get(
        "/api/tobaccos",
        params={"source": "both"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "AliceMint" in names
    assert "BobBerry" not in names


def test_guest_shelf_or_both_returns_401(client, session: Session):
    _add_tobacco(
        session,
        brand="Acme",
        name="Catalog",
        strength="лёгкая",
        flavors=("мята",),
    )
    assert client.get("/api/tobaccos", params={"source": "shelf"}).status_code == 401
    assert client.get("/api/tobaccos", params={"source": "both"}).status_code == 401


def test_include_retired_forbidden_for_non_admin(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    session.commit()
    token = client.post(
        "/api/auth/login",
        json={"login": "alice", "password": "Alice12345"},
    ).json()["access_token"]

    response = client.get(
        "/api/tobaccos",
        params={"include_retired": True},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403
