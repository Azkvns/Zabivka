"""Password hashing and JWT secret from the environment."""

from __future__ import annotations

import os

import bcrypt
import jwt

_JWT_ALG = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET is not set")
    return secret


def encode_jwt(sub: str, role: str) -> str:
    return jwt.encode({"sub": sub, "role": role}, get_jwt_secret(), algorithm=_JWT_ALG)


def decode_jwt(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[_JWT_ALG])
