"""Pruebas del acceso por licencia. Se corren con:  python -m pytest backend/tests -q

El reloj es falso: cada prueba mueve `RELOJ[0]` para ver la licencia antes y después de vencer."""

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import licencias as lic_mod  # noqa: E402
from app.main import app  # noqa: E402

ECU = lic_mod.ECUADOR
RELOJ = [datetime(2026, 11, 12, 18, 0, tzinfo=ECU)]
ADMIN = {"X-Admin-Token": "token-de-prueba"}
cliente = TestClient(app)


@pytest.fixture(autouse=True)
def almacen(tmp_path, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "token-de-prueba")
    RELOJ[0] = datetime(2026, 11, 12, 18, 0, tzinfo=ECU)
    lic_mod.licencias.__init__(tmp_path / "licencias.json", ahora=lambda: RELOJ[0])
    yield tmp_path / "licencias.json"


def nueva(medio="Diario de prueba", vence="2026-11-20T23:59"):
    r = cliente.post("/api/admin/licencias", json={"medio": medio, "vence": vence}, headers=ADMIN)
    assert r.status_code == 201, r.text
    return r.json()


def entrar(clave):
    return cliente.post("/api/licencia/entrar", json={"clave": clave})


def con(ficha):
    return {"Authorization": f"Bearer {ficha}"}


# ---- la licencia provisional que estaba escrita en el sitio ----
def test_se_siembra_la_provisional_hasta_el_13_a_las_2359_de_ecuador(almacen):
    datos = json.loads(almacen.read_text(encoding="utf-8"))
    prov = datos["licencias"][0]
    assert prov["id"] == "provisional" and prov["activa"]
    assert datetime.fromisoformat(prov["vence"]) == datetime(2026, 11, 13, 23, 59, 59, tzinfo=ECU)
    # 23:59 en Ecuador son las 04:59 del 14 en UTC
    assert datetime.fromisoformat(prov["vence"]).astimezone(timezone.utc) == datetime(2026, 11, 14, 4, 59, 59, tzinfo=timezone.utc)


def test_provisional_vigente_un_minuto_antes_y_vencida_un_segundo_despues():
    lista = lambda: {l["id"]: l["estado"] for l in cliente.get("/api/admin/licencias", headers=ADMIN).json()["licencias"]}
    RELOJ[0] = datetime(2026, 11, 13, 23, 58, 59, tzinfo=ECU)
    assert lista()["provisional"] == "vigente"
    RELOJ[0] = datetime(2026, 11, 14, 0, 0, 0, tzinfo=ECU)
    assert lista()["provisional"] == "vencida"


def test_no_se_vuelve_a_sembrar_si_ya_hay_archivo(almacen):
    cliente.patch("/api/admin/licencias/provisional", json={"activa": False}, headers=ADMIN)
    lic_mod.licencias.__init__(almacen, ahora=lambda: RELOJ[0])  # reinicio del servidor
    assert lic_mod.licencias.listar()[0]["estado"] == "suspendida"


# ---- entrar y comprobar ----
def test_entrar_con_clave_valida_y_comprobar_en_cada_carga():
    l = nueva()
    r = entrar(l["clave"])
    assert r.status_code == 200 and r.json()["medio"] == "Diario de prueba"
    yo = cliente.get("/api/licencia", headers=con(r.json()["ficha"]))
    assert yo.status_code == 200 and "20 de noviembre de 2026 a las 23:59" in yo.json()["vence_texto"]


def test_la_clave_no_se_guarda_en_claro(almacen):
    l = nueva()
    ficha = entrar(l["clave"]).json()["ficha"]
    texto = almacen.read_text(encoding="utf-8")
    assert l["clave"] not in texto and ficha not in texto


def test_clave_incorrecta():
    nueva()
    r = entrar("OVADE-0000-0000-0000-0000")
    assert r.status_code == 401 and r.json()["motivo"] == "clave"


