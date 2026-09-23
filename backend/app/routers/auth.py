"""Registration and login."""

from __future__ import annotations

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.security import decode_jwt, encode_jwt, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    model_config = ConfigDict(extra="ignore")

    login: str
    password: str


class UserOut(BaseModel):
    id: int
    login: str
    role: str


class TokenOut(BaseModel):
    access_token: str


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def register(body: Credentials, db: Session = Depends(get_db)) -> User:
    exists = db.scalar(select(User.id).where(User.login == body.login))
    if exists is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="login already exists")
    user = User(
        login=body.login,
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    try:
        db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="login already exists",
        ) from exc
    return user


@router.post("/login", response_model=TokenOut)
def login(body: Credentials, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.login == body.login))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="invalid credentials",
        )
    return TokenOut(access_token=encode_jwt(str(user.id), user.role))


def get_optional_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User | None:
    if authorization is None:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    try:
        payload = decode_jwt(token)
        user_id = int(payload["sub"])
    except (ValueError, KeyError, jwt.InvalidTokenError) as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        ) from exc
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="invalid token")
    return user
