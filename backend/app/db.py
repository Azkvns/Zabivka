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
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_engine = None
_session_factory = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(get_database_url())
    return _engine


def get_session_factory(engine=None):
    if engine is not None:
        return sessionmaker(bind=engine)
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine())
    return _session_factory


def get_db():
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


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
