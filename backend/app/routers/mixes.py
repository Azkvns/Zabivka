"""Saved mixes: create from a spin screen, list own history, patch note/rating."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_db
from app.models import Mix, MixItem, Tobacco, User
from app.routers.auth import get_optional_user

router = APIRouter(prefix="/api/mixes", tags=["mixes"])


class MixCreateIn(BaseModel):
    mode: Literal["random", "different_flavors", "softer", "stronger"]
    tobacco_ids: list[int] = Field(min_length=2, max_length=4)


class MixPatchIn(BaseModel):
    note: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)


class MixItemOut(BaseModel):
    position: int
    tobacco_id: int
    name: str
    retired: bool


class MixOut(BaseModel):
    id: int
    mode: str
    size: int
    note: str | None
    rating: int | None
    created_at: datetime
    items: list[MixItemOut]


def get_required_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    return user


def _visible_tobacco(tobacco: Tobacco | None, user: User) -> bool:
    if tobacco is None or tobacco.retired:
        return False
    return tobacco.owner_id is None or tobacco.owner_id == user.id


def _mix_out(mix: Mix) -> MixOut:
    items = sorted(mix.items, key=lambda item: item.position)
    return MixOut(
        id=mix.id,
        mode=mix.mode,
        size=mix.size,
        note=mix.note,
        rating=mix.rating,
        created_at=mix.created_at,
        items=[
            MixItemOut(
                position=item.position,
                tobacco_id=item.tobacco_id,
                name=item.tobacco.name,
                retired=item.tobacco.retired,
            )
            for item in items
        ],
    )


@router.post("", status_code=status.HTTP_201_CREATED, response_model=MixOut)
def create_mix(
    body: MixCreateIn,
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> MixOut:
    tobaccos: list[Tobacco] = []
    for tobacco_id in body.tobacco_ids:
        tobacco = db.get(Tobacco, tobacco_id)
        if not _visible_tobacco(tobacco, user):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="tobacco is not available",
            )
        tobaccos.append(tobacco)

    items = [
        MixItem(position=position, tobacco=tobacco)
        for position, tobacco in enumerate(tobaccos, start=1)
    ]
    mix = Mix(
        user_id=user.id,
        mode=body.mode,
        size=len(tobaccos),
        items=items,
    )
    db.add(mix)
    db.flush()
    return _mix_out(mix)


@router.get("", response_model=list[MixOut])
def list_mixes(
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> list[MixOut]:
    rows = db.scalars(
        select(Mix)
        .where(Mix.user_id == user.id)
        .options(selectinload(Mix.items).selectinload(MixItem.tobacco))
        .order_by(Mix.created_at.desc(), Mix.id.desc())
    ).all()
    return [_mix_out(row) for row in rows]


@router.patch("/{mix_id}", response_model=MixOut)
def patch_mix(
    mix_id: int,
    body: MixPatchIn,
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> MixOut:
    mix = db.scalar(
        select(Mix)
        .where(Mix.id == mix_id)
        .options(selectinload(Mix.items).selectinload(MixItem.tobacco))
    )
    if mix is None or mix.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="mix not found")

    if "note" in body.model_fields_set:
        mix.note = body.note
    if "rating" in body.model_fields_set:
        mix.rating = body.rating
    db.flush()
    return _mix_out(mix)
