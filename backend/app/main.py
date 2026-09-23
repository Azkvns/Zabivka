"""FastAPI application."""

from __future__ import annotations

from fastapi import FastAPI

from app.routers import auth, tobaccos

app = FastAPI(title="Забивка")
app.include_router(auth.router)
app.include_router(tobaccos.router)
