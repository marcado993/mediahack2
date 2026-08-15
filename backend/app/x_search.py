"""
X / Twitter live search via Playwright + exported session cookies.

Different in kind from the other social modules: Facebook, Instagram and
TikTok are *account* readers - fixed list of outlets, pull their latest
posts. This one is a *query* reader, hitting X's live search. That's the
piece that makes "¿de qué habla el alcalde de Quito?" and "¿por qué la
gente está brava por lo de la 6 de diciembre?" answerable at all: those
aren't questions any single outlet's timeline answers, they're questions
about what people are saying.

It's also what the per-province trend view is built on (see
app/routers/trends.py) - a province name plus political terms, aggregated
into the hashtags and phrases actually circulating.

Everything is filtered through app/politics.py before being returned. The
instruction was "solo de política, cosas relevantes para las elecciones",
and unfiltered X search on an Ecuadorian city name is overwhelmingly
football and traffic.

Needs backend/app/data/x_cookies.txt (Netscape format, exported while
logged into x.com). Without it: no results, no crash.

Cached per query, since the same province gets asked about repeatedly and
each search is a full browser render.
"""
from __future__ import annotations

import json
import threading
import time
import unicodedata
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.politics import is_political

DATA_DIR = Path(__file__).parent / "data"
COOKIES_PATH = DATA_DIR / "x_cookies.txt"
CACHE_PATH = DATA_DIR / "x_cache.json"

CACHE_TTL = timedelta(minutes=30)
MAX_CACHED_QUERIES = 40
SCROLLS = 2

# Hard floor between live searches, independent of what the caller asks for.
# The frontend debounces province switching, but a debounce can be defeated
# by two people using the dashboard at once, or by a reload loop. This is the
# backstop: X sees at most one search per interval from this process, and
# everything else is served from cache (even stale, even empty) rather than
# queued into a burst that looks like automation.
MIN_SCRAPE_INTERVAL = timedelta(seconds=25)

_lock = threading.Lock()
_last_scrape_at: datetime | None = None


def _throttled() -> bool:
    if _last_scrape_at is None:
        return False
    return datetime.now(timezone.utc) - _last_scrape_at < MIN_SCRAPE_INTERVAL


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_cache(cache: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    # Keep the file from growing without bound as queries accumulate.
    if len(cache) > MAX_CACHED_QUERIES:
        oldest = sorted(cache.items(), key=lambda kv: kv[1].get("fetched_at") or "")
        for key, _ in oldest[: len(cache) - MAX_CACHED_QUERIES]:
            cache.pop(key, None)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _fresh(entry: dict | None) -> bool:
    if not entry or not entry.get("fetched_at"):
        return False
    try:
        fetched = datetime.fromisoformat(entry["fetched_at"])
    except ValueError:
        return False
    return datetime.now(timezone.utc) - fetched <= CACHE_TTL


def _load_cookies() -> list[dict] | None:
    if not COOKIES_PATH.exists():
        return None
    cookies = []
    with COOKIES_PATH.open(encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.strip().split("\t")
            if len(parts) != 7:
                continue
            domain, _flag, path, secure, expiry, name, value = parts
            cookies.append(
                {
                    "name": name,
                    "value": value,
                    "domain": domain,
                    "path": path,
                    "secure": secure == "TRUE",
                    "expires": int(expiry) if expiry != "0" else -1,
                }
            )
    return cookies


def _scrape(query: str) -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    cookies = _load_cookies()
    if not cookies:
        return []

    # f=live gives chronological results; the default "Top" tab is ranked and
    # skews to a handful of viral posts, which is the wrong shape for
    # "what's circulating right now".
    url = "https://x.com/search?q=" + urllib.parse.quote(query) + "&f=live"

    out: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            )
            context.add_cookies(cookies)
            page = context.new_page()
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(5000)
                for _ in range(SCROLLS):
                    page.mouse.wheel(0, 2200)
                    page.wait_for_timeout(2500)

                out = page.evaluate(
                    """() => Array.from(document.querySelectorAll('article[data-testid="tweet"]')).map(a => {
                        const textEl = a.querySelector('[data-testid="tweetText"]');
                        const timeEl = a.querySelector('time');
                        const linkEl = timeEl ? timeEl.closest('a') : null;
                        const userEl = a.querySelector('[data-testid="User-Name"]');
                        return {
                            text: textEl ? textEl.innerText : '',
                            link: linkEl ? linkEl.href : '',
                            published: timeEl ? timeEl.getAttribute('datetime') : null,
                            user: userEl ? userEl.innerText.split('\\n')[0] : ''
                        };
                    }).filter(t => t.text && t.link)"""
                )
            except Exception:
                out = []
            finally:
                page.close()
                context.close()
        finally:
            browser.close()

    seen = set()
    posts = []
    for t in out:
        link = t.get("link")
        if not link or link in seen:
            continue
        seen.add(link)
        text = (t.get("text") or "").strip()
        if not is_political(text):
            continue
        posts.append(
            {
                "source": "X (Twitter)",
                "title": text[:280],
                "link": link,
                "published": t.get("published"),
                "user": t.get("user") or "",
            }
        )
    return posts


def search_x_posts(query: str, limit: int = 6) -> dict:
    if not COOKIES_PATH.exists():
        return {"query": query, "articles": [], "note": "sin cookies de X configuradas"}

    key = _normalize(query).strip()
    with _lock:
        cache = _load_cache()
        entry = cache.get(key)

    if not _fresh(entry) and not _throttled():
        global _last_scrape_at
        with _lock:
            if _throttled():  # another thread got there first
                return {"query": query, "articles": (entry.get("posts") if entry else []) or []}
            _last_scrape_at = datetime.now(timezone.utc)
        posts = _scrape(query)
        if posts:
            with _lock:
                cache = _load_cache()
                cache[key] = {"fetched_at": datetime.now(timezone.utc).isoformat(), "posts": posts}
                _save_cache(cache)
            entry = cache[key]
        elif entry is None:
            entry = {"fetched_at": None, "posts": []}

    return {"query": query, "articles": (entry.get("posts") or [])[:limit]}
