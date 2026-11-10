"""Crear cuenta, entrar, salir y borrar la cuenta. La ficha de sesión viaja en `Authorization: Bearer …`,
nunca en la dirección, para que no quede en historiales ni en registros del servidor."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.cuentas import ErrorCuenta, cuentas

router = APIRouter(prefix="/api/cuenta")


class Credenciales(BaseModel):
    seudonimo: str = Field(max_length=60)
    clave: str = Field(max_length=400)


class SoloClave(BaseModel):
    clave: str = Field(max_length=400)


def _ip(req: Request) -> str:
    return req.headers.get("cf-connecting-ip") or (req.client.host if req.client else "desconocida")


def _ficha(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return None


def _fallo(e: ErrorCuenta) -> JSONResponse:
    return JSONResponse({"detail": e.mensaje, "campo": e.campo}, status_code=e.estado)


@router.post("/registro", status_code=201)
def registro(datos: Credenciales, req: Request):
    try:
        cuentas.frenar("registro", _ip(req))
        return cuentas.registrar(datos.seudonimo, datos.clave)
    except ErrorCuenta as e:
        return _fallo(e)


@router.post("/entrar")
def entrar(datos: Credenciales, req: Request):
    try:
        cuentas.frenar("entrar", _ip(req))
        return cuentas.entrar(datos.seudonimo, datos.clave)
    except ErrorCuenta as e:
        return _fallo(e)


@router.get("")
def yo(authorization: Optional[str] = Header(default=None)):
    seudonimo = cuentas.quien(_ficha(authorization))
    if not seudonimo:
        return JSONResponse({"detail": "Tu sesión venció. Entra de nuevo.", "campo": ""}, status_code=401)
    return {"seudonimo": seudonimo}


@router.post("/salir", status_code=204)
def salir(authorization: Optional[str] = Header(default=None)):
    cuentas.salir(_ficha(authorization))


@router.post("/borrar", status_code=204)
def borrar(datos: SoloClave, req: Request, authorization: Optional[str] = Header(default=None)):
    try:
        cuentas.frenar("entrar", _ip(req))
        cuentas.borrar(_ficha(authorization), datos.clave)
    except ErrorCuenta as e:
        return _fallo(e)
