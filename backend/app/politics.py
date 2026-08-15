"""
Political / electoral relevance filter, shared by every source.

The user's instruction was explicit: "solo de política, cosas relevantes
para las elecciones". On a disinformation project that isn't a preference,
it's scope - a fact-checker's TikTok about a cooking hoax is real content
but useless for an electoral-vulnerability dashboard, and it dilutes the
signal a journalist is scanning for.

Deliberately keyword-based rather than an LLM call: this runs over every
item from every source on every search, so it has to be instant and
deterministic. DeepSeek stays the brain for interpreting results, not for
filtering hundreds of them one by one.

The list errs toward *including* borderline items. A false positive costs a
journalist one glance; a false negative silently hides the story.
"""
from __future__ import annotations

import unicodedata

# Instituciones, cargos y procesos - el núcleo de lo electoral/político.
POLITICAL_TERMS = {
    # proceso electoral
    "eleccion", "elecciones", "electoral", "candidato", "candidata", "candidatura",
    "voto", "votos", "votacion", "urna", "urnas", "papeleta", "campana", "campaña",
    "cne", "consejo nacional electoral", "tce", "referendum", "consulta popular",
    "constituyente", "binomio", "encuesta", "sufragio", "padron",
    # instituciones
    "asamblea", "asambleista", "gobierno", "ministerio", "ministro", "ministra",
    "presidencia", "presidente", "presidenta", "vicepresidente", "vicepresidenta",
    "alcalde", "alcaldesa", "alcaldia", "prefecto", "prefecta", "prefectura",
    "concejal", "municipio", "municipal", "gobernador", "gobernacion",
    "fiscalia", "fiscal", "contraloria", "judicatura", "corte constitucional",
    "defensoria", "procuraduria",
    # partidos y actores
    "partido", "partidos", "movimiento politico", "bancada", "oposicion", "oficialismo",
    "adn", "revolucion ciudadana", "pachakutik", "psc", "izquierda democratica",
    "noboa", "correa", "gonzalez", "glas",
    # temas de agenda pública
    "corrupcion", "narcopolitica", "juicio politico", "destitucion", "censura",
    "decreto", "ley", "reforma", "veto", "estado de excepcion", "apagon", "apagones",
    "subsidio", "presupuesto", "impuesto", "paro", "protesta", "manifestacion",
    "seguridad", "extorsion", "sicariato", "carcel", "mineria ilegal",
    # desinformación
    "desinformacion", "verificacion", "verificamos", "falso", "enganoso", "engañoso",
    "bulo", "fake", "chequeo", "factcheck", "fact check",
}


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def is_political(text: str) -> bool:
    """True if the text plausibly concerns politics or the electoral process."""
    haystack = _normalize(text)
    return any(term in haystack for term in POLITICAL_TERMS)


def filter_political(items: list[dict], key: str = "title") -> list[dict]:
    return [i for i in items if is_political(i.get(key, ""))]
