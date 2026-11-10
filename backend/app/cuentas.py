"""Cuentas de OVADE: un seudónimo y una contraseña. Sirven para entrar al chat y a la bóveda.

No se pide correo, nombre real ni medio: quien cubre temas sensibles no debería dejar más rastro del
necesario. La consecuencia se dice en pantalla: sin correo no hay forma de recuperar la contraseña.

Lo que se guarda (un solo archivo JSON, igual que tenants.py; no se sube al repositorio):
  - el seudónimo tal como se escribió y su forma normalizada (para que «Lucía» y «lucia» sean la misma);
  - la contraseña pasada por scrypt con una sal propia de cada cuenta, nunca el texto;
  - de cada sesión, solo el SHA-256 de su ficha y cuándo vence. Con el archivo no se puede abrir una sesión.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import secrets
import threading
import time
import unicodedata
from collections import defaultdict, deque
from pathlib import Path
from typing import Optional

STORE_PATH = Path(os.getenv("CUENTAS_PATH") or Path(__file__).parent / "data" / "cuentas.json")
SESION_DIAS = 30
MIN_CLAVE = 10
MAX_CLAVE = 200
_SCRYPT = {"n": 2**15, "r": 8, "p": 1, "maxmem": 128 * 1024 * 1024, "dklen": 32}
_SEUDONIMO_RE = re.compile(r"^[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ](?:[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ _.\-]{1,18})[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ.]$")
_RESERVADOS = {"ovade", "admin", "administrador", "moderador", "moderacion", "sistema", "observatorio", "soporte", "anon", "anonimo"}

# Intentos por dirección: (cuántos, en cuántos segundos)
LIMITES = {"entrar": (10, 600), "registro": (5, 3600)}


class ErrorCuenta(Exception):
    """Un problema que se le explica a la persona tal cual. `campo` dice qué casilla corregir."""

    def __init__(self, mensaje: str, campo: str = "", estado: int = 400) -> None:
        super().__init__(mensaje)
        self.mensaje, self.campo, self.estado = mensaje, campo, estado


def normalizar(seudonimo: str) -> str:
    base = unicodedata.normalize("NFKD", seudonimo)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[ _.\-]+", "-", base).strip("-")


def _hash(clave: str, sal: bytes) -> str:
    return hashlib.scrypt(clave.encode("utf-8"), salt=sal, **_SCRYPT).hex()


def _huella(ficha: str) -> str:
    return hashlib.sha256(ficha.encode("utf-8")).hexdigest()


class Cuentas:
    def __init__(self, ruta: Path = STORE_PATH) -> None:
        self.ruta = ruta
        self._candado = threading.Lock()
        self._intentos: dict[tuple[str, str], deque] = defaultdict(deque)
        self._datos = self._leer()

    # ---- archivo ----
    def _leer(self) -> dict:
        try:
            datos = json.loads(self.ruta.read_text(encoding="utf-8"))
            if isinstance(datos.get("cuentas"), dict) and isinstance(datos.get("sesiones"), dict):
                return datos
        except (OSError, ValueError):
            pass
        return {"cuentas": {}, "sesiones": {}}

    def _guardar(self) -> None:
        ahora = time.time()
        self._datos["sesiones"] = {h: s for h, s in self._datos["sesiones"].items() if s["vence"] > ahora}
        self.ruta.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.ruta.with_suffix(".tmp")
        tmp.write_text(json.dumps(self._datos, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.ruta)

    # ---- límite de intentos ----
    def frenar(self, accion: str, ip: str) -> None:
        maximo, ventana = LIMITES[accion]
        ahora = time.monotonic()
        cola = self._intentos[(accion, ip)]
        while cola and ahora - cola[0] > ventana:
            cola.popleft()
        if len(cola) >= maximo:
            minutos = max(1, int((ventana - (ahora - cola[0])) // 60) + 1)
            raise ErrorCuenta(f"Demasiados intentos desde tu conexión. Espera {minutos} min y vuelve a probar.", estado=429)
        cola.append(ahora)

    # ---- validación ----
    @staticmethod
    def _revisar_seudonimo(seudonimo: str) -> str:
        s = re.sub(r"\s+", " ", unicodedata.normalize("NFC", seudonimo or "")).strip()
        if not _SEUDONIMO_RE.match(s):
            raise ErrorCuenta("El seudónimo debe tener de 3 a 20 caracteres: letras, números, espacios, guiones o puntos.", "seudonimo")
        if normalizar(s) in _RESERVADOS:
            raise ErrorCuenta("Ese seudónimo está reservado. Elige otro.", "seudonimo")
        return s

    @staticmethod
    def _revisar_clave(clave: str, seudonimo: str) -> None:
        if not isinstance(clave, str) or len(clave) < MIN_CLAVE:
            raise ErrorCuenta(f"La contraseña debe tener al menos {MIN_CLAVE} caracteres. Una frase de varias palabras funciona bien.", "clave")
        if len(clave) > MAX_CLAVE:
            raise ErrorCuenta(f"La contraseña no puede pasar de {MAX_CLAVE} caracteres.", "clave")
        if normalizar(clave) == normalizar(seudonimo) or len(set(clave)) < 4:
            raise ErrorCuenta("Esa contraseña es muy fácil de adivinar. Usa una frase de varias palabras.", "clave")

    # ---- operaciones ----
    def _abrir_sesion(self, clave_cuenta: str) -> str:
        ficha = secrets.token_urlsafe(32)
        self._datos["sesiones"][_huella(ficha)] = {"cuenta": clave_cuenta, "vence": time.time() + SESION_DIAS * 86400}
        return ficha

    def registrar(self, seudonimo: str, clave: str) -> dict:
        s = self._revisar_seudonimo(seudonimo)
        self._revisar_clave(clave, s)
        k = normalizar(s)
        sal = secrets.token_bytes(16)
        resumen = _hash(clave, sal)  # fuera del candado: tarda a propósito
        with self._candado:
            if k in self._datos["cuentas"]:
                raise ErrorCuenta("Ese seudónimo ya está en uso. Prueba con otro o, si es tuyo, entra con tu contraseña.", "seudonimo", 409)
            self._datos["cuentas"][k] = {"seudonimo": s, "sal": sal.hex(), "hash": resumen, "creada": int(time.time())}
            ficha = self._abrir_sesion(k)
            self._guardar()
        return {"ficha": ficha, "seudonimo": s, "dias": SESION_DIAS}

    def _comprobar(self, seudonimo: str, clave: str) -> Optional[str]:
        """Devuelve la clave de la cuenta si la contraseña es correcta. Tarda lo mismo exista o no la cuenta."""
        k = normalizar(seudonimo or "")
        c = self._datos["cuentas"].get(k)
        sal = bytes.fromhex(c["sal"]) if c else b"\0" * 16
        resumen = _hash(clave if isinstance(clave, str) else "", sal)
        if c and hmac.compare_digest(resumen, c["hash"]):
            return k
        return None

    def entrar(self, seudonimo: str, clave: str) -> dict:
        k = self._comprobar(seudonimo, clave)
        if not k:
            raise ErrorCuenta("El seudónimo o la contraseña no coinciden. Revisa mayúsculas y vuelve a intentar.", estado=401)
        with self._candado:
            ficha = self._abrir_sesion(k)
            self._guardar()
        return {"ficha": ficha, "seudonimo": self._datos["cuentas"][k]["seudonimo"], "dias": SESION_DIAS}

    def quien(self, ficha: Optional[str]) -> Optional[str]:
        """El seudónimo dueño de la ficha, o None si no existe o venció."""
        if not ficha or not isinstance(ficha, str) or len(ficha) > 200:
            return None
        s = self._datos["sesiones"].get(_huella(ficha))
        if not s or s["vence"] <= time.time():
            return None
        c = self._datos["cuentas"].get(s["cuenta"])
        return c["seudonimo"] if c else None

    def salir(self, ficha: Optional[str]) -> None:
        if not ficha:
            return
        with self._candado:
            if self._datos["sesiones"].pop(_huella(ficha), None):
                self._guardar()

    def borrar(self, ficha: Optional[str], clave: str) -> None:
        seudonimo = self.quien(ficha)
        if not seudonimo:
            raise ErrorCuenta("Tu sesión venció. Entra de nuevo.", estado=401)
        k = self._comprobar(seudonimo, clave)
        if not k:
            raise ErrorCuenta("La contraseña no es correcta. La cuenta no se borró.", "clave", 401)
        with self._candado:
            self._datos["cuentas"].pop(k, None)
            self._datos["sesiones"] = {h: s for h, s in self._datos["sesiones"].items() if s["cuenta"] != k}
            self._guardar()


cuentas = Cuentas()
