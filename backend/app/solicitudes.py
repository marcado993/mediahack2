"""
"Solicitar información al observatorio": requests from journalists and
organisations. The data stays open - the form exists for traceability and so a
person can review any figure before it is sent back (human sign-off), not to
gate access.

These rows hold personal data (name, email), so the store file is git-ignored
and never exposed by a public endpoint: only the admin API can read it.
Same single-JSON-file trade-off as tenants.py / media_store.py.
"""
from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

STORE_PATH = Path(__file__).parent / "data" / "solicitudes.json"
ESTADOS = ("nueva", "en_revision", "respondida")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(v: str) -> str:
    return re.sub(r"\s+", " ", v).strip()


class SolicitudIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    correo: str = Field(max_length=150)
    organizacion: str = Field(min_length=2, max_length=150)
    provincia: str = Field(default="", max_length=60)
    necesidad: str = Field(min_length=10, max_length=1200)
    uso: str = Field(min_length=5, max_length=800)
    medio: str = Field(default="", max_length=40)  # tenant slug the request came from
    web: str = Field(default="", max_length=200)  # honeypot: humans leave it empty

    @field_validator("nombre", "organizacion", "provincia", "medio")
    @classmethod
    def _one_line(cls, v: str) -> str:
        return _clean(v)

    @field_validator("necesidad", "uso")
    @classmethod
    def _text(cls, v: str) -> str:
        return v.strip()

    @field_validator("correo")
    @classmethod
    def _correo(cls, v: str) -> str:
        v = v.strip().lower()
        if not _EMAIL_RE.match(v):
            raise ValueError("Escribe un correo válido para poder responderte.")
        return v


class SolicitudUpdate(BaseModel):
    estado: Literal["nueva", "en_revision", "respondida"]
    revisado_por: str = Field(default="", max_length=100)
    nota: str = Field(default="", max_length=1000)


class _RateLimit:
    """At most `limit` submissions per `window` seconds per client. In memory:
    good enough to stop a form-spamming script on a single-process deploy."""

    def __init__(self, limit: int = 5, window: int = 3600):
        self.limit, self.window = limit, window
        self.hits: dict[str, list[float]] = {}
        self.lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            recent = [t for t in self.hits.get(key, []) if now - t < self.window]
            if len(recent) >= self.limit:
                self.hits[key] = recent
                return False
            recent.append(now)
            self.hits[key] = recent
            return True


rate_limit = _RateLimit()


class SolicitudStore:
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

    def add(self, s: SolicitudIn) -> dict:
        row = s.model_dump(exclude={"web"})
        row.update(
            id=uuid.uuid4().hex[:10],
            creada=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            estado="nueva",
            revisado_por="",
            nota="",
        )
        with self._lock:
            rows = self._read()
            rows.append(row)
            self._write(rows)
        return row

    def all(self) -> list[dict]:
        with self._lock:
            return list(reversed(self._read()))

    def update(self, id_: str, u: SolicitudUpdate) -> Optional[dict]:
        with self._lock:
            rows = self._read()
            for r in rows:
                if r["id"] == id_:
                    r.update(estado=u.estado, revisado_por=_clean(u.revisado_por), nota=u.nota.strip())
                    self._write(rows)
                    return r
        return None


store = SolicitudStore()
