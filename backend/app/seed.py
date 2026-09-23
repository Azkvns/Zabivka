"""Idempotent seed: demo users and the bundled catalog CSV."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.db import ensure_seed_users, get_session_factory
from app.domain import CatalogRow, parse_catalog_csv
from app.models import Tobacco, TobaccoFlavor

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "catalog.csv"


def upsert_catalog_rows(session: Session, rows: list[CatalogRow]) -> int:
    """Insert new catalog pairs; update known pairs and un-retire them."""
    for row in rows:
        existing = session.scalar(
            select(Tobacco)
            .options(selectinload(Tobacco.flavors))
            .where(
                Tobacco.owner_id.is_(None),
                Tobacco.brand == row.brand,
                Tobacco.name == row.name,
            )
        )
        if existing is None:
            tobacco = Tobacco(
                brand=row.brand,
                name=row.name,
                strength=row.strength,
                owner_id=None,
                retired=False,
            )
            session.add(tobacco)
            session.flush()
            for flavor in row.flavors:
                session.add(TobaccoFlavor(tobacco_id=tobacco.id, flavor=flavor))
        else:
            existing.strength = row.strength
            existing.retired = False
            session.execute(
                delete(TobaccoFlavor).where(TobaccoFlavor.tobacco_id == existing.id)
            )
            for flavor in row.flavors:
                session.add(TobaccoFlavor(tobacco_id=existing.id, flavor=flavor))
    session.flush()
    return len(rows)


def seed_database(session: Session) -> None:
    ensure_seed_users(session)
    text = CATALOG_PATH.read_text(encoding="utf-8")
    upsert_catalog_rows(session, parse_catalog_csv(text))


def main() -> None:
    session = get_session_factory()()
    try:
        seed_database(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
