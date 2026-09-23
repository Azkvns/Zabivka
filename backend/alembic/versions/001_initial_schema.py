"""Initial users, tobaccos, mixes schema and seed users.

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-09-23

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.orm import Session

from app.db import ensure_seed_users

# revision identifiers, used by Alembic.
revision: str = "001_initial_schema"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("login", sa.String(length=64), nullable=False),
        sa.Column("password_hash", sa.String(length=128), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.CheckConstraint("role IN ('user', 'admin')", name="ck_users_role"),
        sa.UniqueConstraint("login"),
    )

    op.create_table(
        "tobaccos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("brand", sa.String(length=128), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("strength", sa.String(length=32), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("retired", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(
            "strength IN ('крепкая', 'лёгкая', 'средняя')",
            name="ck_tobaccos_strength",
        ),
    )
    op.create_index(
        "uq_tobaccos_catalog_brand_name",
        "tobaccos",
        ["brand", "name"],
        unique=True,
        postgresql_where=sa.text("owner_id IS NULL"),
    )
    op.create_index(
        "uq_tobaccos_owner_brand_name",
        "tobaccos",
        ["owner_id", "brand", "name"],
        unique=True,
        postgresql_where=sa.text("owner_id IS NOT NULL"),
    )

    op.create_table(
        "tobacco_flavors",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "tobacco_id",
            sa.Integer(),
            sa.ForeignKey("tobaccos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("flavor", sa.String(length=32), nullable=False),
        sa.CheckConstraint(
            "flavor IN ("
            "'десерт', 'классика', 'мята', 'напитки', 'специи', "
            "'фрукты', 'холодок', 'цитрус', 'ягоды'"
            ")",
            name="ck_tobacco_flavors_flavor",
        ),
        sa.UniqueConstraint("tobacco_id", "flavor", name="uq_tobacco_flavors_pair"),
    )

    op.create_table(
        "mixes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("mode", sa.String(length=32), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "mode IN ('random', 'different_flavors', 'softer', 'stronger')",
            name="ck_mixes_mode",
        ),
        sa.CheckConstraint("size IN (2, 3, 4)", name="ck_mixes_size"),
        sa.CheckConstraint(
            "rating IS NULL OR (rating >= 1 AND rating <= 5)",
            name="ck_mixes_rating",
        ),
    )

    op.create_table(
        "mix_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "mix_id",
            sa.Integer(),
            sa.ForeignKey("mixes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "tobacco_id",
            sa.Integer(),
            sa.ForeignKey("tobaccos.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("mix_id", "position", name="uq_mix_items_position"),
    )

    bind = op.get_bind()
    session = Session(bind=bind)
    ensure_seed_users(session)


def downgrade() -> None:
    op.drop_table("mix_items")
    op.drop_table("mixes")
    op.drop_table("tobacco_flavors")
    op.drop_index("uq_tobaccos_owner_brand_name", table_name="tobaccos")
    op.drop_index("uq_tobaccos_catalog_brand_name", table_name="tobaccos")
    op.drop_table("tobaccos")
    op.drop_table("users")
