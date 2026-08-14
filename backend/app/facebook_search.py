"""
Facebook posts via Playwright (real browser rendering) + exported session
cookies - not kevinzg/facebook-scraper, which we proved dead: even with
valid cookies (confirmed logged in via /settings), both m.facebook.com and
mbasic.facebook.com now redirect straight to the modern React site with no
server-rendered <article> tags for that library to find. Facebook posts
only exist in the DOM after JS runs, so this renders the page for real and
reads the DOM afterward. [data-ad-preview="message"] reliably isolates just
the post text - confirmed against a real post, cleanly, no surrounding UI
chrome.

Needs backend/app/data/facebook_cookies.txt (Netscape format, exported
while logged into facebook.com - see scraper/README.md for how). Missing
or expired cookies -> empty results, not a crash.
"""
from __future__ import annotations

import unicodedata
from pathlib import Path

COOKIES_PATH = Path(__file__).parent / "data" / "facebook_cookies.txt"

# Public news-page timelines to check. Confirmed working against the first
# entry during testing; add more real outlet Facebook pages as needed.
PAGES = {
    "Noticias Al Día Ecuador": "https://www.facebook.com/FarandulaNoticiasYMas/",
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


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
                    "title": text,
                    "link": permalink or url,
                    "published": None,
                }
            )
        return posts
    except Exception:
        return []
    finally:
        context.close()


def search_facebook_posts(query: str, limit: int = 8) -> dict:
    if not COOKIES_PATH.exists():
        return {"query": query, "pages_checked": [], "articles": [], "note": "sin cookies configuradas"}

    terms = [_normalize(t) for t in query.split() if len(t) > 2]
    matches = []

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"query": query, "pages_checked": [], "articles": [], "note": "playwright no instalado"}

    with sync_playwright() as p:
        browser = p.chromium.launch()
        try:
            for page_name, url in PAGES.items():
                for post in _fetch_page_posts(page_name, url, browser):
                    haystack = _normalize(post["title"])
                    if not terms or any(term in haystack for term in terms):
                        matches.append(post)
        finally:
            browser.close()

    return {"query": query, "pages_checked": list(PAGES.keys()), "articles": matches[:limit]}
