"""FastAPI application."""

from __future__ import annotations

from fastapi import FastAPI

from app.routers import auth, mixes, roulette, tobaccos

app = FastAPI(title="Забивка")
app.include_router(auth.router)
app.include_router(tobaccos.router)
app.include_router(roulette.router)
app.include_router(mixes.router)
