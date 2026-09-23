"""Roulette spin: select a mix from the visible pool without writing."""

from __future__ import annotations

import random
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain import TobaccoPick, TooNarrow, select_mix
from app.models import User
from app.routers.auth import get_optional_user
from app.routers.tobaccos import visible_tobacco_stmt

router = APIRouter(prefix="/api/roulette", tags=["roulette"])


class SpinIn(BaseModel):
    count: Literal[2, 3, 4]
    mode: Literal["random", "different_flavors", "softer", "stronger"]
    brand: str | None = None
    flavor: str | None = None
    strength: str | None = None
    source: Literal["catalog", "both", "shelf"] = "catalog"


class SpinItemOut(BaseModel):
    id: int
    brand: str
    name: str
    strength: str
    flavors: list[str]


class SpinOut(BaseModel):
    mode: str
    count: int
    items: list[SpinItemOut]


@router.post("/spin", response_model=SpinOut)
def spin(
    body: SpinIn,
    user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
) -> SpinOut:
    if body.source in ("shelf", "both") and user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="authentication required")

    rows = db.scalars(
        visible_tobacco_stmt(
            brand=body.brand,
            flavor=body.flavor,
            strength=body.strength,
            source=body.source,
            include_retired=False,
            user=user,
        )
    ).unique().all()
    pool = [
        TobaccoPick(
            id=row.id,
            strength=row.strength,
            flavors=frozenset(item.flavor for item in row.flavors),
        )
        for row in rows
    ]
    try:
        picks = select_mix(pool, body.count, body.mode, random.Random())
    except TooNarrow as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={"reason": "Выборка слишком узкая"},
        ) from exc

    by_id = {row.id: row for row in rows}
    return SpinOut(
        mode=body.mode,
        count=body.count,
        items=[
            SpinItemOut(
                id=pick.id,
                brand=by_id[pick.id].brand,
                name=by_id[pick.id].name,
                strength=by_id[pick.id].strength,
                flavors=[item.flavor for item in by_id[pick.id].flavors],
            )
            for pick in picks
        ],
    )
