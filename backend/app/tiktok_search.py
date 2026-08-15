"""
TikTok posts from Ecuadorian fact-checking / news accounts, via Playwright +
exported session cookies - the same pattern as app/instagram_search.py and
app/facebook_search.py.

Not davidteather/TikTok-Api on purpose: that library carries its own
ms_token acquisition machinery which is its own fragile moving part, and we
already have a working cookie-based Playwright pattern in this codebase.
Reusing it means one approach to maintain instead of two, and no extra
dependency.

Verified before writing this: an anonymous visit to a TikTok profile renders
the bio and follower counts but ZERO video links - the nav still shows
"Log in". The grid is gated behind a session, which is why cookies are
required here and not merely nice to have. Without them this returns
nothing rather than failing.

Needs backend/app/data/tiktok_cookies.txt (Netscape format, exported while
logged into tiktok.com - same procedure as the Facebook/Instagram ones).

Cached and refreshed in a background thread for the same reason as the
others: each account costs several page renders, and doing that per API
request would be slow and would look like automation.
"""
from __future__ import annotations

import json
import re
import threading
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
COOKIES_PATH = DATA_DIR / "tiktok_cookies.txt"
CACHE_PATH = DATA_DIR / "tiktok_cache.json"

# Handles get verified against live profiles before being trusted - the
# Instagram pass shipped an unrelated art account as a news outlet for
# several runs because the handle merely looked right.
ACCOUNTS = [
    "ecuadorchequea",  # confirmado activo: 3.361 seguidores, periodismo de verificación
]

POSTS_PER_ACCOUNT = 4
CACHE_TTL = timedelta(minutes=45)
POST_PAUSE_MS = 2000
ACCOUNT_PAUSE_MS = 4000

_refresh_lock = threading.Lock()
_refreshing = False


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {"fetched_at": None, "posts": []}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {"fetched_at": None, "posts": []}


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


# A TikTok video's og:description looks like:
#   "1234 Likes, 56 Comments. TikTok video from EcuadorChequea (@ecuadorchequea): "el texto"."
# Same shape of problem as Instagram: the caption is the tail, the
# engagement prefix is noise, and the closing quote is not reliably present
# because TikTok truncates.
_CAPTION_RE = re.compile(r':\s*["“”](.*)$', re.DOTALL)


def _caption_from_description(desc: str | None) -> str:
    if not desc:
        return ""
    text = desc.strip()
    match = _CAPTION_RE.search(text)
    if match:
        text = match.group(1)
    # One combined strip, not sequential: TikTok ends the description with
    # `".` and stripping the period first left the quote stranded.
    return text.strip().strip('"“”. ').strip()


def _fetch_account(account: str, context) -> list[dict]:
    page = context.new_page()
    posts: list[dict] = []
    try:
        page.goto(f"https://www.tiktok.com/@{account}", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(6000)
        # The grid lazy-loads; without a nudge the first render is often empty.
        page.mouse.wheel(0, 1500)
        page.wait_for_timeout(3000)

        links = page.evaluate(
            """(account) => Array.from(document.querySelectorAll('a[href*="/video/"]'))
                .map(a => a.href)
                .filter(h => h.includes('@' + account + '/video/'))
                .filter((v, i, arr) => arr.indexOf(v) === i)""",
            account,
        )
        if not links:
            return []

        for href in links[:POSTS_PER_ACCOUNT]:
            try:
                page.goto(href, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(2000)
                desc = page.get_attribute('meta[property="og:description"]', "content")
                caption = _caption_from_description(desc)
                if caption:
                    posts.append(
                        {
                            "source": f"TikTok · @{account}",
                            "title": caption[:280],
                            "link": href,
                            "published": None,
                        }
                    )
            except Exception:
                continue
            time.sleep(POST_PAUSE_MS / 1000)

        return posts
    except Exception:
        return posts
    finally:
        page.close()


def _scrape_all() -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    cookies = _load_cookies()
    if not cookies:
        return []

    posts: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
            )
            context.add_cookies(cookies)
            try:
                for i, account in enumerate(ACCOUNTS):
                    posts.extend(_fetch_account(account, context))
                    if i < len(ACCOUNTS) - 1:
                        time.sleep(ACCOUNT_PAUSE_MS / 1000)
            finally:
                context.close()
        finally:
            browser.close()
    return posts


def _refresh_in_background() -> None:
    global _refreshing
    try:
        posts = _scrape_all()
        if posts:
            _save_cache({"fetched_at": datetime.now(timezone.utc).isoformat(), "posts": posts})
    finally:
        with _refresh_lock:
            _refreshing = False


def _maybe_refresh(cache: dict) -> None:
    global _refreshing
    if not COOKIES_PATH.exists() or not _is_stale(cache):
        return
    with _refresh_lock:
        if _refreshing:
            return
        _refreshing = True
    threading.Thread(target=_refresh_in_background, daemon=True).start()


def search_tiktok_posts(query: str, limit: int = 6) -> dict:
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
