"""FastAPI application."""

from __future__ import annotations

from fastapi import FastAPI

from app.routers import admin, auth, mixes, roulette, shelf, tobaccos

app = FastAPI(title="Забивка")
app.include_router(auth.router)
app.include_router(tobaccos.router)
app.include_router(roulette.router)
app.include_router(mixes.router)
app.include_router(shelf.router)
app.include_router(admin.router)
