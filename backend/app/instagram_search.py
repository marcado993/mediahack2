"""
Instagram posts from Ecuadorian news / fact-checking accounts, via Playwright
+ exported session cookies - the same approach that already works for
Facebook in app/facebook_search.py.

Why not instagrapi (the obvious choice, and what this file used to do):
Instagram's private login endpoint rejected us at every turn. From the
server (Oracle Cloud) it returned 429 before authentication was even
attempted - datacenter IP ranges are blocked outright. From a residential
connection it returned 400 BadPassword, whose own error text admits it fires
"when Instagram rejects the proxy/IP, device fingerprint, or login context,
even if the password is correct". Two failed attempts was where we stopped:
hammering a login endpoint is precisely how an account goes from
rate-limited to locked.

Cookies sidestep all of it. There is no login request to reject, no
password in the codebase, and no verification code to relay - the session
was already established by a human in a real browser. It also runs fine
from the server, so unlike the instagrapi path this does NOT depend on
anyone's laptop being switched on.

Needs backend/app/data/instagram_cookies.txt (Netscape format, exported
while logged into instagram.com - same procedure as the Facebook one).
Missing or expired cookies -> empty results, not a crash.

Cached and refreshed in a background thread for the same reason as
Facebook: rendering ~4 pages per account through a real browser takes tens
of seconds, and doing that per API request would both feel broken and look
like automation from Instagram's side.
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
COOKIES_PATH = DATA_DIR / "instagram_cookies.txt"
CACHE_PATH = DATA_DIR / "instagram_cache.json"

# Handles verified against the live profiles rather than guessed - the first
# pass used "primicias.ec", which is an unrelated art/tourism account, and
# filed its posts under the news outlet's name for several runs.
ACCOUNTS = [
    "lupamediaec",  # Lupa Media (verificador)
    "primiciasec",  # Primicias (medio)
    "ecuadorchequea",  # Ecuador Chequea - perfil lento/intermitente, degrada a 0 sin romper
]

POSTS_PER_ACCOUNT = 4  # each one is a separate page render - keep it modest
CACHE_TTL = timedelta(minutes=45)
POST_PAUSE_MS = 1800  # deliberate gap between post loads, not a burst
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


# og:description on an Instagram post reads like:
#   123 likes, 4 comments - lupamediaec on August 14, 2026: "el texto real..."
# The caption is everything after the first `: "`; the engagement/handle/date
# prefix is noise a journalist doesn't want quoted back at them. Anchoring on
# the *closing* quote instead was the obvious first attempt and it silently
# failed on every real post - Instagram truncates long descriptions, so the
# closing quote frequently isn't there and the whole prefix leaked through.
_CAPTION_RE = re.compile(r':\s*["“”](.*)$', re.DOTALL)

# ...and the same string names the author: "- lupamediaec on August 14, 2026:"
_AUTHOR_RE = re.compile(r"-\s*([A-Za-z0-9._]+)\s+on\s", re.DOTALL)


def _caption_from_description(desc: str | None) -> str:
    if not desc:
        return ""
    text = desc.strip()
    match = _CAPTION_RE.search(text)
    if match:
        text = match.group(1)
    return text.strip().strip('"“”').strip()


def _author_from_description(desc: str | None) -> str | None:
    if not desc:
        return None
    match = _AUTHOR_RE.search(desc)
    return match.group(1).lower() if match else None


def _fetch_account(account: str, context) -> list[dict]:
    page = context.new_page()
    posts: list[dict] = []
    try:
        page.goto(f"https://www.instagram.com/{account}/", wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(6000)  # grid is lazy-rendered; 4s left slower profiles empty

        # Grab both grid posts and reels - several of these outlets publish
        # almost entirely as reels, and looking only at /p/ links made those
        # accounts come back permanently empty.
        links = page.evaluate(
            """() => Array.from(document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]'))
                .map(a => a.href)
                .filter((v, i, arr) => arr.indexOf(v) === i)"""
        )
        if not links:
            return []

        for href in links[: POSTS_PER_ACCOUNT * 2]:
            if len(posts) >= POSTS_PER_ACCOUNT:
                break
            try:
                page.goto(href, wait_until="domcontentloaded", timeout=25000)
                page.wait_for_timeout(1500)
                desc = page.get_attribute('meta[property="og:description"]', "content")

                # Verify authorship at the post itself rather than trusting
                # the grid: a profile page also renders "suggested" posts
                # from other accounts, and filing someone else's post under
                # the outlet we're monitoring is a real attribution error on
                # a tool whose whole job is telling sources apart.
                author = _author_from_description(desc)
                if author and author != account.lower():
                    continue

                caption = _caption_from_description(desc)
                if caption:
                    posts.append(
                        {
                            "source": f"Instagram · @{account}",
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


def search_instagram_posts(query: str, limit: int = 6) -> dict:
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
