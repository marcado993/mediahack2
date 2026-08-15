"""
Instagram posts from Ecuadorian news / fact-checking accounts, via instagrapi.

HOW THIS ACTUALLY RUNS IN PRODUCTION: the server does NOT log in at all.
Instagram blocks datacenter IP ranges - from Oracle Cloud the login endpoint
returns 429 before authentication is even attempted, so no credentials are
set in the server's .env and _maybe_refresh() below short-circuits. The
cache is produced on a residential connection by scraper/ig_sync.py and
copied up; the server only ever reads it. No cache -> no Instagram results,
which is a degradation, not a failure.

The refresh machinery below still matters wherever credentials ARE present
(a laptop, or the server behind a residential proxy), and the reason it's
cache-backed rather than per-request is the same one that motivates all of
this: Instagram bans accounts that authenticate repeatedly, and an API
endpoint that logs in on every call would do exactly that within minutes of
going live. So:

  - Posts are scraped at most once per CACHE_TTL (default 45 min) and
    written to a JSON cache. A request arriving while the cache is warm
    never touches Instagram at all - it reads the file.
  - The session is persisted to disk, so a refresh reuses the existing
    login instead of re-authenticating.
  - instagrapi's own delay_range sleeps 3-7s between its internal requests,
    plus a longer random pause between accounts, so a refresh doesn't read
    as a burst.
  - ChallengeRequired / PleaseWaitFewMinutes / FeedbackRequired abort the
    whole refresh immediately and mark a cooldown - retrying into a
    challenge is how an account goes from rate-limited to permanently
    banned. After a pushback we stop hitting Instagram for COOLDOWN hours
    and keep serving whatever the cache still holds.

Missing credentials, an expired session or a cold cache all degrade to
"no Instagram results", never to a crash or a hang.
"""
from __future__ import annotations

import json
import os
import random
import threading
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
CACHE_PATH = DATA_DIR / "instagram_cache.json"
SESSION_PATH = DATA_DIR / "instagram_session.json"

# Public accounts to monitor. Fact-checkers first - they're the point of the
# project - then general news outlets for broader coverage.
ACCOUNTS = [
    "lupamediaec",
    "ecuadorchequea",
    "primicias.ec",
]

POSTS_PER_ACCOUNT = 6
CACHE_TTL = timedelta(minutes=45)
COOLDOWN = timedelta(hours=6)  # after Instagram pushes back, stay away this long
DELAY_RANGE = [3, 7]  # instagrapi sleeps this long between its own requests
ACCOUNT_PAUSE_RANGE = (12, 30)  # extra human-like pause between accounts

# A refresh takes minutes (deliberately - see the pauses above), so it runs in
# a background thread and the request that triggered it returns the current
# cache immediately rather than blocking.
_refresh_lock = threading.Lock()
_refreshing = False


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {"fetched_at": None, "cooldown_until": None, "posts": []}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"fetched_at": None, "cooldown_until": None, "posts": []}


def _save_cache(cache: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _parse_dt(value: str | None):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def _is_stale(cache: dict) -> bool:
    fetched = _parse_dt(cache.get("fetched_at"))
    if fetched is None:
        return True
    return datetime.now(timezone.utc) - fetched > CACHE_TTL


def _in_cooldown(cache: dict) -> bool:
    until = _parse_dt(cache.get("cooldown_until"))
    return until is not None and datetime.now(timezone.utc) < until


def _scrape_all() -> tuple[list[dict], bool]:
    """Returns (posts, hit_pushback). Never raises."""
    try:
        from instagrapi import Client
        from instagrapi.exceptions import ChallengeRequired, FeedbackRequired, PleaseWaitFewMinutes
    except ImportError:
        return [], False

    username = os.environ.get("IG_USERNAME")
    password = os.environ.get("IG_PASSWORD")
    if not username or not password:
        return [], False

    client = Client()
    client.delay_range = DELAY_RANGE

    try:
        if SESSION_PATH.exists():
            client.load_settings(SESSION_PATH)
        client.login(username, password)
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        client.dump_settings(SESSION_PATH)
    except Exception:
        # Bad credentials, challenge on login, network - all the same to a
        # caller: no Instagram results this round.
        return [], True

    posts: list[dict] = []
    for i, account in enumerate(ACCOUNTS):
        try:
            user_id = client.user_id_from_username(account)
            for m in client.user_medias(user_id, amount=POSTS_PER_ACCOUNT):
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
        except (ChallengeRequired, PleaseWaitFewMinutes, FeedbackRequired):
            # Stop the whole run, not just this account.
            return posts, True
        except Exception:
            continue  # one bad account shouldn't kill the rest

        if i < len(ACCOUNTS) - 1:
            time.sleep(random.uniform(*ACCOUNT_PAUSE_RANGE))

    return posts, False


def _refresh_in_background() -> None:
    global _refreshing
    try:
        posts, pushback = _scrape_all()
        cache = _load_cache()
        if posts:
            cache["posts"] = posts
            cache["fetched_at"] = datetime.now(timezone.utc).isoformat()
        if pushback:
            cache["cooldown_until"] = (datetime.now(timezone.utc) + COOLDOWN).isoformat()
        else:
            cache["cooldown_until"] = None
        _save_cache(cache)
    finally:
        with _refresh_lock:
            _refreshing = False


def _maybe_refresh(cache: dict) -> None:
    global _refreshing
    if _in_cooldown(cache) or not _is_stale(cache):
        return
    if not os.environ.get("IG_USERNAME") or not os.environ.get("IG_PASSWORD"):
        return
    with _refresh_lock:
        if _refreshing:
            return
        _refreshing = True
    threading.Thread(target=_refresh_in_background, daemon=True).start()


def search_instagram_posts(query: str, limit: int = 6) -> dict:
    """Matches the shape of the other search modules: {accounts_checked, articles}."""
    cache = _load_cache()
    _maybe_refresh(cache)

    terms = [_normalize(t) for t in query.split() if len(t) > 2]
    matches = []
    for post in cache.get("posts", []):
        haystack = _normalize(post.get("title", ""))
        if not terms or any(term in haystack for term in terms):
            matches.append(post)

    return {
        "accounts_checked": [f"@{a}" for a in ACCOUNTS],
        "articles": matches[:limit],
        "cache_age_minutes": (
            round((datetime.now(timezone.utc) - _parse_dt(cache["fetched_at"])).total_seconds() / 60)
            if _parse_dt(cache.get("fetched_at"))
            else None
        ),
    }