def test_licencia_vencida_no_entra_y_la_sesion_abierta_se_cierra():
    l = nueva(vence="2026-11-13T23:59")
    ficha = entrar(l["clave"]).json()["ficha"]
    RELOJ[0] = datetime(2026, 11, 14, 0, 1, tzinfo=ECU)
    r = entrar(l["clave"])
    assert r.status_code == 403 and r.json()["motivo"] == "vencida" and "13 de noviembre de 2026 a las 23:59" in r.json()["detail"]
    assert cliente.get("/api/licencia", headers=con(ficha)).json()["motivo"] == "vencida"


def test_la_sesion_no_dura_mas_que_la_licencia():
    l = nueva(vence="2026-11-13T23:59")
    r = entrar(l["clave"]).json()
    assert datetime.fromisoformat(r["vence"]) == datetime(2026, 11, 13, 23, 59, tzinfo=ECU)


def test_suspender_cierra_el_acceso_y_reactivar_lo_abre():
    l = nueva()
    ficha = entrar(l["clave"]).json()["ficha"]
    cliente.patch(f"/api/admin/licencias/{l['id']}", json={"activa": False}, headers=ADMIN)
    assert cliente.get("/api/licencia", headers=con(ficha)).json()["motivo"] == "suspendida"
    cliente.patch(f"/api/admin/licencias/{l['id']}", json={"activa": True}, headers=ADMIN)
    assert cliente.get("/api/licencia", headers=con(ficha)).status_code == 200


def test_acortar_la_licencia_acorta_las_sesiones():
    l = nueva(vence="2026-12-31T23:59")
    ficha = entrar(l["clave"]).json()["ficha"]
    cliente.patch(f"/api/admin/licencias/{l['id']}", json={"vence": "2026-11-13T12:00"}, headers=ADMIN)
    RELOJ[0] = datetime(2026, 11, 13, 12, 1, tzinfo=ECU)
    assert cliente.get("/api/licencia", headers=con(ficha)).status_code == 403


def test_renovar_una_vencida_la_deja_entrar_otra_vez():
    l = nueva(vence="2026-11-13T23:59")
    RELOJ[0] = datetime(2026, 11, 15, 9, 0, tzinfo=ECU)
    assert entrar(l["clave"]).status_code == 403
    cliente.patch(f"/api/admin/licencias/{l['id']}", json={"vence": "2026-12-31T23:59"}, headers=ADMIN)
    assert entrar(l["clave"]).status_code == 200


def test_salir_cierra_la_sesion():
    ficha = entrar(nueva()["clave"]).json()["ficha"]
    cliente.post("/api/licencia/salir", headers=con(ficha))
    assert cliente.get("/api/licencia", headers=con(ficha)).json()["motivo"] == "sesion"


def test_ficha_inventada_o_ausente():
    assert cliente.get("/api/licencia").json()["motivo"] == "sesion"
    assert cliente.get("/api/licencia", headers=con("inventada")).json()["motivo"] == "sesion"


# ---- panel ----
def test_el_panel_pide_el_token_de_administracion():
    assert cliente.get("/api/admin/licencias").status_code == 401
    assert cliente.post("/api/admin/licencias", json={"medio": "X medio", "vence": "2026-12-31T23:59"}).status_code == 401


def test_no_se_crea_con_fecha_pasada_o_mal_escrita():
    assert cliente.post("/api/admin/licencias", json={"medio": "Medio", "vence": "2026-11-01T10:00"}, headers=ADMIN).json()["motivo"] == "vence"
    assert cliente.post("/api/admin/licencias", json={"medio": "Medio", "vence": "mañana"}, headers=ADMIN).json()["motivo"] == "vence"


def test_demasiados_intentos_fallidos_se_frenan():
    nueva()
    codigos = [entrar(f"mala-{i}").status_code for i in range(12)]
    assert codigos[0] == 401 and codigos[-1] == 429
