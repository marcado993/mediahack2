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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["contrast"])

# Vocabulario de costo/financiamiento para ampliar la búsqueda: una propuesta
# rara vez se publica junto a la palabra "presupuesto" literal.
COST_TERMS = ["presupuesto", "costo", "financiamiento", "inversión", "millones", "obra"]


class ContrastRequest(BaseModel):
    proposal: str
    province: str | None = None


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
    absorb(search_news_articles(proposal, limit=20))
    base = f"{req.province} {proposal}" if req.province else proposal
    for term in COST_TERMS[:3]:
        if len(evidence) >= 8:
            break
        absorb(search_news_articles(f"{base} {term}", limit=12))

    # Marcamos qué piezas mencionan cifras o financiamiento: es lo que el
    # periodista busca primero, y es un dato verificable del texto, no una
    # interpretación nuestra.
    for item in evidence:
        text = (item.get("title") or "").lower()
        item["menciona_costo"] = any(t in text for t in COST_TERMS) or any(c.isdigit() for c in text)

    con_costo = [e for e in evidence if e["menciona_costo"]]

    return {
        "proposal": proposal,
        "province": req.province,
        "evidencia": evidence[:12],
        "con_referencia_a_costo": len(con_costo),
        "total": len(evidence),
        "hallazgo": (
            "Ninguna fuente consultada publicó algo sobre el costo o financiamiento de esta "
            "propuesta. La ausencia de cifras públicas es en sí misma reporteable: se puede "
            "preguntar a quien la propone cuánto cuesta y de dónde saldría el dinero."
            if not con_costo
            else f"{len(con_costo)} de {len(evidence)} publicaciones mencionan cifras, costo o financiamiento."
        ),
        "advertencia": (
            "Esta herramienta NO evalúa si la propuesta es viable. No dispone de los "
            "presupuestos asignados por provincia ni de las partidas del Presupuesto General "
            "del Estado, y emitir un veredicto sin esos datos sería inventar una conclusión "
            "sobre la propuesta de un candidato real. Aquí solo se reúne la evidencia "
            "publicada; el contraste y la conclusión los hace el periodista."
        ),
    }
