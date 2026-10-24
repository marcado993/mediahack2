"""
White-label tenants: one record per news outlet ("medio") that embeds the
observatory under its own brand, plus the feature-flag registry that decides
which parts of the platform that outlet sees.

What a tenant may change is deliberately limited to the *chrome* - name, logo,
institutional colour, tagline, footer, headline typeface, which views/tools are
on. It can never touch the data colour ramp, the methodology or the data
attribution: a map colour is data, not branding, and the limits of the index
have to stay visible whoever is publishing it. Those pieces are `locked` in the
registry below and are forced on when a config is resolved.

Backed by a single JSON file (same trade-off as media_store.py): fine for a
handful of outlets, swap for a real database beyond that.
"""
from __future__ import annotations

import json
import os
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

STORE_PATH = Path(__file__).parent / "data" / "tenants.json"
DEFAULT_SLUG = "default"
DEFAULT_TITULO = "Observatorio de Vulnerabilidad ante la Desinformación Electoral"
DEFAULT_LEMA = "IVEI 2024 · 24 provincias + Galápagos · Censo 2022, ENEMDU 2024 y Latinobarómetro 2024"
DEFAULT_COLOR = "#1b3a5c"

# Single source of truth for the flags: the admin panel renders its form from
# this list, and the public config is resolved against it, so adding a flag
# here is the only backend change a new toggle needs.
FLAGS: list[dict] = [
    {"key": "vista_mapas", "grupo": "Vistas", "nombre": "Mapa del país", "default": True, "locked": True,
     "detalle": "Entrada principal: capas, ranking y mapa de Ecuador."},
    {"key": "vista_perfil", "grupo": "Vistas", "nombre": "Preparar mi nota", "default": True, "locked": True,
     "detalle": "Pantalla de inicio: elegir una provincia y llevarse un párrafo listo, datos citables y qué se puede afirmar."},
    {"key": "vista_comparar", "grupo": "Vistas", "nombre": "Comparar", "default": True, "locked": False,
     "detalle": "Dos provincias frente a frente, indicador por indicador."},
    {"key": "vista_datos", "grupo": "Vistas", "nombre": "Datos", "default": True, "locked": False,
     "detalle": "Tabla ordenable con todos los indicadores."},
    {"key": "vista_fuentes", "grupo": "Vistas", "nombre": "Fuentes", "default": True, "locked": False,
     "detalle": "De dónde sale cada número y qué no se puede medir."},
    {"key": "vista_conversacion", "grupo": "Vistas", "nombre": "Conversación pública", "default": True, "locked": False,
     "detalle": "Temas y actores más mencionados por provincia en X y medios. Apágala si tu redacción no quiere mostrar datos de redes."},
    {"key": "vista_metodologia", "grupo": "Vistas", "nombre": "Metodología", "default": True, "locked": True,
     "detalle": "Cómo se calcula el índice y sus límites. Siempre visible."},

    {"key": "capa_mecanismos", "grupo": "Capas del mapa", "nombre": "Exclusión e hiperexposición digital", "default": True, "locked": False,
     "detalle": "Las dos capas que separan los mecanismos de vulnerabilidad digital."},
    {"key": "capa_habilidades", "grupo": "Capas del mapa", "nombre": "Habilidades digitales", "default": True, "locked": False,
     "detalle": "Capa del MINTEL 2023. Tiene cobertura baja: siete provincias sin respuestas."},
    {"key": "grafico_dispersion", "grupo": "Capas del mapa", "nombre": "Gráfico exclusión vs. hiperexposición", "default": True, "locked": False,
     "detalle": "Dispersión bajo el mapa que compara los dos mecanismos."},

    {"key": "inicio_guiado", "grupo": "Herramientas para reportear", "nombre": "Comparar y criterio en el inicio", "default": True, "locked": False,
     "detalle": "Panel de inicio con la comparación rápida y la tabla de criterio editorial."},
    {"key": "buscador_provincia", "grupo": "Herramientas para reportear", "nombre": "Buscador rápido «¿Qué provincia cubres?»", "default": True, "locked": False,
     "detalle": "Campo en el encabezado para saltar directo a una provincia."},
    {"key": "guia_reportero", "grupo": "Herramientas para reportear", "nombre": "Guía «Para reportear»", "default": True, "locked": False,
     "detalle": "Recomendaciones de la provincia y qué se puede y qué no se puede afirmar con el índice."},
    {"key": "cita_lista", "grupo": "Herramientas para reportear", "nombre": "Copiar cita lista para pegar", "default": True, "locked": False,
     "detalle": "Un clic copia un párrafo con la cifra, la fuente y las advertencias."},
    {"key": "solicitar_informacion", "grupo": "Herramientas para reportear", "nombre": "Botón «Solicitar información»", "default": True, "locked": False,
     "detalle": "Formulario para pedir datos al observatorio. Cada solicitud la revisa una persona antes de enviar cifras."},
    {"key": "ficha_descargable", "grupo": "Herramientas para reportear", "nombre": "Descargar ficha de la provincia", "default": True, "locked": False,
     "detalle": "Documento autocontenido con todas las cifras y sus puestos."},
    {"key": "retroalimentacion", "grupo": "Herramientas para reportear", "nombre": "Retroalimentación del medio", "default": True, "locked": False,
     "detalle": "Pregunta «¿Te sirvió?» al copiar una cita y formulario para que la redacción cuente qué necesita. Llega al panel, separado por medio."},
]
FLAG_KEYS = {f["key"] for f in FLAGS}
FLAG_DEFAULTS = {f["key"]: f["default"] for f in FLAGS}
LOCKED = {f["key"] for f in FLAGS if f["locked"]}

_SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$")
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_HOST_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,}$")
_LOGO_DATA_RE = re.compile(r"^data:image/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$")
MAX_LOGO_CHARS = 300_000


def _contrast_with_white(hex_color: str) -> float:
    n = int(hex_color[1:], 16)
    chans = [((n >> 16) & 255), ((n >> 8) & 255), (n & 255)]
    lin = [(c / 255 / 12.92) if c / 255 <= 0.03928 else (((c / 255) + 0.055) / 1.055) ** 2.4 for c in chans]
    lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
    return 1.05 / (lum + 0.05)


def valid_slug(slug: str) -> bool:
    return bool(_SLUG_RE.match(slug))


class TenantIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    titulo: str = Field(default=DEFAULT_TITULO, min_length=1, max_length=120)
    lema: str = Field(default="", max_length=200)
    color: str = DEFAULT_COLOR
    logo: str = ""
    logo_placa: bool = False
    fuente_titulos: Literal["serif", "sans"] = "sans"
    sitio_url: str = ""
    pie: str = Field(default="", max_length=240)
    dominios: list[str] = Field(default_factory=list, max_length=10)
    publicado: bool = True
    flags: dict[str, bool] = Field(default_factory=dict)

    @field_validator("nombre", "titulo", "lema", "pie")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("color")
    @classmethod
    def _color(cls, v: str) -> str:
        if not _COLOR_RE.match(v):
            raise ValueError("El color debe ser hexadecimal de 6 dígitos, por ejemplo #1b3a5c.")
        # The brand colour is also used as text (links, secondary buttons) on a
        # white page, so a pale colour would make the site unreadable.
        if _contrast_with_white(v) < 4.5:
            raise ValueError("Ese color es demasiado claro: los enlaces y botones sobre fondo blanco no se leerían. Elige uno más oscuro.")
        return v.lower()

    @field_validator("logo")
    @classmethod
    def _logo(cls, v: str) -> str:
        v = v.strip()
        if not v:
            return ""
        if len(v) > MAX_LOGO_CHARS:
            raise ValueError("El logo pesa demasiado: máximo unos 200 KB.")
        if v.startswith("https://") or _LOGO_DATA_RE.match(v):
            return v
        raise ValueError("El logo debe ser un enlace https:// o una imagen PNG, JPG, WebP o SVG subida desde el panel.")

    @field_validator("sitio_url")
    @classmethod
    def _sitio(cls, v: str) -> str:
        v = v.strip()
        if v and not v.startswith(("https://", "http://")):
            raise ValueError("El sitio debe empezar con https://")
        return v

    @field_validator("dominios")
    @classmethod
    def _dominios(cls, v: list[str]) -> list[str]:
        out = []
        for d in v:
            d = d.strip().lower()
            if not d:
                continue
            if not _HOST_RE.match(d):
                raise ValueError(f"«{d}» no es un dominio válido (ejemplo: mapa.milmedio.ec).")
            if d not in out:
                out.append(d)
        return out

    @field_validator("flags")
    @classmethod
    def _flags(cls, v: dict[str, bool]) -> dict[str, bool]:
        unknown = sorted(set(v) - FLAG_KEYS)
        if unknown:
            raise ValueError(f"Funciones desconocidas: {', '.join(unknown)}")
        return v


