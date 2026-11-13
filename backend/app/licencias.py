"""Licencias de acceso a OVADE: cada medio entra con una clave que vence.

Una licencia es { id, medio, hash de la clave, vence, activa }. La clave se muestra una sola vez, al
crearla; aquí solo se guarda su SHA-256 (las claves nuevas son aleatorias de 128 bits, así que un
hash rápido basta). Entrar con una clave abre una sesión: el navegador guarda una ficha aleatoria y
el servidor solo su SHA-256. Cada vez que el sitio carga, la ficha se vuelve a comprobar contra la
licencia, así que suspender o vencer una licencia cierra el acceso en la siguiente carga.

Una licencia «de un solo uso» (`unica`) se activa una vez: la primera entrada la ata a ese equipo
(su sesión dura hasta que vence la licencia) y cualquier otro intento se rechaza. El panel puede
liberarla, por ejemplo si la persona cambió de computador o borró los datos del navegador.

Todas las horas se guardan con zona horaria. «Hasta las 23:59 de un día» se entiende en hora de
Ecuador (UTC-5, sin horario de verano), que es como lo dice el equipo.

Un solo archivo JSON, como tenants.py; no se sube al repositorio.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Optional

STORE_PATH = Path(os.getenv("LICENCIAS_PATH") or Path(__file__).parent / "data" / "licencias.json")
ECUADOR = timezone(timedelta(hours=-5), "ECT")
SESION_MAX = timedelta(days=30)
INTENTOS = (10, 600)  # por dirección: cuántos intentos fallidos, en cuántos segundos

# La clave provisional que estaba escrita en el sitio (solo su SHA-256, el mismo que ya era público).
# Se siembra una vez, cuando todavía no existe el archivo de licencias.
PROVISIONAL = {
    "id": "provisional",
    "medio": "Acceso provisional del equipo",
    "hash": "00a16e1724d577adf9f1cafa65c5beb1d5404bde8a2cca5095865fa8101a6503",
    "vence": datetime(2026, 11, 13, 23, 59, 59, tzinfo=ECUADOR).isoformat(),
    "activa": True,
}


class ErrorLicencia(Exception):
    """Un problema que se le explica a la persona tal cual. `motivo` lo usa el sitio para decidir qué mostrar."""

    def __init__(self, mensaje: str, motivo: str, estado: int) -> None:
        super().__init__(mensaje)
        self.mensaje, self.motivo, self.estado = mensaje, motivo, estado


def _sha(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def _fecha(iso: str) -> datetime:
    d = datetime.fromisoformat(iso)
    return d if d.tzinfo else d.replace(tzinfo=ECUADOR)  # una fecha sin zona se lee en hora de Ecuador


def como_texto(iso: str) -> str:
    """«13 de noviembre de 2026 a las 23:59» en hora de Ecuador."""
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    d = _fecha(iso).astimezone(ECUADOR)
    return f"{d.day} de {meses[d.month - 1]} de {d.year} a las {d:%H:%M}"


class Licencias:
    def __init__(self, ruta: Path = STORE_PATH, ahora: Callable[[], datetime] = lambda: datetime.now(timezone.utc)) -> None:
        self.ruta = ruta
        self.ahora = ahora
        self._candado = threading.Lock()
        self._fallos: dict[str, deque] = defaultdict(deque)
        self._datos = self._leer()

    # ---- archivo ----
    def _leer(self) -> dict:
        try:
            datos = json.loads(self.ruta.read_text(encoding="utf-8"))
            if isinstance(datos.get("licencias"), list) and isinstance(datos.get("sesiones"), dict):
                return datos
        except (OSError, ValueError):
            pass
        datos = {"licencias": [dict(PROVISIONAL, creada=self.ahora().isoformat())], "sesiones": {}}
        self._datos = datos
        self._guardar()
        return datos

    def _guardar(self) -> None:
        ahora = self.ahora()
        self._datos["sesiones"] = {h: s for h, s in self._datos["sesiones"].items() if _fecha(s["vence"]) > ahora}
        self.ruta.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.ruta.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._datos, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.ruta)

    def _por_id(self, id_: str) -> Optional[dict]:
        return next((l for l in self._datos["licencias"] if l["id"] == id_), None)

    # ---- reglas ----
    def _vigente(self, lic: dict) -> None:
        """Lanza ErrorLicencia si la licencia no permite entrar ahora."""
        if not lic.get("activa"):
            raise ErrorLicencia(f"La licencia de {lic['medio']} está suspendida. Escribe al equipo de OVADE para reactivarla.", "suspendida", 403)
        if _fecha(lic["vence"]) <= self.ahora():
            raise ErrorLicencia(f"La licencia de {lic['medio']} venció el {como_texto(lic['vence'])}. Pide al equipo de OVADE que la renueve.", "vencida", 403)

    def _frenar(self, ip: str) -> None:
        maximo, ventana = INTENTOS
        cola = self._fallos[ip]
        ahora = time.monotonic()
        while cola and ahora - cola[0] > ventana:
            cola.popleft()
        if len(cola) >= maximo:
            minutos = max(1, int((ventana - (ahora - cola[0])) // 60) + 1)
            raise ErrorLicencia(f"Demasiados intentos desde tu conexión. Espera {minutos} min y vuelve a probar.", "intentos", 429)

    # ---- sitio ----
    def entrar(self, clave: str, ip: str) -> dict:
        self._frenar(ip)
        h = _sha((clave or "").strip())
        lic = next((l for l in self._datos["licencias"] if hmac.compare_digest(l["hash"], h)), None)
        if not lic:
            self._fallos[ip].append(time.monotonic())
            raise ErrorLicencia("Esa clave no es correcta. Revisa mayúsculas y guiones.", "clave", 401)
        self._vigente(lic)
        unica = bool(lic.get("unica"))
        if unica and lic.get("activada"):
            raise ErrorLicencia(
                "Esta clave ya se activó en otro equipo. Si es tuya y cambiaste de computador o borraste el navegador, pide al equipo de OVADE que la libere.",
                "en_uso",
                403,
            )
        ficha = secrets.token_urlsafe(32)
        # la sesión nunca dura más que la licencia; una de un solo uso dura toda la licencia (no hay segunda activación)
        vence = _fecha(lic["vence"]) if unica else min(_fecha(lic["vence"]), self.ahora() + SESION_MAX)
        with self._candado:
            if unica:
                lic["activada"] = self.ahora().isoformat()
            self._datos["sesiones"][_sha(ficha)] = {"licencia": lic["id"], "vence": vence.isoformat()}
            self._guardar()
        return {"ficha": ficha, **self._publica(lic, vence)}

    def comprobar(self, ficha: Optional[str]) -> dict:
        """La licencia de una sesión, si sigue valiendo. Se llama en cada carga del sitio."""
        s = self._datos["sesiones"].get(_sha(ficha)) if ficha and len(ficha) <= 200 else None
        lic = self._por_id(s["licencia"]) if s else None
        if not s or not lic:
            raise ErrorLicencia("Tu acceso se cerró. Escribe de nuevo la clave de licencia.", "sesion", 401)
        self._vigente(lic)
        if _fecha(s["vence"]) <= self.ahora():
            raise ErrorLicencia("Tu sesión terminó. Escribe de nuevo la clave de licencia.", "sesion", 401)
        return self._publica(lic, _fecha(s["vence"]))

    def salir(self, ficha: Optional[str]) -> None:
        if not ficha:
            return
        with self._candado:
            if self._datos["sesiones"].pop(_sha(ficha), None):
                self._guardar()

    def _publica(self, lic: dict, vence: datetime) -> dict:
        return {"medio": lic["medio"], "vence": vence.isoformat(), "vence_texto": como_texto(vence.isoformat())}

    # ---- panel ----
    def listar(self) -> list[dict]:
        ahora = self.ahora()
        uso = defaultdict(int)
        for s in self._datos["sesiones"].values():
            if _fecha(s["vence"]) > ahora:
                uso[s["licencia"]] += 1
        out = []
        for l in self._datos["licencias"]:
            estado = "suspendida" if not l.get("activa") else "vencida" if _fecha(l["vence"]) <= ahora else "vigente"
            out.append({
                "id": l["id"], "medio": l["medio"], "vence": l["vence"], "vence_texto": como_texto(l["vence"]),
                "activa": l.get("activa", False), "estado": estado, "sesiones": uso[l["id"]],
                "unica": bool(l.get("unica")), "activada": como_texto(l["activada"]) if l.get("activada") else None,
            })
        return out

    def crear(self, medio: str, vence: str, unica: bool = True) -> dict:
        medio = " ".join((medio or "").split())[:80]
        if len(medio) < 2:
            raise ErrorLicencia("Escribe el nombre del medio.", "medio", 400)
        fin = self._leer_vence(vence)
        clave = "OVADE-" + "-".join(secrets.token_hex(2).upper() for _ in range(4))
        lic = {"id": secrets.token_hex(6), "medio": medio, "hash": _sha(clave), "vence": fin.isoformat(), "activa": True, "unica": bool(unica), "creada": self.ahora().isoformat()}
        with self._candado:
            self._datos["licencias"].append(lic)
            self._guardar()
        return {**[x for x in self.listar() if x["id"] == lic["id"]][0], "clave": clave}

    def cambiar(self, id_: str, activa: Optional[bool] = None, vence: Optional[str] = None, unica: Optional[bool] = None, liberar: bool = False) -> dict:
        lic = self._por_id(id_)
        if not lic:
            raise ErrorLicencia("No existe esa licencia.", "id", 404)
        with self._candado:
            if activa is not None:
                lic["activa"] = bool(activa)
            if vence is not None:
                lic["vence"] = self._leer_vence(vence).isoformat()
            if liberar:
                # free it for a new device: the old session ends and the key can be activated once more
                lic.pop("activada", None)
                self._datos["sesiones"] = {h: s for h, s in self._datos["sesiones"].items() if s["licencia"] != id_}
            if unica is not None:
                lic["unica"] = bool(unica)
                if lic["unica"] and not lic.get("activada"):
                    # sessions already open when it becomes single use count as its activation
                    ahora = self.ahora()
                    if any(s["licencia"] == id_ and _fecha(s["vence"]) > ahora for s in self._datos["sesiones"].values()):
                        lic["activada"] = ahora.isoformat()
                elif not lic["unica"]:
                    lic.pop("activada", None)
            # sessions keep their own end date: a licence that gets shorter shortens them too
            fin = _fecha(lic["vence"])
            for s in self._datos["sesiones"].values():
                if s["licencia"] == id_ and _fecha(s["vence"]) > fin:
                    s["vence"] = fin.isoformat()
            self._guardar()
        return [x for x in self.listar() if x["id"] == id_][0]

    def _leer_vence(self, vence: str) -> datetime:
        try:
            fin = _fecha(vence)
        except (TypeError, ValueError):
            raise ErrorLicencia("La fecha de vencimiento no es válida. Usa el formato 2026-12-31T23:59.", "vence", 400)
        if fin <= self.ahora():
            raise ErrorLicencia("La fecha de vencimiento ya pasó.", "vence", 400)
        return fin


licencias = Licencias()
