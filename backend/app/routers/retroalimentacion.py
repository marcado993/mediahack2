"""Public feedback endpoint + admin inbox with a per-outlet summary."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app import retroalimentacion as retro
from app.routers.solicitudes import _client_key
from app.routers.tenants import require_admin

public = APIRouter(prefix="/api", tags=["retroalimentacion"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])


@public.post("/retroalimentacion", status_code=201)
def create_retro(body: retro.RetroIn, request: Request):
    if body.web:
        # Honeypot filled: pretend it worked so a bot learns nothing.
        return {"ok": True}
    limiter = retro.rate_limit_uso if body.tipo == "uso" else retro.rate_limit_medio
    if not limiter.allow(_client_key(request)):
        raise HTTPException(429, "Recibimos varios envíos seguidos desde tu conexión. Espera un rato antes de enviar otro.")
    retro.store.add(body)
    return {"ok": True}


@admin.get("/retroalimentacion", dependencies=[Depends(require_admin)])
def list_retro(medio: str = ""):
    rows = retro.store.all(medio)
    return {"retroalimentacion": rows, "resumen": retro.resumen(rows)}


@admin.put("/retroalimentacion/{id_}", dependencies=[Depends(require_admin)])
def update_retro(id_: str, body: retro.RetroUpdate):
    row = retro.store.update(id_, body)
    if not row:
        raise HTTPException(404, "No existe esa retroalimentación.")
    return row
