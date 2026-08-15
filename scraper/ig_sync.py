"""
Instagram sync que corre EN TU MÁQUINA, no en el servidor.

Por qué existe: Instagram bloquea los rangos de IP de datacenter. Desde el
servidor (Oracle Cloud) el login devuelve 429 antes siquiera de intentar
autenticarse - no es un problema de contraseña, es la IP. Desde tu conexión
de casa sí es una IP residencial normal, así que el login funciona ahí.

Entonces la división es:
  - Este script (tu casa)  -> hace login, baja las publicaciones, escribe el
                              caché y lo sube al servidor por scp.
  - El backend (servidor)  -> nunca hace login. Solo lee ese caché y lo
                              sirve. Si el caché no existe, simplemente no
                              hay resultados de Instagram; nada se rompe.

Sobre el código de verificación: Instagram va a pedirte uno (SMS/email/app)
la primera vez, y posiblemente cuando cambie algo. Ese código lo escribes TÚ
en esta terminal cuando el script lo pida - por eso el script es interactivo
y no una tarea automática. Después de eso la sesión queda guardada en
ig_session.json y las siguientes corridas no vuelven a pedir código, así que
esto es molesto una vez, no siempre.

Uso:
    cd scraper
    python ig_sync.py            # login + scrape + escribe caché local
    python ig_sync.py --upload   # además lo sube al servidor

Credenciales: IG_USERNAME / IG_PASSWORD en scraper/.env (ver .env.example).
"""
from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

HERE = Path(__file__).parent
BACKEND = HERE.parent / "backend"

# Importamos la config del backend en vez de duplicarla: si mañana cambian
# las cuentas o el formato del caché, este script no se queda desfasado.
sys.path.insert(0, str(BACKEND))
from app.instagram_search import ACCOUNTS, CACHE_PATH, POSTS_PER_ACCOUNT  # noqa: E402

load_dotenv(HERE / ".env")
load_dotenv(BACKEND / ".env")  # fallback: si ya las pusiste ahí

import os  # noqa: E402

SESSION_PATH = HERE / "ig_session.json"
LOCAL_CACHE = HERE / "instagram_cache.json"

# Mismo criterio anti-baneo que el backend: pausas largas entre cuentas y
# abortar (no reintentar) si Instagram se queja.
ACCOUNT_PAUSE_RANGE = (12, 30)
DELAY_RANGE = [3, 7]

REMOTE = "opc@149.130.170.232"
REMOTE_PATH = "~/mediahack/backend/app/data/instagram_cache.json"


def build_client():
    from instagrapi import Client

    username = os.environ.get("IG_USERNAME")
    password = os.environ.get("IG_PASSWORD")
    if not username or not password:
        raise SystemExit("Falta IG_USERNAME / IG_PASSWORD en scraper/.env")

    client = Client()
    client.delay_range = DELAY_RANGE

    if SESSION_PATH.exists():
        client.load_settings(SESSION_PATH)
        print(f"Sesión previa cargada de {SESSION_PATH.name}")

    print(f"Iniciando sesión como @{username}…")
    print("Si Instagram pide un código de verificación, escríbelo aquí abajo cuando lo pregunte.")
    client.login(username, password)
    client.dump_settings(SESSION_PATH)
    print("Login OK. Sesión guardada — la próxima vez no debería pedir código.")
    return client


def scrape(client) -> list[dict]:
    from instagrapi.exceptions import ChallengeRequired, FeedbackRequired, PleaseWaitFewMinutes

    posts: list[dict] = []
    for i, account in enumerate(ACCOUNTS):
        print(f"  @{account}…", end=" ", flush=True)
        try:
            user_id = client.user_id_from_username(account)
            medias = client.user_medias(user_id, amount=POSTS_PER_ACCOUNT)
        except (ChallengeRequired, PleaseWaitFewMinutes, FeedbackRequired) as e:
            print(f"\n  Instagram pidió pausa ({type(e).__name__}). Paro aquí en vez de reintentar.")
            print("  Espera unas horas antes de volver a correr esto.")
            break
        except Exception as e:
            print(f"error ({type(e).__name__}), sigo con la siguiente")
            continue

        found = 0
        for m in medias:
            caption = (m.caption_text or "").strip()
            if not caption:
                continue
            posts.append(
                {
                    "source": f"Instagram · @{account}",
                    "title": caption[:280],
                    "link": f"https://www.instagram.com/p/{m.code}/",
                    "published": m.taken_at.isoformat() if m.taken_at else None,
                }
            )
            found += 1
        print(f"{found} publicaciones")

        if i < len(ACCOUNTS) - 1:
            pause = random.uniform(*ACCOUNT_PAUSE_RANGE)
            print(f"  (pausa {pause:.0f}s)")
            time.sleep(pause)

    return posts


def write_cache(posts: list[dict]) -> Path:
    payload = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "cooldown_until": None,
        "posts": posts,
    }
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    LOCAL_CACHE.write_text(text, encoding="utf-8")
    # También lo dejamos donde el backend local lo lee, para poder probar
    # sin subir nada.
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(text, encoding="utf-8")
    return LOCAL_CACHE


def upload(path: Path) -> None:
    print(f"Subiendo a {REMOTE}:{REMOTE_PATH}…")
    result = subprocess.run(["scp", str(path), f"{REMOTE}:{REMOTE_PATH}"], capture_output=True, text=True)
    if result.returncode != 0:
        print("Falló el scp:", result.stderr.strip())
        raise SystemExit(1)
    print("Subido. El backend ya sirve estas publicaciones.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--upload", action="store_true", help="subir el caché al servidor por scp")
    args = parser.parse_args()

    client = build_client()
    print(f"Bajando publicaciones de {len(ACCOUNTS)} cuentas…")
    posts = scrape(client)

    if not posts:
        raise SystemExit("No se bajó ninguna publicación. No sobrescribo el caché existente.")

    path = write_cache(posts)
    print(f"\n{len(posts)} publicaciones escritas en {path}")

    if args.upload:
        upload(path)
    else:
        print("Corre con --upload para subirlo al servidor.")


if __name__ == "__main__":
    main()
