"""Pruebas de las cuentas (seudónimo + contraseña). Se corren con:  python -m pytest backend/tests -q"""

import json
import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import cuentas as cuentas_mod  # noqa: E402
from app.main import app  # noqa: E402

CLAVE = "caballo grapa correcto bateria"
cliente = TestClient(app)


@pytest.fixture(autouse=True)
def almacen(tmp_path):
    cuentas_mod.cuentas.__init__(tmp_path / "cuentas.json")
    yield tmp_path / "cuentas.json"


def crear(seudonimo="Lucía R.", clave=CLAVE):
    return cliente.post("/api/cuenta/registro", json={"seudonimo": seudonimo, "clave": clave})


def con(ficha):
    return {"Authorization": f"Bearer {ficha}"}


def test_crear_cuenta_abre_sesion():
    r = crear()
    assert r.status_code == 201 and r.json()["seudonimo"] == "Lucía R."
    assert cliente.get("/api/cuenta", headers=con(r.json()["ficha"])).json() == {"seudonimo": "Lucía R."}


def test_el_archivo_no_guarda_contrasena_ni_ficha(almacen):
    ficha = crear().json()["ficha"]
    texto = almacen.read_text(encoding="utf-8")
    assert CLAVE not in texto and ficha not in texto
    assert set(json.loads(texto)["cuentas"]["lucia-r"]) == {"seudonimo", "sal", "hash", "creada"}


def test_seudonimo_repetido_aunque_cambien_tildes_o_mayusculas():
    crear()
    r = crear("LUCIA r")
    assert r.status_code == 409 and r.json()["campo"] == "seudonimo"


@pytest.mark.parametrize("seudonimo", ["ab", "x" * 21, "<b>hola</b>", "Admin", "  "])
def test_seudonimos_no_validos(seudonimo):
    r = crear(seudonimo)
    assert r.status_code == 400 and r.json()["campo"] == "seudonimo"


@pytest.mark.parametrize("clave", ["corta", "aaaaaaaaaaaa", "Lucía R."])
def test_contrasenas_debiles(clave):
    r = crear(clave=clave)
    assert r.status_code == 400 and r.json()["campo"] == "clave"


def test_entrar_con_y_sin_la_contrasena_correcta():
    crear()
    assert cliente.post("/api/cuenta/entrar", json={"seudonimo": "lucia r", "clave": CLAVE}).status_code == 200
    mal = cliente.post("/api/cuenta/entrar", json={"seudonimo": "Lucía R.", "clave": CLAVE + "x"})
    nadie = cliente.post("/api/cuenta/entrar", json={"seudonimo": "No existe", "clave": CLAVE})
    assert mal.status_code == nadie.status_code == 401
    assert mal.json()["detail"] == nadie.json()["detail"]  # no revela si la cuenta existe


def test_salir_invalida_la_sesion():
    ficha = crear().json()["ficha"]
    assert cliente.post("/api/cuenta/salir", headers=con(ficha)).status_code == 204
    assert cliente.get("/api/cuenta", headers=con(ficha)).status_code == 401


def test_borrar_pide_la_contrasena_y_libera_el_seudonimo():
    ficha = crear().json()["ficha"]
    assert cliente.post("/api/cuenta/borrar", json={"clave": "otra cosa distinta"}, headers=con(ficha)).status_code == 401
    assert cliente.post("/api/cuenta/borrar", json={"clave": CLAVE}, headers=con(ficha)).status_code == 204
    assert cliente.get("/api/cuenta", headers=con(ficha)).status_code == 401
    assert crear().status_code == 201


def test_demasiados_intentos_se_frenan():
    crear()
    codigos = [cliente.post("/api/cuenta/entrar", json={"seudonimo": "Lucía R.", "clave": "equivocada-siempre"}).status_code for _ in range(12)]
    assert codigos[0] == 401 and codigos[-1] == 429
