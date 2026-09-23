"""SQLAlchemy models for users, tobaccos, flavors, mixes, and mix items."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.domain import FLAVORS, STRENGTHS

_STRENGTH_IN = ", ".join(f"'{s}'" for s in sorted(STRENGTHS))
_FLAVOR_IN = ", ".join(f"'{f}'" for f in sorted(FLAVORS))
_MODE_IN = ", ".join(
    f"'{m}'" for m in ("random", "different_flavors", "softer", "stronger")
)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    login: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    role: Mapped[str] = mapped_column(String(16), nullable=False)

    tobaccos: Mapped[list[Tobacco]] = relationship(back_populates="owner")
    mixes: Mapped[list[Mix]] = relationship(back_populates="user")


class Tobacco(Base):
    __tablename__ = "tobaccos"
    __table_args__ = (
        CheckConstraint(f"strength IN ({_STRENGTH_IN})", name="ck_tobaccos_strength"),
        Index(
            "uq_tobaccos_catalog_brand_name",
            "brand",
            "name",
            unique=True,
            postgresql_where=text("owner_id IS NULL"),
        ),
        Index(
            "uq_tobaccos_owner_brand_name",
            "owner_id",
            "brand",
            "name",
            unique=True,
            postgresql_where=text("owner_id IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    brand: Mapped[str] = mapped_column(String(128), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    strength: Mapped[str] = mapped_column(String(32), nullable=False)
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )
    retired: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    owner: Mapped[User | None] = relationship(back_populates="tobaccos")
    flavors: Mapped[list[TobaccoFlavor]] = relationship(back_populates="tobacco")
    mix_items: Mapped[list[MixItem]] = relationship(back_populates="tobacco")


class TobaccoFlavor(Base):
    __tablename__ = "tobacco_flavors"
    __table_args__ = (
        UniqueConstraint("tobacco_id", "flavor", name="uq_tobacco_flavors_pair"),
        CheckConstraint(f"flavor IN ({_FLAVOR_IN})", name="ck_tobacco_flavors_flavor"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tobacco_id: Mapped[int] = mapped_column(
        ForeignKey("tobaccos.id", ondelete="CASCADE"),
        nullable=False,
    )
    flavor: Mapped[str] = mapped_column(String(32), nullable=False)

    tobacco: Mapped[Tobacco] = relationship(back_populates="flavors")


class Mix(Base):
    __tablename__ = "mixes"
    __table_args__ = (
        CheckConstraint(f"mode IN ({_MODE_IN})", name="ck_mixes_mode"),
        CheckConstraint("size IN (2, 3, 4)", name="ck_mixes_size"),
        CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_mixes_rating",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    mode: Mapped[str] = mapped_column(String(32), nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    user: Mapped[User] = relationship(back_populates="mixes")
    items: Mapped[list[MixItem]] = relationship(back_populates="mix")


class MixItem(Base):
    __tablename__ = "mix_items"
    __table_args__ = (
        UniqueConstraint("mix_id", "position", name="uq_mix_items_position"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mix_id: Mapped[int] = mapped_column(
        ForeignKey("mixes.id", ondelete="CASCADE"),
        nullable=False,
    )
    tobacco_id: Mapped[int] = mapped_column(
        ForeignKey("tobaccos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)

    mix: Mapped[Mix] = relationship(back_populates="items")
    tobacco: Mapped[Tobacco] = relationship(back_populates="mix_items")
