"""Public request form endpoint + admin inbox."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from app import solicitudes
from app.routers.tenants import require_admin

public = APIRouter(prefix="/api", tags=["solicitudes"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])


def _client_key(request: Request) -> str:
    # Behind the Cloudflare Tunnel the socket peer is the proxy, not the visitor.
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "unknown")


@public.post("/solicitudes", status_code=201)
def create_solicitud(body: solicitudes.SolicitudIn, request: Request):
    if body.web:
        # Honeypot filled: pretend it worked so a bot learns nothing.
        return {"ok": True}
    if not solicitudes.rate_limit.allow(_client_key(request)):
        raise HTTPException(429, "Has enviado varias solicitudes seguidas. Espera un rato antes de enviar otra.")
    solicitudes.store.add(body)
    return {"ok": True}


@admin.get("/solicitudes", dependencies=[Depends(require_admin)])
def list_solicitudes():
    return {"solicitudes": solicitudes.store.all()}


@admin.put("/solicitudes/{id_}", dependencies=[Depends(require_admin)])
def update_solicitud(id_: str, body: solicitudes.SolicitudUpdate):
    row = solicitudes.store.update(id_, body)
    if not row:
        raise HTTPException(404, "No existe esa solicitud.")
    return row