def resolve_flags(overrides: dict[str, bool]) -> dict[str, bool]:
    return {k: True if k in LOCKED else bool(overrides.get(k, FLAG_DEFAULTS[k])) for k in FLAG_KEYS}


def public_config(slug: str, rec: dict) -> dict:
    """What the browser of that outlet's audience is allowed to see."""
    return {
        "slug": slug,
        "nombre": rec["nombre"],
        "titulo": rec["titulo"],
        "lema": rec["lema"] or DEFAULT_LEMA,
        "color": rec["color"],
        "logo": rec["logo"],
        "logo_placa": rec["logo_placa"],
        "fuente_titulos": rec["fuente_titulos"],
        "sitio_url": rec["sitio_url"],
        "pie": rec["pie"],
        "flags": resolve_flags(rec.get("flags", {})),
    }


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class TenantStore:
    def __init__(self, path: Path = STORE_PATH):
        self._path = path
        self._lock = threading.Lock()
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            seed = TenantIn(nombre="Observatorio").model_dump()
            now = _now()
            self._write({DEFAULT_SLUG: {**seed, "creado": now, "actualizado": now}})

    def _read(self) -> dict:
        with open(self._path, encoding="utf-8") as f:
            return json.load(f)

    def _write(self, data: dict) -> None:
        tmp = self._path.with_suffix(".tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp, self._path)

    def all(self) -> dict:
        with self._lock:
            return self._read()

    def get(self, slug: str) -> Optional[dict]:
        return self.all().get(slug)

    def save(self, slug: str, tenant: TenantIn) -> dict:
        with self._lock:
            data = self._read()
            now = _now()
            rec = tenant.model_dump()
            if slug == DEFAULT_SLUG:
                rec["publicado"] = True  # the fallback must always exist and be live
            rec["creado"] = data.get(slug, {}).get("creado", now)
            rec["actualizado"] = now
            data[slug] = rec
            self._write(data)
            return rec

    def delete(self, slug: str) -> bool:
        with self._lock:
            data = self._read()
            if slug == DEFAULT_SLUG or slug not in data:
                return False
            del data[slug]
            self._write(data)
            return True

    def resolve(self, slug: Optional[str], host: Optional[str]) -> dict:
        data = self.all()
        rec = data.get(slug) if slug else None
        if rec and rec.get("publicado"):
            return public_config(slug, rec)
        host = (host or "").split(":")[0].strip().lower()
        if host:
            for s, r in data.items():
                if r.get("publicado") and host in r.get("dominios", []):
                    return public_config(s, r)
        return public_config(DEFAULT_SLUG, data[DEFAULT_SLUG])


store = TenantStore()
