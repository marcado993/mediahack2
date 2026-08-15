"""
Per-province political listening, aimed at investigative journalists.

Answers what the rest of the dashboard couldn't: not "what did outlets
publish about this province" but "who is being talked about here, and about
what" - which is where an investigation starts. It's what makes "¿por qué la
gente está brava por lo de la 6 de diciembre?" approachable at all: that's a
conversation, not a headline.

Three things it returns, in the order an investigator actually uses them:
  - actores:  named people, institutions and @accounts recurring in the
              conversation. The lead. Who to call.
  - temas:    recurring topics/hashtags, deduplicated across their hashtag
              and plain-word forms (#Política and "politica" are one thing,
              and listing both as separate "trends" is just noise).
  - posts:    the raw material behind both, so nothing has to be taken on
              faith.

Everything is scoped to politics/elections via app/politics.py - unfiltered
search on an Ecuadorian province name is mostly football and traffic.

What this is NOT, stated plainly because the temptation is real: a sentiment
score, a virality metric, or a measure of public opinion. It counts what
recurs in a small sample of recent posts and shows the posts behind each
count. Anything more confident would be dressing up an unrepresentative
sample as measurement - on a disinformation project that is precisely the
failure mode we exist to push against.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter

from fastapi import APIRouter, HTTPException

from app.news_search import search_news_articles
from app.politics import QUERY_EXPANSION
from app.x_search import search_x_posts

router = APIRouter(prefix="/api", tags=["trends"])

# Actores institucionales y cargos: lo que un investigador quiere ver primero.
ACTOR_TERMS = {
    "cne", "asamblea", "asambleista", "gobierno", "ministerio", "ministro", "ministra",
    "presidente", "presidenta", "vicepresidente", "alcalde", "alcaldesa", "alcaldia",
    "prefecto", "prefecta", "prefectura", "concejal", "municipio", "gobernador",
    "fiscalia", "fiscal", "contraloria", "judicatura", "corte", "defensoria",
    "policia", "militares", "ejercito", "consejo", "tribunal", "cpccs",
    "noboa", "correa", "glas", "gonzalez", "villavicencio", "lasso",
    "adn", "pachakutik", "psc", "revolucion",
}

# Palabras vacías + ruido de redes. Sin esto la "tendencia" es "para", "como".
STOPWORDS = {
    "para", "como", "pero", "porque", "cuando", "donde", "desde", "hasta", "sobre",
    "entre", "todo", "toda", "todos", "todas", "esta", "este", "esto", "estos", "estas",
    "ese", "esa", "esos", "esas", "aquel", "hace", "tiene", "tienen", "hacer", "puede",
    "solo", "mismo", "misma", "otra", "otro", "otros", "otras", "cada", "muy", "mas",
    "menos", "que", "los", "las", "del", "con", "por", "una", "uno", "sus", "sin",
    "son", "fue", "han", "hay", "les", "nos", "ver", "asi", "aun", "ante", "tras",
    "https", "http", "com", "www", "amp", "via", "the", "and", "for", "you", "are",
    "detalles", "aqui", "ahora", "hoy", "ayer", "nota", "leer", "mira", "video",
    "noticias", "noticia", "informacion", "entrevista", "programa", "radio",
    "sera", "seran", "sido", "estar", "tambien", "entonces", "mientras", "aunque",
    "amigo", "gracias", "favor", "sobre", "segun", "durante", "luego", "antes",
}

_HASHTAG_RE = re.compile(r"#(\w{3,30})", re.UNICODE)
_WORD_RE = re.compile(r"\b[a-záéíóúñü]{4,}\b", re.IGNORECASE | re.UNICODE)


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def _samples(posts: list[dict], needle: str, n: int = 2) -> list[dict]:
    key = _normalize(needle)
    return [p for p in posts if key in _normalize(p.get("title", ""))][:n]


@router.get("/trends")
def province_trends(province: str, limit: int = 6):
    province = province.strip()
    if not province:
        raise HTTPException(status_code=422, detail="province no puede estar vacío.")

    # Escalating recall. "Orellana política" demands both words and a small
    # province almost never satisfies it - the real conversation says
    # "prefecto de Orellana", never the literal word "política". So: try the
    # electoral vocabulary with OR, then the bare province name (still
    # politically filtered downstream), and stop as soon as something lands.
    posts: list[dict] = []
    seen_links: set[str] = set()

    def absorb(items):
        for item in items:
            link = item.get("link")
            if link and link not in seen_links:
                seen_links.add(link)
                posts.append(item)

    for expansion in QUERY_EXPANSION:
        absorb(search_x_posts(f"{province} ({expansion})", limit=40).get("articles", []))
        if len(posts) >= 8:
            break
    if len(posts) < 4:
        absorb(search_x_posts(province, limit=40).get("articles", []))

    # Beyond X: the same province is covered by the fact-checkers and outlets
    # this project already aggregates, and for provinces with little social
    # conversation that's where the entire signal lives. Without this, every
    # province except Pichincha came back empty.
    try:
        media = search_news_articles(province, limit=20)
        absorb([a for group in media.get("by_source", {}).values() for a in group])
    except Exception:
        pass

    if not posts:
        return {
            "province": province,
            "actores": [],
            "temas": [],
            "posts": [],
            "total_analizados": 0,
            "note": (
                "Sin conversación ni cobertura política reciente sobre esta provincia "
                "en las fuentes consultadas, "
                "o las cookies de X expiraron."
            ),
        }

    # Terms that are in the query itself carry no information - a search for
    # "Pichincha política" trivially trends "Pichincha" and "política".
    ignored = {_normalize(t) for t in province.split()} | {"politica", "político", "politico"}

    actors: Counter = Counter()
    actor_display: dict[str, str] = {}
    topics: Counter = Counter()
    topic_display: dict[str, str] = {}

    for post in posts:
        text = post.get("title", "")

        # NOTE: @mentions are deliberately NOT aggregated here.
        #
        # An earlier version ranked the accounts most mentioned in a
        # province's political conversation. Checked against real results,
        # those accounts were ordinary citizens, not public figures - and
        # counting and ranking private individuals by their political
        # activity is political profiling of citizens, explicitly prohibited
        # by the MediaHack II ethics framework (principle 7). There is no
        # reliable automatic way to tell a public official's account from a
        # private citizen's, so the whole mechanism is removed rather than
        # filtered. "Actores" below therefore covers institutions and public
        # offices only (Gobierno, CNE, Alcaldía...), never individuals.

        # Hashtags and plain words are merged on their normalized form, so
        # "#Política" and "politica" count once instead of appearing as two
        # separate trends - which is what made the first version read as
        # noise.
        for tag in _HASHTAG_RE.findall(text):
            norm = _normalize(tag)
            if norm in ignored or norm in STOPWORDS:
                continue
            bucket = actors if norm in ACTOR_TERMS else topics
            display = actor_display if norm in ACTOR_TERMS else topic_display
            bucket[norm] += 1
            display.setdefault(norm, "#" + tag)

        for word in _WORD_RE.findall(text):
            norm = _normalize(word)
            if norm in ignored or norm in STOPWORDS or len(norm) < 4:
                continue
            if norm in ACTOR_TERMS:
                actors[norm] += 1
                actor_display.setdefault(norm, word)
            else:
                topics[norm] += 1
                topic_display.setdefault(norm, word)

    def build(counter: Counter, display: dict[str, str]) -> list[dict]:
        out = []
        for norm, count in counter.most_common(limit):
            if count < 2:
                continue
            out.append(
                {
                    "term": display.get(norm, norm),
                    "count": count,
                    "samples": _samples(posts, norm),
                }
            )
        return out

    return {
        "province": province,
        "actores": build(actors, actor_display),
        "temas": build(topics, topic_display),
        "posts": posts[:10],
        "total_analizados": len(posts),
    }
