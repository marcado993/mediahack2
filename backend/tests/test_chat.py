"""Pruebas del chat temporal. Se corren con:  python -m pytest backend/tests -q"""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import chat as chat_mod  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def limpio():
    chat_mod.gestor.__init__()  # salas y contadores vacíos para cada prueba
    yield


cliente = TestClient(app)


def abrir(sala="general", **extra):
    return cliente.websocket_connect(f"/ws/chat/{sala}", **extra)


def test_limpiar_quita_invisibles_y_recorta():
    assert chat_mod.limpiar("hola​  mundo\n\tx") == "hola mundo x"
    assert chat_mod.limpiar("a" * 1000) == "a" * chat_mod.MAX_TEXTO
    assert chat_mod.limpiar(123) == ""


def test_salas_incluyen_general_y_24_provincias():
    r = cliente.get("/api/chat/salas").json()["salas"]
    ids = [s["id"] for s in r]
    assert ids[0] == "general" and len(ids) == 25
    assert "bolivar" in ids and "santo-domingo-de-los-tsachilas" in ids


def test_entrar_da_nombre_temporal_y_reglas():
    with abrir() as ws:
        hola = ws.receive_json()
    assert hola["t"] == "hola" and chat_mod.PATRON_NOMBRE.match(hola["yo"])
    assert hola["max"] == 280 and hola["ttl"] == 30 and hola["hist"] == []


def test_sala_inexistente_es_rechazada_con_motivo():
    with abrir("no-existe") as ws:
        assert ws.receive_json()["t"] == "error"


def test_un_mensaje_llega_a_los_dos_y_queda_en_el_historial():
    with abrir("bolivar") as a:
        ya = a.receive_json()["yo"]
        with abrir("bolivar") as b:
            b.receive_json()
            assert a.receive_json() == {"t": "n", "n": 2}
            a.send_json({"t": "msg", "x": "  Hola   a todos  "})
            m1, m2 = a.receive_json(), b.receive_json()
            assert m1["x"] == m2["x"] == "Hola a todos" and m1["n"] == ya
        with abrir("bolivar") as c:
            hola = c.receive_json()
            assert [m["x"] for m in hola["hist"]] == ["Hola a todos"]


def test_las_salas_no_se_mezclan():
    with abrir("napo") as a, abrir("pastaza") as b:
        a.receive_json(), b.receive_json()
        a.send_json({"t": "msg", "x": "solo napo"})
        assert a.receive_json()["x"] == "solo napo"
        b.send_json({"t": "ping"})
        assert b.receive_json()["t"] == "pong"  # no recibió el mensaje de napo


def test_velocidad_limitada_y_repetidos():
    with abrir() as ws:
        ws.receive_json()
        ws.send_json({"t": "msg", "x": "uno"})
        assert ws.receive_json()["x"] == "uno"
        ws.send_json({"t": "msg", "x": "uno"})
        assert ws.receive_json()["t"] == "aviso"  # repetido
        recibidos = 1
        for i in range(10):
            ws.send_json({"t": "msg", "x": f"m{i}"})
            r = ws.receive_json()
            if r["t"] == "msg":
                recibidos += 1
        assert recibidos <= chat_mod.RAFAGA + 1  # la ráfaga se corta


def test_conserva_nombre_al_reconectar_si_esta_libre():
    with abrir() as ws:
        nombre = ws.receive_json()["yo"]
    with abrir("general?n=" + nombre) as ws:
        assert ws.receive_json()["yo"] == nombre


def test_no_acepta_nombre_inventado():
    with abrir("general?n=Presidente-01") as ws:
        assert ws.receive_json()["yo"] != "Presidente-01"


def test_origen_ajeno_es_rechazado():
    with pytest.raises(Exception):
        with cliente.websocket_connect("/ws/chat/general", headers={"origin": "https://sitio-malo.example"}) as ws:
            ws.receive_json()


def test_tope_por_direccion():
    abiertos = []
    try:
        for _ in range(chat_mod.MAX_POR_IP):
            c = abrir()
            ws = c.__enter__()
            ws.receive_json()
            abiertos.append((c, ws))
        with abrir() as extra:
            assert extra.receive_json()["t"] == "error"
    finally:
        for c, _ in abiertos:
            c.__exit__(None, None, None)


def test_los_mensajes_vencen():
    g = chat_mod.gestor
    sala = g.salas["general"]
    sala.historial.append({"t": "msg", "id": 1, "n": "Oso-10", "x": "viejo", "ts": 1})
    g._purgar(sala)
    assert len(sala.historial) == 0
