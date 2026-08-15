"""
Propagation chain of a claim across the sources this project can reach.

WHAT THIS IS NOT, and the distinction is the whole point: this does not
determine the *origin* of a piece of news. Establishing origin means proving
causality - that outlet B published because outlet A did - and that cannot
be inferred from timestamps over a handful of feeds. Naming an "origin"
without that proof would be a false attribution about a real, identifiable
publisher, on a tool whose entire purpose is fighting false attribution. It
would also cut straight against the neutrality principle of the MediaHack II
ethics framework.

What it does instead, which is genuinely useful and defensible: orders every
matching publication by its real publication timestamp and shows the
sequence. The earliest item is labelled "primera aparición registrada" - the
first time this appeared *in the sources we check*, which is a claim about
our data, not about the world. A journalist reading the chain can then do
the actual attribution work, which is a human judgement.

Honest limits, surfaced in the response rather than buried:
  - Only RSS feeds and X carry reliable timestamps. Facebook, Instagram and
    TikTok posts arrive without a usable date, so they're returned in a
    separate `sin_fecha` bucket instead of being silently placed at an
    invented position in the timeline.
  - The sources are a small sample. Something almost certainly appeared
    somewhere earlier, unseen.
"""
from __future__ import annotations

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from fastapi import APIRouter, HTTPException

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["origin"])


def _parse_date(value: str | None) -> datetime | None:
    """RSS uses RFC-2822 ("Fri, 14 Aug 2026 23:24:12 +0000"), X uses ISO-8601."""
    if not value:
        return None
    try:
        dt = parsedate_to_datetime(value)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        pass
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _kind(source: str) -> str:
    if source.startswith(("Facebook", "Instagram", "TikTok")) or source.startswith("X ("):
        return "red"
    if source in {"Lupa Media", "Ecuador Chequea"}:
        return "verificador"
    return "medio"


@router.get("/origin")
def propagation_chain(claim: str, limit: int = 14):
    """Chronological propagation of `claim` across every source, where dated."""
    claim = claim.strip()
    if not claim:
        raise HTTPException(status_code=422, detail="claim no puede estar vacío.")

    result = search_news_articles(claim, limit=40)
    items = [a for group in result.get("by_source", {}).values() for a in group]

    dated, undated = [], []
    for item in items:
        node = {
            "source": item.get("source", ""),
            "kind": _kind(item.get("source", "")),
            "title": item.get("title", ""),
            "link": item.get("link", ""),
        }
        parsed = _parse_date(item.get("published"))
        if parsed:
            node["timestamp"] = parsed.isoformat()
            dated.append((parsed, node))
        else:
            undated.append(node)

    dated.sort(key=lambda pair: pair[0])
    chain = [node for _, node in dated][:limit]

    # Hours elapsed since the first recorded appearance - the shape a
    # journalist actually reads ("picked up 4h later"), not raw datetimes.
    if chain:
        first = _parse_date(chain[0]["timestamp"])
        for node in chain:
            delta = _parse_date(node["timestamp"]) - first
            node["horas_desde_primera"] = round(delta.total_seconds() / 3600, 1)

    return {
        "claim": claim,
        "cadena": chain,
        "sin_fecha": undated[:limit],
        "primera_aparicion": chain[0] if chain else None,
        "total_encontrado": len(items),
        "advertencia": (
            "Esta es la secuencia de publicación en las fuentes consultadas, no el origen "
            "de la noticia. No prueba que una fuente copiara a otra, y es casi seguro que "
            "existan apariciones anteriores fuera de esta muestra. Las publicaciones de "
            "Facebook, Instagram y TikTok no traen fecha utilizable y se listan aparte."
        ),
    }
