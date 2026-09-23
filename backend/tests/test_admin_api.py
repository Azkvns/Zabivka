"""Shelf and admin catalog API against PostgreSQL zabivka_test."""

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


def _catalog_count(session: Session) -> int:
    return session.scalar(
        select(func.count()).select_from(Tobacco).where(Tobacco.owner_id.is_(None))
    ) or 0


def test_user_cannot_clear_catalog(client, session: Session):
    _add_user(session, "alice", "Alice12345", role="user")
    session.commit()
    catalog = _add_tobacco(
        session,
        brand="Туман",
        name="Мята",
        strength="лёгкая",
        flavors=("мята",),
    )
    token = _login(client, "alice", "Alice12345")

    response = client.post(
        "/api/admin/catalog/clear",
        json={"confirm": "CLEAR"},
        headers=_auth(token),
    )

    assert response.status_code == 403
    session.expire_all()
    stored = session.get(Tobacco, catalog.id)
    assert stored is not None
    assert stored.retired is False


def test_import_bad_line_4_leaves_catalog_count(client, session: Session):
    _add_user(session, "admin", "Admin12345", role="admin")
    session.commit()
    _add_tobacco(
        session,
        brand="Туман",
        name="Мята",
        strength="лёгкая",
        flavors=("мята",),
    )
    _add_tobacco(
        session,
        brand="Туман",
        name="Ягоды",
        strength="средняя",
        flavors=("ягоды",),
    )
    session.expire_all()
    before = _catalog_count(session)
    token = _login(client, "admin", "Admin12345")
    csv_text = (
        "бренд,название,крепость,вкусы\n"
        "Поляна,Цитрус,лёгкая,цитрус\n"
        "Поляна,Фрукт,средняя,фрукты\n"
        "Поляна,Слом,неизвестная,мята\n"
    )

    response = client.post(
        "/api/admin/catalog/import",
        files={"file": ("catalog.csv", csv_text.encode("utf-8"), "text/csv")},
        headers=_auth(token),
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["line"] == 4
    assert "reason" in detail
    session.expire_all()
    assert _catalog_count(session) == before
    names = {
        row.name
        for row in session.scalars(
            select(Tobacco).where(Tobacco.owner_id.is_(None))
        )
    }
    assert names == {"Мята", "Ягоды"}


def test_reimport_revives_retired_without_new_id(client, session: Session):
    _add_user(session, "admin", "Admin12345", role="admin")
    session.commit()
    retired = _add_tobacco(
        session,
        brand="Туман",
        name="Мята",
        strength="лёгкая",
        flavors=("мята",),
        retired=True,
    )
    token = _login(client, "admin", "Admin12345")
    csv_text = (
        "бренд,название,крепость,вкусы\n"
        "Туман,Мята,крепкая,десерт;специи\n"
    )

    response = client.post(
        "/api/admin/catalog/import",
        files={"file": ("catalog.csv", csv_text.encode("utf-8"), "text/csv")},
        headers=_auth(token),
    )

    assert response.status_code == 200
    session.expire_all()
    rows = session.scalars(
        select(Tobacco).where(
            Tobacco.owner_id.is_(None),
            Tobacco.brand == "Туман",
            Tobacco.name == "Мята",
        )
    ).all()
    assert len(rows) == 1
    stored = rows[0]
    assert stored.id == retired.id
    assert stored.retired is False
    assert stored.strength == "крепкая"
    flavors = {
        item.flavor
        for item in session.scalars(
            select(TobaccoFlavor).where(TobaccoFlavor.tobacco_id == stored.id)
        )
    }
    assert flavors == {"десерт", "специи"}


def test_shelf_survives_catalog_clear(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345", role="user")
    _add_user(session, "admin", "Admin12345", role="admin")
    session.commit()
    catalog = _add_tobacco(
        session,
        brand="Туман",
        name="Каталог",
        strength="лёгкая",
        flavors=("мята",),
    )
    shelf = _add_tobacco(
        session,
        brand="Поляна",
        name="Полка",
        strength="средняя",
        flavors=("ягоды",),
        owner_id=alice.id,
    )
    mix = Mix(user_id=alice.id, mode="random", size=2)
    session.add(mix)
    session.flush()
    session.add_all(
        [
            MixItem(mix_id=mix.id, tobacco_id=catalog.id, position=1),
            MixItem(mix_id=mix.id, tobacco_id=shelf.id, position=2),
        ]
    )
    session.commit()
    admin_token = _login(client, "admin", "Admin12345")
    user_token = _login(client, "alice", "Alice12345")

    response = client.post(
        "/api/admin/catalog/clear",
        json={"confirm": "CLEAR"},
        headers=_auth(admin_token),
    )

    assert response.status_code == 200
    assert response.json() == 1
    session.expire_all()
    stored_catalog = session.get(Tobacco, catalog.id)
    stored_shelf = session.get(Tobacco, shelf.id)
    stored_user = session.get(User, alice.id)
    stored_mix = session.get(Mix, mix.id)
    assert stored_catalog is not None
    assert stored_catalog.retired is True
    assert stored_shelf is not None
    assert stored_shelf.retired is False
    assert stored_shelf.owner_id == alice.id
    assert stored_user is not None
    assert stored_mix is not None

    listed = client.get(
        "/api/tobaccos",
        params={"source": "shelf"},
        headers=_auth(user_token),
    )
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [shelf.id]


def test_shelf_create_lists_own_tobacco(client, session: Session):
    _add_user(session, "alice", "Alice12345")
    session.commit()
    token = _login(client, "alice", "Alice12345")

    response = client.post(
        "/api/shelf",
        json={
            "brand": "Поляна",
            "name": "Мята",
            "strength": "лёгкая",
            "flavors": ["мята", "холодок"],
        },
        headers=_auth(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["brand"] == "Поляна"
    assert body["name"] == "Мята"
    assert body["owner_id"] is not None
    assert body["retired"] is False
    listed = client.get(
        "/api/tobaccos",
        params={"source": "shelf"},
        headers=_auth(token),
    )
    assert [item["id"] for item in listed.json()] == [body["id"]]


def test_shelf_patch_updates_own_tobacco(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345")
    session.commit()
    tobacco = _add_tobacco(
        session,
        brand="Поляна",
        name="Старое",
        strength="лёгкая",
        flavors=("мята",),
        owner_id=alice.id,
    )
    token = _login(client, "alice", "Alice12345")

    response = client.patch(
        f"/api/shelf/{tobacco.id}",
        json={
            "brand": "Поляна",
            "name": "Новое",
            "strength": "крепкая",
            "flavors": ["специи"],
        },
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == tobacco.id
    assert body["name"] == "Новое"
    assert body["strength"] == "крепкая"
    assert body["flavors"] == ["специи"]
    session.expire_all()
    stored = session.get(Tobacco, tobacco.id)
    assert stored is not None
    assert stored.name == "Новое"
    flavors = {
        item.flavor
        for item in session.scalars(
            select(TobaccoFlavor).where(TobaccoFlavor.tobacco_id == tobacco.id)
        )
    }
    assert flavors == {"специи"}


def test_shelf_foreign_id_returns_404(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345")
    bob = _add_user(session, "bob", "Bob12345")
    session.commit()
    bobs = _add_tobacco(
        session,
        brand="Поляна",
        name="Чужой",
        strength="лёгкая",
        flavors=("мята",),
        owner_id=bob.id,
    )
    token = _login(client, "alice", "Alice12345")

    patch = client.patch(
        f"/api/shelf/{bobs.id}",
        json={
            "brand": "Поляна",
            "name": "Своё",
            "strength": "средняя",
            "flavors": ["ягоды"],
        },
        headers=_auth(token),
    )
    delete = client.delete(f"/api/shelf/{bobs.id}", headers=_auth(token))

    assert patch.status_code == 404
    assert patch.json()["detail"] == "tobacco not found"
    assert delete.status_code == 404
    assert delete.json()["detail"] == "tobacco not found"
    session.expire_all()
    stored = session.get(Tobacco, bobs.id)
    assert stored is not None
    assert stored.owner_id == bob.id
    assert stored.name == "Чужой"
    assert alice.id != bob.id


def test_shelf_delete_without_refs_removes_row(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345")
    session.commit()
    tobacco = _add_tobacco(
        session,
        brand="Поляна",
        name="Лишний",
        strength="лёгкая",
        flavors=("мята",),
        owner_id=alice.id,
    )
    token = _login(client, "alice", "Alice12345")
    tobacco_id = tobacco.id

    response = client.delete(f"/api/shelf/{tobacco_id}", headers=_auth(token))

    assert response.status_code == 204
    session.expire_all()
    assert session.get(Tobacco, tobacco_id) is None


def test_shelf_delete_with_mix_items_retires(client, session: Session):
    alice = _add_user(session, "alice", "Alice12345")
    session.commit()
    first = _add_tobacco(
        session,
        brand="Поляна",
        name="Первый",
        strength="лёгкая",
        flavors=("мята",),
        owner_id=alice.id,
    )
    second = _add_tobacco(
        session,
        brand="Поляна",
        name="Второй",
        strength="средняя",
        flavors=("ягоды",),
        owner_id=alice.id,
    )
    mix = Mix(user_id=alice.id, mode="random", size=2)
    session.add(mix)
    session.flush()
    session.add_all(
        [
            MixItem(mix_id=mix.id, tobacco_id=first.id, position=1),
            MixItem(mix_id=mix.id, tobacco_id=second.id, position=2),
        ]
    )
    session.commit()
    token = _login(client, "alice", "Alice12345")

    response = client.delete(f"/api/shelf/{first.id}", headers=_auth(token))

    assert response.status_code == 204
    session.expire_all()
    stored = session.get(Tobacco, first.id)
    assert stored is not None
    assert stored.retired is True
    listed = client.get(
        "/api/tobaccos",
        params={"source": "shelf"},
        headers=_auth(token),
    )
    assert [item["id"] for item in listed.json()] == [second.id]


def test_user_cannot_create_admin_tobacco(client, session: Session):
    _add_user(session, "alice", "Alice12345", role="user")
    session.commit()
    token = _login(client, "alice", "Alice12345")

    response = client.post(
        "/api/admin/tobaccos",
        json={
            "brand": "Туман",
            "name": "Админский",
            "strength": "лёгкая",
            "flavors": ["мята"],
        },
        headers=_auth(token),
    )

    assert response.status_code == 403
    session.expire_all()
    assert _catalog_count(session) == 0


def test_admin_creates_catalog_tobacco_with_null_owner(client, session: Session):
    _add_user(session, "admin", "Admin12345", role="admin")
    session.commit()
    token = _login(client, "admin", "Admin12345")

    response = client.post(
        "/api/admin/tobaccos",
        json={
            "brand": "Туман",
            "name": "Каталог",
            "strength": "крепкая",
            "flavors": ["специи"],
            "owner_id": 99,
        },
        headers=_auth(token),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["owner_id"] is None
    assert body["brand"] == "Туман"
    session.expire_all()
    stored = session.get(Tobacco, body["id"])
    assert stored is not None
    assert stored.owner_id is None


def test_admin_patch_catalog_tobacco(client, session: Session):
    _add_user(session, "admin", "Admin12345", role="admin")
    session.commit()
    tobacco = _add_tobacco(
        session,
        brand="Туман",
        name="Старое",
        strength="лёгкая",
        flavors=("мята",),
    )
    token = _login(client, "admin", "Admin12345")

    response = client.patch(
        f"/api/admin/tobaccos/{tobacco.id}",
        json={
            "brand": "Туман",
            "name": "Обновлённое",
            "strength": "средняя",
            "flavors": ["цитрус", "холодок"],
        },
        headers=_auth(token),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == tobacco.id
    assert body["name"] == "Обновлённое"
    assert body["owner_id"] is None
    session.expire_all()
    stored = session.get(Tobacco, tobacco.id)
    assert stored is not None
    assert stored.owner_id is None
    assert stored.name == "Обновлённое"


def test_seed_is_idempotent(engine, session: Session):
    from app.seed import seed_database

    seed_database(session)
    session.commit()
    users_once = session.scalar(select(func.count()).select_from(User))
    catalog_once = _catalog_count(session)
    ids_once = set(
        session.scalars(select(Tobacco.id).where(Tobacco.owner_id.is_(None)))
    )

    seed_database(session)
    session.commit()
    session.expire_all()
    assert session.scalar(select(func.count()).select_from(User)) == users_once
    assert _catalog_count(session) == catalog_once
    ids_twice = set(
        session.scalars(select(Tobacco.id).where(Tobacco.owner_id.is_(None)))
    )
    assert ids_twice == ids_once
    assert catalog_once >= 24
    logins = set(session.scalars(select(User.login)))
    assert logins >= {"admin", "user"}
