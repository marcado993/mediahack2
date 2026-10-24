"""
Retroalimentación de los medios: how the observatory learns what each outlet
actually needs, which is what a white-label offer has to adapt to.

Two kinds of entries, both tagged with the outlet (tenant slug) they came from:
  - "uso":   a one-tap «¿Te sirvió?» right after a reporter copies a quote.
             Cheap, frequent, honest signal of value. No personal data.
  - "medio": a short form where an outlet says who they are, which modules
             they use, what is missing and how useful the tool is (1-5).
             Holds a name and an optional email, so - like solicitudes.json -
             the store is git-ignored and only the admin API can read it.

Same single-JSON-file trade-off as tenants.py / solicitudes.py.
"""
from __future__ import annotations

import json
import os
import re
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.solicitudes import _RateLimit

STORE_PATH = Path(__file__).parent / "data" / "retroalimentacion.json"
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

CONTEXTOS = ("cita_ficha", "frase_ficha", "datos_nota", "cita_mapa", "cita_resumen", "comparacion")
MOTIVOS = ("falto_dato", "dificil_entender", "no_sirve_nota", "error_dato", "otro")
ROLES = ("reportero", "editor", "verificador", "datos", "direccion", "otro")
MODULOS = ("nota", "mapa", "comparar", "escucha", "datos_abiertos", "solicitudes")


def _clean(v: str) -> str:
    return re.sub(r"\s+", " ", v).strip()


class RetroIn(BaseModel):
    tipo: Literal["uso", "medio"]
    medio: str = Field(default="", max_length=40)  # tenant slug the entry came from
    web: str = Field(default="", max_length=200)  # honeypot: humans leave it empty

    # tipo = "uso"
    util: Optional[bool] = None
    contexto: str = Field(default="", max_length=30)
    provincia: str = Field(default="", max_length=60)
    motivo: str = Field(default="", max_length=30)
    comentario: str = Field(default="", max_length=600)

    # tipo = "medio"
    nombre: str = Field(default="", max_length=100)
    correo: str = Field(default="", max_length=150)
    organizacion: str = Field(default="", max_length=150)
    rol: str = Field(default="", max_length=30)
    modulos: list[str] = Field(default_factory=list, max_length=len(MODULOS))
    necesidad: str = Field(default="", max_length=1500)
    valoracion: Optional[int] = Field(default=None, ge=1, le=5)

    @field_validator("medio", "provincia", "nombre", "organizacion")
    @classmethod
    def _one_line(cls, v: str) -> str:
        return _clean(v)

    @field_validator("comentario", "necesidad")
    @classmethod
    def _text(cls, v: str) -> str:
        return v.strip()

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        v = v.strip().lower()
        if v and not _EMAIL_RE.match(v):
            raise ValueError("Escribe un correo válido o deja el campo vacío.")
        return v

    @field_validator("modulos")
    @classmethod
    def _modulos(cls, v: list[str]) -> list[str]:
        unknown = sorted(set(v) - set(MODULOS))
        if unknown:
            raise ValueError(f"Módulos desconocidos: {', '.join(unknown)}.")
        return sorted(set(v), key=MODULOS.index)

    @model_validator(mode="after")
    def _por_tipo(self) -> "RetroIn":
        if self.tipo == "uso":
            if self.util is None:
                raise ValueError("Falta indicar si te sirvió.")
            if self.contexto not in CONTEXTOS:
                raise ValueError("Contexto no reconocido.")
            if self.motivo and self.motivo not in MOTIVOS:
                raise ValueError("Motivo no reconocido.")
        else:
            if len(self.nombre) < 2 or len(self.organizacion) < 2:
                raise ValueError("Escribe tu nombre y tu medio u organización.")
            if self.rol not in ROLES:
                raise ValueError("Elige tu rol en la redacción.")
            if len(self.necesidad) < 10:
                raise ValueError("Cuéntanos en al menos una frase qué necesita tu medio.")
            if self.valoracion is None:
                raise ValueError("Elige qué tan útil te resulta, del 1 al 5.")
        return self

    def fila(self) -> dict:
        """Only the fields that belong to this kind of entry are stored."""
        base = {"tipo": self.tipo, "medio": self.medio or "default"}
        if self.tipo == "uso":
            return {**base, "util": self.util, "contexto": self.contexto, "provincia": self.provincia,
                    "motivo": self.motivo, "comentario": self.comentario}
        return {**base, "nombre": self.nombre, "correo": self.correo, "organizacion": self.organizacion,
                "rol": self.rol, "modulos": self.modulos, "necesidad": self.necesidad, "valoracion": self.valoracion}


class RetroUpdate(BaseModel):
    revisada: bool
    nota: str = Field(default="", max_length=1000)


# A reporter may tap «¿Te sirvió?» many times in a session; the form is rarer.
rate_limit_uso = _RateLimit(limit=40, window=3600)
rate_limit_medio = _RateLimit(limit=5, window=3600)


class RetroStore:
    def __init__(self, path: Path = STORE_PATH):
        self._path = path
        self._lock = threading.Lock()
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._write([])

    def _read(self) -> list[dict]:
        with open(self._path, encoding="utf-8") as f:
            return json.load(f)

    def _write(self, rows: list[dict]) -> None:
        tmp = self._path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rows, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self._path)

    def add(self, r: RetroIn) -> dict:
        row = r.fila()
        row.update(id=uuid.uuid4().hex[:10], creada=datetime.now(timezone.utc).isoformat(timespec="seconds"), revisada=False, nota="")
        with self._lock:
            rows = self._read()
            rows.append(row)
            self._write(rows)
        return row

    def all(self, medio: str = "") -> list[dict]:
        with self._lock:
            rows = self._read()
        return [r for r in reversed(rows) if not medio or r.get("medio") == medio]

    def update(self, id_: str, u: RetroUpdate) -> Optional[dict]:
        with self._lock:
            rows = self._read()
            for r in rows:
                if r["id"] == id_:
                    r.update(revisada=u.revisada, nota=u.nota.strip())
                    self._write(rows)
                    return r
        return None


def resumen(rows: list[dict]) -> dict:
    """Per-outlet numbers the admin needs to decide what to build next."""
    por_medio: dict[str, dict] = {}
    for r in rows:
        m = por_medio.setdefault(r.get("medio") or "default", {"usos": 0, "utiles": 0, "formularios": 0, "valoraciones": [], "motivos": {}})
        if r["tipo"] == "uso":
            m["usos"] += 1
            m["utiles"] += 1 if r.get("util") else 0
            if r.get("motivo"):
                m["motivos"][r["motivo"]] = m["motivos"].get(r["motivo"], 0) + 1
        else:
            m["formularios"] += 1
            if r.get("valoracion"):
                m["valoraciones"].append(r["valoracion"])
    out = {}
    for medio, m in por_medio.items():
        vals = m.pop("valoraciones")
        out[medio] = {
            **m,
            "pct_util": round(100 * m["utiles"] / m["usos"]) if m["usos"] else None,
            "valoracion_media": round(sum(vals) / len(vals), 1) if vals else None,
        }
    return out


store = RetroStore()
