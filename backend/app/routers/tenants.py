"""
Public tenant config (what a medio's audience loads) and the token-protected
admin API (what the editors of the platform use to manage medios and flags).
"""
from __future__ import annotations

import hmac
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app import tenants

public = APIRouter(prefix="/api", tags=["tenants"])
admin = APIRouter(prefix="/api/admin", tags=["admin"])


@public.get("/tenant-config")
def tenant_config(medio: Optional[str] = Query(default=None, max_length=40), host: Optional[str] = Query(default=None, max_length=253)):
    """Brand + resolved flags for one outlet. Falls back to the default tenant
    for an unknown, unpublished or missing `medio`, so the site never breaks."""
    return tenants.store.resolve(medio, host)


def require_admin(x_admin_token: Optional[str] = Header(default=None)) -> None:
    expected = os.getenv("ADMIN_TOKEN", "")
    if not expected:
        raise HTTPException(503, "El panel está desactivado: falta ADMIN_TOKEN en la configuración del servidor.")
    if not x_admin_token or not hmac.compare_digest(x_admin_token.encode(), expected.encode()):
        raise HTTPException(401, "Token incorrecto.")


def _with_slug(slug: str, rec: dict) -> dict:
    return {"slug": slug, **rec}


@admin.get("/flags", dependencies=[Depends(require_admin)])
def list_flags():
    return {"flags": tenants.FLAGS}


@admin.get("/tenants", dependencies=[Depends(require_admin)])
def list_tenants():
    data = tenants.store.all()
    ordered = sorted(data.items(), key=lambda kv: (kv[0] != tenants.DEFAULT_SLUG, kv[1]["nombre"].lower()))
    return {"tenants": [_with_slug(s, r) for s, r in ordered]}


@admin.post("/tenants/{slug}", status_code=201, dependencies=[Depends(require_admin)])
def create_tenant(slug: str, body: tenants.TenantIn):
    if not tenants.valid_slug(slug):
        raise HTTPException(422, "El identificador usa solo minúsculas, números y guiones (2 a 40 caracteres).")
    if tenants.store.get(slug):
        raise HTTPException(409, f"Ya existe un medio con el identificador «{slug}».")
    return _with_slug(slug, tenants.store.save(slug, body))


@admin.put("/tenants/{slug}", dependencies=[Depends(require_admin)])
def update_tenant(slug: str, body: tenants.TenantIn):
    if not tenants.store.get(slug):
        raise HTTPException(404, f"No existe el medio «{slug}».")
    return _with_slug(slug, tenants.store.save(slug, body))


@admin.delete("/tenants/{slug}", status_code=204, dependencies=[Depends(require_admin)])
def delete_tenant(slug: str):
    if slug == tenants.DEFAULT_SLUG:
        raise HTTPException(400, "La configuración base no se puede eliminar.")
    if not tenants.store.delete(slug):
        raise HTTPException(404, f"No existe el medio «{slug}».")
