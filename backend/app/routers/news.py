from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["news"])


@router.get("/news")
def search_news(query: str, limit: int = 12):
    """Returns both a merged `articles` list and the `by_source` breakdown the
    dashboard uses to show one card group per source."""
    query = query.strip()
    if not query:
        raise HTTPException(status_code=422, detail="query no puede estar vacío.")
    result = search_news_articles(query, limit)
    if not result["articles"] and not any(len(t) > 2 for t in query.split()):
        raise HTTPException(status_code=422, detail="query demasiado corto.")
    return result
