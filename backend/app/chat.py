"""Chat temporal y anónimo de OVADE.

Salas en memoria: una general y una por provincia. Nada se guarda en disco ni en base de datos:
los mensajes viven 30 minutos (los últimos 60 por sala) y desaparecen al reiniciar el servicio.
No hay cuentas: cada conexión recibe un nombre temporal («Colibrí-42») que el servidor asigna, así que
nadie puede hacerse pasar por otra persona ni escribir con su nombre real por accidente.

No está cifrado de extremo a extremo: el servidor retransmite los mensajes. Se dice así en la pantalla.
Un servicio público junto a un observatorio de desinformación necesita límites claros:
mensajes cortos, velocidad limitada, pocas conexiones por dirección y por sala, sin enlaces activos.
"""

from __future__ import annotations

import asyncio
import random
import re
import time
import unicodedata
from collections import Counter, deque
from dataclasses import dataclass, field
from typing import Any, Optional

TTL_MENSAJE = 30 * 60  # segundos que vive un mensaje
HISTORIAL = 60  # mensajes que se entregan al entrar
MAX_TEXTO = 280
MAX_POR_SALA = 60
MAX_POR_IP = 4
RAFAGA = 5  # mensajes seguidos permitidos
RECARGA = 2.0  # segundos para recuperar un mensaje
SILENCIO = 15.0  # segundos de pausa tras abusar de la velocidad
REPETIDO = 20.0  # no se repite el mismo texto en este tiempo

PROVINCIAS = [
    "Azuay", "Bolívar", "Cañar", "Carchi", "Chimborazo", "Cotopaxi", "El Oro", "Esmeraldas", "Galápagos",
    "Guayas", "Imbabura", "Loja", "Los Ríos", "Manabí", "Morona Santiago", "Napo", "Orellana", "Pastaza",
    "Pichincha", "Santa Elena", "Santo Domingo de los Tsáchilas", "Sucumbíos", "Tungurahua", "Zamora Chinchipe",
]


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFD", texto)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", base).strip("-")


SALAS: dict[str, str] = {"general": "General", **{slug(p): p for p in PROVINCIAS}}

ANIMALES = [
    "Colibrí", "Cóndor", "Tucán", "Jaguar", "Delfín", "Tortuga", "Iguana", "Pingüino", "Tapir", "Llama",
    "Quetzal", "Oso", "Ocelote", "Capibara", "Manatí", "Búho", "Garza", "Mono", "Venado", "Pelícano",
]
PATRON_NOMBRE = re.compile(r"^(" + "|".join(ANIMALES) + r")-\d{2}$")
_CONTROL = re.compile(r"[​-‏‪-‮⁠-⁤﻿]")


def limpiar(texto: Any) -> str:
    """Texto plano, una sola línea, sin caracteres de control ni invisibles, máximo MAX_TEXTO."""
    if not isinstance(texto, str):
        return ""
    t = unicodedata.normalize("NFC", texto)
    t = _CONTROL.sub("", t)
    t = "".join(" " if unicodedata.category(c).startswith("C") else c for c in t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:MAX_TEXTO]


@dataclass(eq=False)
class Cliente:
    ws: Any
    nombre: str
    ip: str
    sala: str
    fichas: float = float(RAFAGA)
    ultima_ficha: float = field(default_factory=time.monotonic)
    mudo_hasta: float = 0.0
    avisos: int = 0
    ultimo_texto: str = ""
    ultimo_envio: float = 0.0


@dataclass
class Sala:
    clientes: set[Cliente] = field(default_factory=set)
    historial: deque = field(default_factory=lambda: deque(maxlen=HISTORIAL))


