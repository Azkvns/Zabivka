"""Database engine, session helpers, and idempotent seed users."""

from __future__ import annotations

import os

from sqlalchemy import create_engine, select
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return url


def get_engine():
    return create_engine(get_database_url())


def get_session_factory(engine=None):
    return sessionmaker(bind=engine or get_engine())


def ensure_seed_users(session: Session) -> None:
    """Insert admin/user demo accounts if missing (unique on login)."""
    from app.models import User
    from app.security import hash_password

    seeds = (
        ("admin", "Admin12345", "admin"),
        ("user", "User12345", "user"),
    )
    for login, password, role in seeds:
        exists = session.scalar(select(User.id).where(User.login == login))
        if exists is None:
            session.add(
                User(
                    login=login,
                    password_hash=hash_password(password),
                    role=role,
                )
            )
    session.flush()
