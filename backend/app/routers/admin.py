"""Admin catalog editing, CSV import, and catalog clear."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.domain import CsvRowError, parse_catalog_csv
from app.models import Tobacco, User
from app.routers.auth import get_optional_user
from app.routers.shelf import TobaccoIn, _replace_flavors, _tobacco_out
from app.routers.tobaccos import TobaccoOut
from app.seed import upsert_catalog_rows

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ClearIn(BaseModel):
    confirm: Literal["CLEAR"]


def get_admin_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="admin only")
    return user


def _catalog_tobacco(db: Session, tobacco_id: int) -> Tobacco:
    tobacco = db.scalar(
        select(Tobacco)
        .options(selectinload(Tobacco.flavors))
        .where(Tobacco.id == tobacco_id, Tobacco.owner_id.is_(None))
    )
    if tobacco is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="tobacco not found")
    return tobacco


@router.post("/tobaccos", status_code=status.HTTP_201_CREATED, response_model=TobaccoOut)
def create_catalog_tobacco(
    body: TobaccoIn,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TobaccoOut:
    tobacco = Tobacco(
        brand=body.brand,
        name=body.name,
        strength=body.strength,
        owner_id=None,
        retired=False,
    )
    db.add(tobacco)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="tobacco already exists",
        ) from exc
    _replace_flavors(db, tobacco.id, body.flavors)
    db.flush()
    return _tobacco_out(tobacco, body.flavors)


@router.patch("/tobaccos/{tobacco_id}", response_model=TobaccoOut)
def patch_catalog_tobacco(
    tobacco_id: int,
    body: TobaccoIn,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> TobaccoOut:
    tobacco = _catalog_tobacco(db, tobacco_id)
    tobacco.brand = body.brand
    tobacco.name = body.name
    tobacco.strength = body.strength
    _replace_flavors(db, tobacco.id, body.flavors)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="tobacco already exists",
        ) from exc
    return _tobacco_out(tobacco, body.flavors)


@router.post("/catalog/clear")
def clear_catalog(
    _body: ClearIn,
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> int:
    rows = db.scalars(
        select(Tobacco).where(
            Tobacco.owner_id.is_(None),
            Tobacco.retired.is_(False),
        )
    ).all()
    for row in rows:
        row.retired = True
    db.flush()
    return len(rows)


@router.post("/catalog/import")
def import_catalog(
    file: UploadFile = File(...),
    _admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
) -> dict[str, int]:
    payload = file.file.read()
    text = payload.decode("utf-8") if isinstance(payload, bytes) else payload
    try:
        rows = parse_catalog_csv(text)
    except CsvRowError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"line": exc.line, "reason": exc.reason},
        ) from exc
    imported = upsert_catalog_rows(db, rows)
    return {"imported": imported}
