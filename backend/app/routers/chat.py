"""Chat temporal y anónimo: un canal WebSocket por sala y un listado de salas con quién está en línea."""

from __future__ import annotations

import asyncio
import json
import os
import re
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.chat import gestor

router = APIRouter()

# El sitio público y las pruebas locales. Un medio con dominio propio se agrega en CHAT_ORIGINS
# (separados por coma). Un navegador siempre manda Origin; sin él (scripts) se deja pasar.
_ORIGEN_BASE = re.compile(r"^(https://mediahack2-frontend[a-z0-9-]*\.vercel\.app|https?://(localhost|127\.0\.0\.1)(:\d+)?)$")
_EXTRA = {o.strip().rstrip("/") for o in os.getenv("CHAT_ORIGINS", "").split(",") if o.strip()}
SIN_LIMITE_DE_FRAME = 2048
INACTIVIDAD = 300  # segundos sin ningún mensaje ni latido


def origen_permitido(origen: Optional[str]) -> bool:
    if not origen:
        return True
    return bool(_ORIGEN_BASE.match(origen)) or origen.rstrip("/") in _EXTRA


@router.get("/api/chat/salas")
def salas():
    return {"salas": gestor.conteos()}


@router.websocket("/ws/chat/{sala}")
async def canal(ws: WebSocket, sala: str, n: Optional[str] = Query(None, max_length=20)):
    if not origen_permitido(ws.headers.get("origin")):
        await ws.close(code=1008)
        return
    ip = ws.headers.get("cf-connecting-ip") or (ws.client.host if ws.client else "desconocida")
    motivo = gestor.puede_entrar(sala, ip)
    await ws.accept()
    if motivo:
        await ws.send_json({"t": "error", "x": motivo})
        await ws.close(code=1013)
        return
    c = await gestor.conectar(ws, sala, ip, n)
    try:
        while True:
            try:
                bruto = await asyncio.wait_for(ws.receive_text(), timeout=INACTIVIDAD)
            except asyncio.TimeoutError:
                break
            if len(bruto) > SIN_LIMITE_DE_FRAME:
                break
            try:
                datos = json.loads(bruto)
            except ValueError:
                continue
            if not isinstance(datos, dict):
                continue
            if datos.get("t") == "msg":
                await gestor.mensaje(c, datos.get("x"))
            elif datos.get("t") == "ping":
                await ws.send_json({"t": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await gestor.salir(c)
        try:
            await ws.close()
        except Exception:
            pass
