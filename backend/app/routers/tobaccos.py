"""Tobacco catalog listing with filters."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Tobacco, TobaccoFlavor, User
from app.routers.auth import get_optional_user

router = APIRouter(prefix="/api/tobaccos", tags=["tobaccos"])

_SOURCES = frozenset({"catalog", "shelf", "both"})


class TobaccoOut(BaseModel):
    id: int
    brand: str
    name: str
    strength: str
    flavors: list[str]
    retired: bool
    owner_id: int | None


@router.get("", response_model=list[TobaccoOut])
def list_tobaccos(
    brand: str | None = None,
    flavor: str | None = None,
    strength: str | None = None,
    source: str = "catalog",
    include_retired: bool = False,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> list[TobaccoOut]:
    if source not in _SOURCES:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="invalid source")
    if source in ("shelf", "both") and user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="authentication required")
    if include_retired and (user is None or user.role != "admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="admin only")

    stmt = select(Tobacco).options(selectinload(Tobacco.flavors))
    if not include_retired:
        stmt = stmt.where(Tobacco.retired.is_(False))
    if brand is not None:
        stmt = stmt.where(Tobacco.brand == brand)
    if strength is not None:
        stmt = stmt.where(Tobacco.strength == strength)
    if flavor is not None:
        stmt = stmt.where(
            Tobacco.id.in_(
                select(TobaccoFlavor.tobacco_id).where(TobaccoFlavor.flavor == flavor)
            )
        )
    if source == "catalog":
        stmt = stmt.where(Tobacco.owner_id.is_(None))
    elif source == "shelf":
        stmt = stmt.where(Tobacco.owner_id == user.id)
    else:
        stmt = stmt.where(
            or_(Tobacco.owner_id.is_(None), Tobacco.owner_id == user.id)
        )

    rows = db.scalars(stmt.order_by(Tobacco.id)).unique().all()
    return [
        TobaccoOut(
            id=row.id,
            brand=row.brand,
            name=row.name,
            strength=row.strength,
            flavors=[item.flavor for item in row.flavors],
            retired=row.retired,
            owner_id=row.owner_id,
        )
        for row in rows
    ]
