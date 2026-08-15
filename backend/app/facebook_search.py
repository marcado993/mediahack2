"""
Facebook page posts via Playwright (real browser rendering) + exported
session cookies - not kevinzg/facebook-scraper, which we proved dead: even
with valid cookies (confirmed logged in via /settings), both m.facebook.com
and mbasic.facebook.com now redirect straight to the modern React site with
no server-rendered <article> tags for that library to find. Facebook posts
only exist in the DOM after JS runs, so this renders the page for real and
reads the DOM afterward. [data-ad-preview="message"] reliably isolates just
the post text - confirmed against a real post, cleanly, no surrounding UI
chrome.

Like app/instagram_search.py, this is CACHED and never scrapes per request.
Two reasons, both real: launching Chromium and rendering N pages takes 10s+,
which would make every /api/news call feel broken; and hammering Facebook
from a datacenter IP on every request is how the session cookie gets
invalidated. A request arriving while the cache is warm reads the JSON file
and never opens a browser.

Needs backend/app/data/facebook_cookies.txt (Netscape format, exported
while logged into facebook.com - see scraper/README.md for how). Missing or
expired cookies -> empty results, not a crash.
"""
from __future__ import annotations

import json
import threading
import time
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
COOKIES_PATH = DATA_DIR / "facebook_cookies.txt"
CACHE_PATH = DATA_DIR / "facebook_cache.json"

# Public news-page timelines to check. Fact-checkers first, same reasoning as
# news_search.FEEDS.
PAGES = {
    "Lupa Media": "https://www.facebook.com/lupamediaec/",
    "Ecuador Chequea": "https://www.facebook.com/ecuadorchequea/",
    "Noticias Al Día Ecuador": "https://www.facebook.com/FarandulaNoticiasYMas/",
}

CACHE_TTL = timedelta(minutes=30)
PAGE_PAUSE_MS = 2500  # deliberate gap between page loads, not a burst

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


def _fetch_page_posts(page_name: str, url: str, browser) -> list[dict]:
    context = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    )
    cookies = _load_cookies()
    if cookies:
        context.add_cookies(cookies)

    page = context.new_page()
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=20000)
        page.wait_for_timeout(4000)
        posts = []
        for el in page.query_selector_all('[data-ad-preview="message"]'):
            text = el.inner_text().strip()
            if not text:
                continue
            permalink = el.evaluate(
                r"""(node) => {
                    let el = node;
                    let hops = 0;
                    while (el && hops < 25) {
                        const role = el.getAttribute && el.getAttribute('role');
                        const pagelet = el.getAttribute && el.getAttribute('data-pagelet');
                        if (role === 'article' || (pagelet && pagelet.startsWith('FeedUnit'))) break;
                        el = el.parentElement;
                        hops++;
                    }
                    if (!el || el === document.body) return null;
                    const anchors = Array.from(el.querySelectorAll('a[href]'));
                    const permalink = anchors.find(a => /\/(posts\/pfbid|videos\/\d+|reel\/\d+|photos\/[^/]+\/\d+|story\.php\?story_fbid=|permalink\.php\?story_fbid=)/.test(a.href));
                    return permalink ? permalink.href : null;
                }"""
            )
            posts.append(
                {
                    "source": f"Facebook · {page_name}",
                    "title": text[:280],
                    "link": permalink or url,
                    "published": None,
                }
            )
        return posts
    except Exception:
        return []
    finally:
        context.close()


def _scrape_all() -> list[dict]:
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return []

    posts: list[dict] = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for i, (page_name, url) in enumerate(PAGES.items()):
                posts.extend(_fetch_page_posts(page_name, url, browser))
                if i < len(PAGES) - 1:
                    time.sleep(PAGE_PAUSE_MS / 1000)
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


def search_facebook_posts(query: str, limit: int = 8) -> dict:
    if not COOKIES_PATH.exists():
        return {"query": query, "pages_checked": [], "articles": [], "note": "sin cookies configuradas"}

    cache = _load_cache()
    _maybe_refresh(cache)

    terms = [_normalize(t) for t in query.split() if len(t) > 2]
    matches = []
    for post in cache.get("posts", []):
        haystack = _normalize(post.get("title", ""))
        if not terms or any(term in haystack for term in terms):
            matches.append(post)

    return {
        "query": query,
        "pages_checked": list(PAGES.keys()),
        "articles": matches[:limit],
        "cache_age_minutes": (
            round((datetime.now(timezone.utc) - _parse_dt(cache["fetched_at"])).total_seconds() / 60)
            if _parse_dt(cache.get("fetched_at"))
            else None
        ),
    }
