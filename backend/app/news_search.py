"""
Real news search, sourced directly from Ecuadorian outlets' public RSS
feeds - no API key, no LLM, no hallucination risk. Confirmed working
against El Comercio's feed directly (GDELT's API was unreachable from this
network when tried, and NewsAPI/Bing News both require a paid/registered
key, so RSS is what's actually live right now).

Real limitation, stated plainly rather than hidden: an RSS feed is only the
outlet's ~20 most recent articles, not a searchable archive. A query only
matches if that outlet published something about it recently. An empty
result means "nothing recent," not "nothing exists."

This project is about political disinformation specifically, so sports
coverage gets filtered out by default: El Comercio's homepage feed is
sports-heavy, and a broad query like "Ecuador" was pulling in Neymar/Barcelona
SC alongside anything actually political. The feed tags each item with real
<category> values, so this excludes "Deportes" using that metadata rather
than guessing from keywords.

Pulled out of app/routers/news.py so app/routers/ask.py can call the same
search as a DeepSeek tool without an internal HTTP round-trip.
"""
from __future__ import annotations

import unicodedata
import xml.etree.ElementTree as ET

import requests

from app.facebook_search import search_facebook_posts

FEEDS = {
    "El Comercio": "https://www.elcomercio.com/feed/",
}

EXCLUDED_CATEGORIES = {"deportes", "futbol", "fútbol"}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text.lower())
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


def search_news_articles(query: str, limit: int = 8, exclude_sports: bool = True, include_facebook: bool = True) -> dict:
    terms = [_normalize(t) for t in query.split() if len(t) > 2]
    matches = []
    sources_checked = list(FEEDS.keys())

    if terms:
        for source, url in FEEDS.items():
            for article in _fetch_feed(source, url):
                if exclude_sports and any(_normalize(c) in EXCLUDED_CATEGORIES for c in article["categories"]):
                    continue
                haystack = _normalize(article["title"])
                if any(term in haystack for term in terms):
                    matches.append(article)

        if include_facebook:
            fb_result = search_facebook_posts(query, limit=limit)
            sources_checked.extend(fb_result["pages_checked"])
            matches.extend(fb_result["articles"])

    return {"query": query, "sources_checked": sources_checked, "articles": matches[:limit]}
