"""
Contraste de una propuesta contra la evidencia publicada sobre su costo y
financiamiento.

DELIBERADAMENTE NO ES UN VERIFICADOR DE FACTIBILIDAD. No emite un veredicto
sobre si una propuesta "se puede o no se puede" hacer, y la razón es
concreta: este proyecto no tiene los presupuestos asignados por provincia ni
las partidas del Presupuesto General del Estado. Un botón que dijera
"inviable" sin esos datos estaría fabricando autoridad sobre una afirmación
de un candidato real - y en plena campaña, un veredicto inventado sobre una
propuesta es exactamente la desinformación que esta herramienta combate.
También violaría el principio de neutralidad política del Marco de
Gobernanza Ética del MediaHack II.

Lo que sí hace, que es lo que un periodista necesita para empezar: buscar en
todas las fuentes qué se ha publicado sobre el costo, el financiamiento y el
presupuesto de esa propuesta, y devolver esa evidencia con sus enlaces. Si
no hay nada publicado, lo dice - y "nadie ha publicado cuánto cuesta" es en
sí mismo un hallazgo reporteable, no un fracaso de la herramienta.

El veredicto lo pone el periodista, con las fuentes en la mano.
"""
from __future__ import annotations

import re
import unicodedata

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["contrast"])

# Dos ejes de contraste, porque una propuesta puede fallar por dos razones
# distintas y un periodista necesita distinguirlas: no alcanza la plata, o
# no es competencia de ese cargo.
COST_TERMS = ["presupuesto", "costo", "financiamiento", "inversión", "millones", "obra"]

# El segundo eje. Un alcalde que promete algo que por ley le corresponde al
# Gobierno central no tiene un problema de presupuesto: tiene un problema de
# competencia. Es de las preguntas más útiles y menos hechas en campaña.
LEGAL_TERMS = ["ley", "normativa", "competencia", "constitución", "ordenanza", "COOTAD", "reforma"]


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", (text or "").lower())
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


class ContrastRequest(BaseModel):
    proposal: str
    # Optional[str], not `str | None`: the server runs Python 3.9, where
    # FastAPI/pydantic can't evaluate PEP-604 unions at route-registration
    # time. Same trap that took media.py down earlier.
    province: Optional[str] = None


@router.post("/contrast")
def contrast(req: ContrastRequest):
    proposal = req.proposal.strip()
    if not proposal:
        raise HTTPException(status_code=422, detail="proposal no puede estar vacía.")

    evidence: list[dict] = []
    seen: set[str] = set()

    def absorb(result):
        for group in result.get("by_source", {}).values():
            for item in group:
                link = item.get("link")
                if link and link not in seen:
                    seen.add(link)
                    evidence.append(item)

    # La propuesta tal cual, y luego cruzada con vocabulario de costo.
    absorb(search_news_articles(proposal, limit=20, include_social=False))
    base = f"{req.province} {proposal}" if req.province else proposal
    for term in COST_TERMS[:2] + LEGAL_TERMS[:2]:
        if len(evidence) >= 10:
            break
        absorb(search_news_articles(f"{base} {term}", limit=12, include_social=False))

    # Marcamos qué piezas mencionan cifras o financiamiento: es lo que el
    # periodista busca primero, y es un dato verificable del texto, no una
    # interpretación nuestra.
    for item in evidence:
        text = _normalize(item.get("title") or "")
        has_cost_term = any(_normalize(t) in text for t in COST_TERMS)
        has_monetary_figure = bool(re.search(r"\$\s*[\d.,]+|[\d.,]+\s*(?:millones|mil|dolares|usd)", text))
        item["menciona_costo"] = has_cost_term or has_monetary_figure
        item["menciona_marco_legal"] = any(_normalize(t) in text for t in LEGAL_TERMS)

    con_costo = [e for e in evidence if e["menciona_costo"]]
    con_legal = [e for e in evidence if e["menciona_marco_legal"]]

    return {
        "proposal": proposal,
        "province": req.province,
        "evidencia": evidence[:12],
        "con_referencia_a_costo": len(con_costo),
        "con_referencia_legal": len(con_legal),
        "total": len(evidence),
        "hallazgo": (
            "Ninguna fuente consultada publicó algo sobre el costo ni sobre el marco legal de "
            "esta propuesta. Esa ausencia es en sí misma reporteable: se puede preguntar a "
            "quien la propone cuánto cuesta, de dónde saldría el dinero y si el cargo al que "
            "aspira tiene competencia para ejecutarla."
            if not con_costo and not con_legal
            else (
                f"{len(con_costo)} de {len(evidence)} publicaciones mencionan cifras o "
                f"financiamiento; {len(con_legal)} mencionan leyes, competencias o normativa."
            )
        ),
        "preguntas_sugeridas": [
            "¿Cuánto cuesta y de qué partida saldría el dinero?",
            "¿El cargo al que aspira tiene competencia legal para ejecutarla?",
            "¿Requiere una reforma o una ordenanza previa?",
        ],
        "advertencia": (
            "Esta herramienta NO evalúa si la propuesta es viable ni si es legal. No dispone "
            "de los presupuestos asignados por provincia, de las partidas del Presupuesto "
            "General del Estado ni de un corpus normativo (COOTAD, Constitución), y emitir un "
            "veredicto sin esos datos sería inventar una conclusión sobre la propuesta de un "
            "candidato real. Aquí solo se reúne la evidencia publicada y se sugieren las "
            "preguntas; el contraste y la conclusión los hace el periodista."
        ),
    }
