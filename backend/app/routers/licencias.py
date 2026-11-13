"""Acceso al sitio por licencia. La ficha de sesión viaja en `Authorization: Bearer …`, nunca en la dirección."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.licencias import ErrorLicencia, licencias
from app.routers.tenants import require_admin

public = APIRouter(prefix="/api/licencia")
admin = APIRouter(prefix="/api/admin/licencias", dependencies=[Depends(require_admin)])


class Clave(BaseModel):
    clave: str = Field(max_length=200)


class Nueva(BaseModel):
    medio: str = Field(max_length=120)
    vence: str = Field(max_length=40)


class Cambio(BaseModel):
    activa: Optional[bool] = None
    vence: Optional[str] = Field(default=None, max_length=40)


def _ip(req: Request) -> str:
    return req.headers.get("cf-connecting-ip") or (req.client.host if req.client else "desconocida")


def _ficha(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _fallo(e: ErrorLicencia) -> JSONResponse:
    return JSONResponse({"detail": e.mensaje, "motivo": e.motivo}, status_code=e.estado)


@public.post("/entrar")
def entrar(datos: Clave, req: Request):
    try:
        return licencias.entrar(datos.clave, _ip(req))
    except ErrorLicencia as e:
        return _fallo(e)


@public.get("")
def comprobar(authorization: Optional[str] = Header(default=None)):
    try:
        return licencias.comprobar(_ficha(authorization))
    except ErrorLicencia as e:
        return _fallo(e)


@public.post("/salir", status_code=204)
def salir(authorization: Optional[str] = Header(default=None)):
    licencias.salir(_ficha(authorization))


@admin.get("")
def listar():
    return {"licencias": licencias.listar()}


@admin.post("", status_code=201)
def crear(datos: Nueva):
    try:
        return licencias.crear(datos.medio, datos.vence)
    except ErrorLicencia as e:
        return _fallo(e)


@admin.patch("/{id_}")
def cambiar(id_: str, datos: Cambio):
    try:
        return licencias.cambiar(id_, datos.activa, datos.vence)
    except ErrorLicencia as e:
        return _fallo(e)
