"""Personal shelf: create, update, and remove the caller's own tobaccos."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain import FLAVORS, STRENGTHS
from app.models import MixItem, Tobacco, TobaccoFlavor, User
from app.routers.auth import get_optional_user
from app.routers.tobaccos import TobaccoOut

router = APIRouter(prefix="/api/shelf", tags=["shelf"])


class TobaccoIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    brand: str
    name: str
    strength: str
    flavors: list[str] = Field(min_length=1)

    @field_validator("brand", "name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("empty")
        return stripped

    @field_validator("strength")
    @classmethod
    def known_strength(cls, value: str) -> str:
        if value not in STRENGTHS:
            raise ValueError("unknown strength")
        return value

    @field_validator("flavors")
    @classmethod
    def known_flavors(cls, value: list[str]) -> list[str]:
        cleaned = [item.strip() for item in value]
        if any(not item for item in cleaned):
            raise ValueError("empty flavor")
        if len(cleaned) != len(set(cleaned)):
            raise ValueError("repeated flavor")
        for flavor in cleaned:
            if flavor not in FLAVORS:
                raise ValueError("unknown flavor")
        return cleaned


def get_required_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    return user


def _tobacco_out(tobacco: Tobacco, flavors: list[str]) -> TobaccoOut:
    return TobaccoOut(
        id=tobacco.id,
        brand=tobacco.brand,
        name=tobacco.name,
        strength=tobacco.strength,
        flavors=flavors,
        retired=tobacco.retired,
        owner_id=tobacco.owner_id,
    )


def _replace_flavors(db: Session, tobacco_id: int, flavors: list[str]) -> None:
    db.execute(delete(TobaccoFlavor).where(TobaccoFlavor.tobacco_id == tobacco_id))
    for flavor in flavors:
        db.add(TobaccoFlavor(tobacco_id=tobacco_id, flavor=flavor))


def _own_tobacco(db: Session, user: User, tobacco_id: int) -> Tobacco:
    tobacco = db.get(Tobacco, tobacco_id)
    if tobacco is None or tobacco.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="tobacco not found")
    return tobacco


@router.post("", status_code=status.HTTP_201_CREATED, response_model=TobaccoOut)
def create_shelf_tobacco(
    body: TobaccoIn,
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> TobaccoOut:
    tobacco = Tobacco(
        brand=body.brand,
        name=body.name,
        strength=body.strength,
        owner_id=user.id,
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


@router.patch("/{tobacco_id}", response_model=TobaccoOut)
def patch_shelf_tobacco(
    tobacco_id: int,
    body: TobaccoIn,
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> TobaccoOut:
    tobacco = _own_tobacco(db, user, tobacco_id)
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


@router.delete("/{tobacco_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf_tobacco(
    tobacco_id: int,
    user: User = Depends(get_required_user),
    db: Session = Depends(get_db),
) -> None:
    tobacco = _own_tobacco(db, user, tobacco_id)
    referenced = db.scalar(
        select(MixItem.id).where(MixItem.tobacco_id == tobacco.id).limit(1)
    )
    if referenced is not None:
        tobacco.retired = True
    else:
        db.execute(delete(TobaccoFlavor).where(TobaccoFlavor.tobacco_id == tobacco.id))
        db.delete(tobacco)
    db.flush()
