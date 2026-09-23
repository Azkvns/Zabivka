"""Roulette spin and saved mixes API against PostgreSQL zabivka_test."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import Base, get_database_url
from app.models import Mix, MixItem, Tobacco, TobaccoFlavor, User
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


def _login(client, login: str, password: str) -> str:
    return client.post(
        "/api/auth/login",
        json={"login": login, "password": password},
    ).json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _seed_catalog(session: Session, count: int = 3) -> list[Tobacco]:
    names = ("Mint", "Berry", "Citrus", "Fruit")
    strengths = ("лёгкая", "средняя", "крепкая", "лёгкая")
    flavors = (("мята",), ("ягоды",), ("цитрус",), ("фрукты",))
    return [
        _add_tobacco(
            session,
            brand="Acme",
            name=names[i],
            strength=strengths[i],
            flavors=flavors[i],
        )
        for i in range(count)
    ]


def test_guest_spin_does_not_increase_mixes(client, session: Session):
    _seed_catalog(session, count=3)
    before = session.scalar(select(func.count()).select_from(Mix)) or 0

    response = client.post(
        "/api/roulette/spin",
        json={"count": 2, "mode": "random"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 2
    session.expire_all()
    after = session.scalar(select(func.count()).select_from(Mix)) or 0
    assert after == before == 0


def test_narrow_spin_returns_422_without_mix_row(client, session: Session):
    _seed_catalog(session, count=1)

    response = client.post(
        "/api/roulette/spin",
        json={"count": 3, "mode": "random"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {"reason": "Выборка слишком узкая"}
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(Mix)) == 0


def test_guest_spin_shelf_or_both_returns_401(client, session: Session):
    _seed_catalog(session, count=2)
    assert (
        client.post(
            "/api/roulette/spin",
            json={"count": 2, "mode": "random", "source": "shelf"},
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/roulette/spin",
            json={"count": 2, "mode": "random", "source": "both"},
        ).status_code
        == 401
    )


def test_guest_cannot_save_mix(client, session: Session):
    tobaccos = _seed_catalog(session, count=2)

    response = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [tobaccos[0].id, tobaccos[1].id]},
    )

    assert response.status_code == 401
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(Mix)) == 0


def test_save_mix_writes_positions(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    session.commit()
    first, second = _seed_catalog(session, count=2)
    token = _login(client, "alice", "Alice12345")

    response = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [second.id, first.id]},
        headers=_auth(token),
    )

    assert response.status_code == 201
    session.expire_all()
    mix = session.scalar(select(Mix))
    assert mix is not None
    assert mix.mode == "random"
    assert mix.size == 2
    items = session.scalars(
        select(MixItem).where(MixItem.mix_id == mix.id).order_by(MixItem.position)
    ).all()
    assert [(item.position, item.tobacco_id) for item in items] == [
        (1, second.id),
        (2, first.id),
    ]


def test_save_mix_rejects_retired_or_invisible(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    bob = _add_user(session, "bob", "Bob12345")
    session.commit()
    visible = _add_tobacco(
        session,
        brand="Acme",
        name="Mint",
        strength="лёгкая",
        flavors=("мята",),
    )
    retired = _add_tobacco(
        session,
        brand="Acme",
        name="Old",
        strength="средняя",
        flavors=("ягоды",),
        retired=True,
    )
    bobs = _add_tobacco(
        session,
        brand="Acme",
        name="BobBerry",
        strength="крепкая",
        flavors=("цитрус",),
        owner_id=bob.id,
    )
    token = _login(client, "alice", "Alice12345")

    retired_response = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [visible.id, retired.id]},
        headers=_auth(token),
    )
    missing_response = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [visible.id, 99_999]},
        headers=_auth(token),
    )
    foreign_response = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [visible.id, bobs.id]},
        headers=_auth(token),
    )

    assert retired_response.status_code == 422
    assert missing_response.status_code == 422
    assert foreign_response.status_code == 422
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(Mix)) == 0


def test_get_mixes_only_own_newest_first(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    _add_user(session, "bob", "Bob12345")
    session.commit()
    first, second = _seed_catalog(session, count=2)
    alice_token = _login(client, "alice", "Alice12345")
    bob_token = _login(client, "bob", "Bob12345")

    older = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [first.id, second.id]},
        headers=_auth(alice_token),
    )
    newer = client.post(
        "/api/mixes",
        json={"mode": "softer", "tobacco_ids": [second.id, first.id]},
        headers=_auth(alice_token),
    )
    client.post(
        "/api/mixes",
        json={"mode": "stronger", "tobacco_ids": [first.id, second.id]},
        headers=_auth(bob_token),
    )

    assert older.status_code == 201
    assert newer.status_code == 201
    response = client.get("/api/mixes", headers=_auth(alice_token))
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [newer.json()["id"], older.json()["id"]]
    assert all(item["mode"] in {"random", "softer"} for item in body)


def test_patch_rating_6_returns_422(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    session.commit()
    first, second = _seed_catalog(session, count=2)
    token = _login(client, "alice", "Alice12345")
    created = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [first.id, second.id]},
        headers=_auth(token),
    )
    assert created.status_code == 201

    response = client.patch(
        f"/api/mixes/{created.json()['id']}",
        json={"rating": 6},
        headers=_auth(token),
    )

    assert response.status_code == 422
    session.expire_all()
    mix = session.get(Mix, created.json()["id"])
    assert mix is not None
    assert mix.rating is None


def test_patch_other_users_mix_returns_404(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    _add_user(session, "bob", "Bob12345")
    session.commit()
    first, second = _seed_catalog(session, count=2)
    alice_token = _login(client, "alice", "Alice12345")
    bob_token = _login(client, "bob", "Bob12345")
    created = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [first.id, second.id]},
        headers=_auth(alice_token),
    )
    assert created.status_code == 201

    response = client.patch(
        f"/api/mixes/{created.json()['id']}",
        json={"note": "чужая", "rating": 5},
        headers=_auth(bob_token),
    )

    assert response.status_code == 404


def test_retired_tobacco_remains_in_mix_history(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    session.commit()
    mint, berry = _seed_catalog(session, count=2)
    token = _login(client, "alice", "Alice12345")
    created = client.post(
        "/api/mixes",
        json={"mode": "random", "tobacco_ids": [mint.id, berry.id]},
        headers=_auth(token),
    )
    assert created.status_code == 201

    mint.retired = True
    session.add(mint)
    session.commit()

    response = client.get("/api/mixes", headers=_auth(token))
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    items = body[0]["items"]
    mint_item = next(item for item in items if item["name"] == "Mint")
    assert mint_item["retired"] is True
    berry_item = next(item for item in items if item["name"] == "Berry")
    assert berry_item["retired"] is False