class Gestor:
    def __init__(self) -> None:
        self.salas: dict[str, Sala] = {k: Sala() for k in SALAS}
        self.por_ip: Counter[str] = Counter()
        self._contador = 0

    # ---- conexión ----
    def _nombre_libre(self, sala: Sala, pedido: Optional[str]) -> str:
        usados = {c.nombre for c in sala.clientes}
        if pedido and PATRON_NOMBRE.match(pedido) and pedido not in usados:
            return pedido  # quien se reconecta conserva su nombre si sigue libre
        for _ in range(200):
            n = f"{random.choice(ANIMALES)}-{random.randint(10, 99)}"
            if n not in usados:
                return n
        return f"Anon-{random.randint(100, 999)}"

    def puede_entrar(self, sala_id: str, ip: str) -> Optional[str]:
        """None si puede entrar; si no, el motivo en lenguaje claro."""
        if sala_id not in self.salas:
            return "Esa sala no existe."
        if len(self.salas[sala_id].clientes) >= MAX_POR_SALA:
            return "La sala está llena. Prueba en otra o más tarde."
        if self.por_ip[ip] >= MAX_POR_IP:
            return "Demasiadas ventanas abiertas desde tu conexión."
        return None

    async def conectar(self, ws: Any, sala_id: str, ip: str, nombre_pedido: Optional[str]) -> Cliente:
        sala = self.salas[sala_id]
        c = Cliente(ws=ws, nombre=self._nombre_libre(sala, nombre_pedido), ip=ip, sala=sala_id)
        sala.clientes.add(c)
        self.por_ip[ip] += 1
        self._purgar(sala)
        await self._enviar(c, {"t": "hola", "yo": c.nombre, "sala": sala_id, "nombre_sala": SALAS[sala_id], "n": len(sala.clientes), "ttl": TTL_MENSAJE // 60, "max": MAX_TEXTO, "hist": list(sala.historial)})
        await self._difundir(sala, {"t": "n", "n": len(sala.clientes)}, excepto=c)
        return c

    async def salir(self, c: Cliente) -> None:
        sala = self.salas.get(c.sala)
        if not sala or c not in sala.clientes:
            return
        sala.clientes.discard(c)
        self.por_ip[c.ip] -= 1
        if self.por_ip[c.ip] <= 0:
            del self.por_ip[c.ip]
        await self._difundir(sala, {"t": "n", "n": len(sala.clientes)})

    # ---- mensajes ----
    def _ficha(self, c: Cliente) -> bool:
        ahora = time.monotonic()
        c.fichas = min(float(RAFAGA), c.fichas + (ahora - c.ultima_ficha) / RECARGA)
        c.ultima_ficha = ahora
        if c.fichas >= 1:
            c.fichas -= 1
            return True
        return False

    async def mensaje(self, c: Cliente, bruto: Any) -> None:
        ahora = time.monotonic()
        if ahora < c.mudo_hasta:
            await self._enviar(c, {"t": "aviso", "x": f"Pausa de {int(c.mudo_hasta - ahora) + 1} s por escribir muy rápido."})
            return
        texto = limpiar(bruto)
        if not texto:
            return
        if not self._ficha(c):
            c.avisos += 1
            if c.avisos >= 3:
                c.mudo_hasta = ahora + SILENCIO
                c.avisos = 0
            await self._enviar(c, {"t": "aviso", "x": "Vas muy rápido. Espera unos segundos."})
            return
        if texto == c.ultimo_texto and ahora - c.ultimo_envio < REPETIDO:
            await self._enviar(c, {"t": "aviso", "x": "Ese mensaje ya lo enviaste hace un momento."})
            return
        c.ultimo_texto, c.ultimo_envio = texto, ahora
        sala = self.salas[c.sala]
        self._contador += 1
        msg = {"t": "msg", "id": self._contador, "n": c.nombre, "x": texto, "ts": int(time.time())}
        sala.historial.append(msg)
        await self._difundir(sala, msg)

    def _purgar(self, sala: Sala) -> None:
        limite = time.time() - TTL_MENSAJE
        while sala.historial and sala.historial[0]["ts"] < limite:
            sala.historial.popleft()

    def purgar_todo(self) -> None:
        for s in self.salas.values():
            self._purgar(s)

    # ---- envío ----
    async def _enviar(self, c: Cliente, datos: dict) -> bool:
        try:
            await c.ws.send_json(datos)
            return True
        except Exception:
            return False

    async def _difundir(self, sala: Sala, datos: dict, excepto: Optional[Cliente] = None) -> None:
        clientes = [c for c in sala.clientes if c is not excepto]
        if not clientes:
            return
        resultados = await asyncio.gather(*(self._enviar(c, datos) for c in clientes))
        for c, ok in zip(clientes, resultados):
            if not ok:
                sala.clientes.discard(c)
                self.por_ip[c.ip] = max(0, self.por_ip[c.ip] - 1)

    def conteos(self) -> list[dict]:
        return [{"id": k, "nombre": SALAS[k], "en_linea": len(s.clientes)} for k, s in self.salas.items()]


gestor = Gestor()
