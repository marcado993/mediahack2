"""
Centralizer for every real source this project can reach, in one search:

  - Ecuadorian fact-checkers (Lupa Media, Ecuador Chequea) via their public
    RSS feeds - these are the point of the project, so they're checked first
    and get priority in the merged result.
  - A general outlet (El Comercio) via RSS, for broader political coverage.
  - Facebook page posts via Playwright (app/facebook_search.py).
  - Instagram posts via instagrapi (app/instagram_search.py), served from a
    cache so we never log in per request.

Everything returns real publications - a title, a working link, a date. None
of it is model-generated, so the assistant in app/routers/ask.py can cite
these directly instead of describing them from training data.

Real limitation, stated plainly rather than hidden: an RSS feed is only the
outlet's ~20 most recent items, not a searchable archive, and the social
sources only cover the handful of accounts listed in their modules. An empty
result means "nothing recent in these sources," not "nothing exists."

Per-source quotas (not one global limit) are deliberate: El Comercio
publishes far more often than a fact-checker, so a single merged top-N would
bury Lupa/Chequea every time. Each source gets its own slots and the
frontend gets the breakdown to show them side by side.
"""
from __future__ import annotations

import concurrent.futures
import unicodedata
import xml.etree.ElementTree as ET

import requests

from app.facebook_search import search_facebook_posts
from app.instagram_search import search_instagram_posts
from app.politics import is_political
from app.tiktok_search import search_tiktok_posts
from app.x_search import search_x_posts

# Fact-checkers first - order matters for the merged `articles` list.
FEEDS = {
    "Lupa Media": "https://lupa.com.ec/feed/",
    "Ecuador Chequea": "https://ecuadorchequea.com/feed/",
    "El Comercio": "https://www.elcomercio.com/feed/",
}

EXCLUDED_CATEGORIES = {"deportes", "futbol", "fútbol"}

PER_SOURCE_LIMIT = 3  # "at least 3 of each" - see module docstring


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _fetch_feed(source: str, url: str) -> list[dict]:
    try:
        resp = requests.get(url, timeout=8, headers={"User-Agent": "Mozilla/5.0 (media-vulnerability-dashboard)"})
        resp.raise_for_status()
        root = ET.fromstring(resp.content)
    except Exception:
        return []

    articles = []
    for item in root.findall(".//item"):
        title_el = item.find("title")
        link_el = item.find("link")
        date_el = item.find("pubDate")
        if title_el is None or link_el is None:
            continue
        categories = [c.text for c in item.findall("category") if c.text]
        articles.append(
            {
                "source": source,
                "title": title_el.text or "",
                "link": link_el.text or "",
                "published": date_el.text if date_el is not None else None,
                "categories": categories,
            }
        )
    return articles


_GENERIC_TERMS = {
    "ecuador", "quito", "guayaquil", "cuenca", "politica", "gobierno",
    "pais", "nacional", "estado",
}


def _match(articles: list[dict], terms: list[str], exclude_sports: bool) -> list[dict]:
    out = []
    for article in articles:
        if exclude_sports and any(_normalize(c) in EXCLUDED_CATEGORIES for c in article.get("categories", [])):
            continue
        haystack = _normalize(article.get("title", ""))
        if not terms:
            out.append(article)
        elif len(terms) == 1:
            if terms[0] in haystack:
                out.append(article)
        else:
            matched = [t for t in terms if t in haystack]
            if len(matched) >= 2:
                out.append(article)
            elif len(matched) == 1 and matched[0] not in _GENERIC_TERMS:
                out.append(article)
    return out


def search_news_articles(
    query: str,
    limit: int = 12,
    exclude_sports: bool = True,
    include_social: bool = True,
    political_only: bool = True,
) -> dict:
    """Searches every source and returns both a merged list and a per-source breakdown."""
    terms = [_normalize(t) for t in query.split() if len(t) > 2]
    by_source: dict[str, list[dict]] = {}

    # The RSS feeds are independent HTTP calls - fetching them in sequence
    # means waiting for the slowest one three times over.
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(FEEDS)) as pool:
        futures = {pool.submit(_fetch_feed, name, url): name for name, url in FEEDS.items()}
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            try:
                articles = future.result()
            except Exception:
                articles = []
            by_source[name] = _match(articles, terms, exclude_sports)[:PER_SOURCE_LIMIT]

    if include_social:
        try:
            fb = search_facebook_posts(query, limit=PER_SOURCE_LIMIT)
            for page in fb.get("pages_checked", []):
                by_source.setdefault(f"Facebook · {page}", [])
            for post in fb.get("articles", [])[:PER_SOURCE_LIMIT]:
                by_source.setdefault(post["source"], []).append(post)
        except Exception:
            pass

        try:
            ig = search_instagram_posts(query, limit=PER_SOURCE_LIMIT * 2)
            for account in ig.get("accounts_checked", []):
                by_source.setdefault(f"Instagram · {account}", [])
            for post in ig.get("articles", []):
                bucket = by_source.setdefault(post["source"], [])
                if len(bucket) < PER_SOURCE_LIMIT:
                    bucket.append(post)
        except Exception:
            pass

        try:
            tt = search_tiktok_posts(query, limit=PER_SOURCE_LIMIT * 2)
            for account in tt.get("accounts_checked", []):
                by_source.setdefault(f"TikTok · {account}", [])
            for post in tt.get("articles", []):
                bucket = by_source.setdefault(post["source"], [])
                if len(bucket) < PER_SOURCE_LIMIT:
                    bucket.append(post)
        except Exception:
            pass

        try:
            xs = search_x_posts(query, limit=PER_SOURCE_LIMIT)
            by_source.setdefault("X (Twitter)", [])
            by_source["X (Twitter)"].extend(xs.get("articles", [])[:PER_SOURCE_LIMIT])
        except Exception:
            pass

    # Social modules do their own matching with simple OR logic; for multi-
    # term queries, re-filter through _match() so "corrupción Ecuador" does
    # not keep posts that only mention "Ecuador" without "corrupción".
    if include_social and len(terms) > 1:
        for name in list(by_source):
            if name in FEEDS:
                continue
            by_source[name] = _match(by_source[name], terms, exclude_sports=False)[:PER_SOURCE_LIMIT]

    # "Solo política, cosas relevantes para las elecciones" - applied last so
    # it covers every source uniformly. Social sources already self-filter,
    # but RSS feeds carry plenty of non-political items.
    if political_only:
        by_source = {name: [a for a in items if is_political(a.get("title", ""))] for name, items in by_source.items()}

    # Merged list keeps FEEDS order (fact-checkers first), then social.
    ordered_names = [n for n in FEEDS if n in by_source] + [n for n in by_source if n not in FEEDS]
    merged = [a for name in ordered_names for a in by_source[name]]

    return {
        "query": query,
        "sources_checked": ordered_names,
        "by_source": by_source,
        "articles": merged[:limit],
    }
