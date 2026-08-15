"""
Research assistant for journalists, backed by DeepSeek's chat API
(OpenAI-compatible), with real tool-calling: DeepSeek is the *brain* that
decides what to search for, but every publication it shows comes from
app/news_search.py - the centralizer over Lupa Media, Ecuador Chequea, El
Comercio, Facebook pages and Instagram accounts. Nothing in the citations is
model-generated, which is the whole point on a disinformation project.

Two rules the prompt enforces hard, both from direct user feedback:
  - Always search. "No tengo idea" / "no tengo acceso a internet" as a
    first answer is a failure mode here, not honesty - the tool exists.
  - Show the publications, not a profile of the outlet. The user wants the
    posts themselves, not a description of who Lupa Media is.

The model still has no *general* internet access - only this one search
tool, over the sources listed in news_search.py. The system prompt and the
frontend disclaimer both say so; don't drop one without the other.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["ask"])

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-chat"

SYSTEM_PROMPT = (
    "Eres un asistente de investigación para periodistas ecuatorianos, dentro de un proyecto "
    "sobre vulnerabilidad territorial a la desinformación POLÍTICA - no deportes, no "
    "entretenimiento. Respondes en español, conciso y verificable.\n\n"
    "TIENES UNA HERRAMIENTA: search_news. Centraliza publicaciones REALES y recientes de "
    "verificadores ecuatorianos (Lupa Media, Ecuador Chequea), medios (El Comercio), páginas de "
    "Facebook y cuentas de Instagram. No es un archivo histórico: solo lo publicado hace poco.\n\n"
    "REGLA 1 - SIEMPRE BUSCA PRIMERO. Llama search_news de inmediato en cualquier pregunta sobre "
    "Ecuador, política, provincias, funcionarios, candidatos, desinformación o eventos actuales, "
    "incluso si la pregunta es amplia o ambigua (ej. solo 'Ecuador' o solo el nombre de una "
    "provincia). NUNCA respondas 'no tengo idea', 'no tengo acceso a internet' o 'necesito que "
    "aclares' antes de haber llamado la herramienta. Si el primer intento no devuelve nada, vuelve "
    "a llamarla con un término más amplio (ej. la provincia sola, o 'Ecuador') antes de rendirte.\n\n"
    "REGLA 2 - MUESTRA LAS PUBLICACIONES, NO DESCRIPCIONES. El usuario quiere las publicaciones en "
    "sí. No expliques qué es Lupa Media ni quién es Ecuador Chequea, no describas las cuentas ni su "
    "línea editorial. Lista lo que encontraste y ya.\n\n"
    "FORMATO: agrupa por fuente y cita cada publicación como enlace markdown con su título y URL "
    "exactos, ej. [Título](url). El usuario debe poder hacer clic directo desde tu respuesta.\n\n"
    "Si de verdad no hubo resultados tras buscar, dilo en una línea - nunca inventes una "
    "publicación, un titular ni un enlace que la herramienta no devolvió."
)

# When the dashboard has a province selected, that context is prepended to
# the user's question so a bare "¿qué se dice aquí?" still resolves to
# something searchable. Per user instruction the search stays on the
# province name itself and does not silently swap in the capital city.
PROVINCE_CONTEXT = (
    "CONTEXTO: el periodista está viendo la provincia de {province} en el mapa de vulnerabilidad "
    "a la desinformación (IVD {ivd}, nivel {nivel}). Enfoca la búsqueda en '{province}' como "
    "término. No sustituyas la provincia por su capital ni hables de la capital como si fuera la "
    "provincia.\n\nPREGUNTA: "
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_news",
            "description": (
                "Busca publicaciones políticas recientes en verificadores ecuatorianos (Lupa "
                "Media, Ecuador Chequea), medios (El Comercio), páginas de Facebook y cuentas de "
                "Instagram. Deportes excluido automáticamente. Solo cubre lo publicado en los "
                "últimos días, no es un archivo buscable."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Términos de búsqueda, ej. 'candidatos Orellana'"},
                },
                "required": ["query"],
            },
        },
    }
]


class AskRequest(BaseModel):
    question: str
    province: Optional[str] = None
    ivd: Optional[float] = None
    nivel: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    model: str
    articles_used: list[dict] = []
    by_source: dict = {}


# DeepSeek intermittently emits its tool call as *literal text* in the
# content field instead of populating the structured `tool_calls` field:
#
#   <||DSML||tool_calls><||DSML||invoke name="search_news">
#   <||DSML||parameter name="query" string="true">Orellana política</...>
#
# Left unhandled that markup leaks straight into the answer a journalist
# reads, and the search never runs. These recover the intended query and
# scrub any residue.
_DSML_QUERY_RE = re.compile(r'name="query"[^>]*>(.*?)<', re.DOTALL)
_DSML_SCRUB_RE = re.compile(r"<[^<>]*DSML[^<>]*>", re.DOTALL)


def _extract_text_tool_query(content: str | None) -> str | None:
    if not content or "DSML" not in content:
        return None
    match = _DSML_QUERY_RE.search(content)
    return match.group(1).strip() if match else None


def _scrub(content: str | None) -> str:
    if not content:
        return ""
    return _DSML_SCRUB_RE.sub("", content).strip()


# Used for the recovery path below. A *fresh* conversation with no tools and
# no tool-call history: re-using the original message list kept priming
# DeepSeek to emit yet another text-form tool call instead of prose.
SUMMARY_PROMPT = (
    "Eres un asistente para periodistas ecuatorianos. Te doy publicaciones REALES ya encontradas. "
    "NO tienes herramientas y no debes intentar llamar ninguna. Redacta directamente la respuesta "
    "final en español: agrupa por fuente y cita cada publicación como enlace markdown [Título](url) "
    "con su título y URL exactos. No inventes publicaciones ni enlaces. No describas qué son los "
    "medios, solo muestra lo que publicaron. Sé breve."
)


def _summarize(client, question: str, result: dict) -> str | None:
    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SUMMARY_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"Pregunta del periodista: {question}\n\n"
                        f"Publicaciones encontradas (JSON):\n{json.dumps(result, ensure_ascii=False)}"
                    ),
                },
            ],
        )
        return _scrub(resp.choices[0].message.content)
    except Exception:
        return None


BROAD_FALLBACK_QUERY = "Ecuador"


def _search_widening(query: str) -> dict:
    """Search, and if a narrow term finds nothing, widen once to national.

    A small province (Orellana, Napo) legitimately appears in zero recent
    headlines. Returning an empty result there is technically honest but
    useless - the journalist asked to see what's circulating. So we widen,
    and flag that we did so the answer can say it out loud instead of
    passing national news off as provincial.
    """
    result = search_news_articles(query, limit=12)
    if result["articles"] or _normalize_q(query) == _normalize_q(BROAD_FALLBACK_QUERY):
        return result

    broad = search_news_articles(BROAD_FALLBACK_QUERY, limit=12)
    if not broad["articles"]:
        return result
    broad["widened_from"] = query
    broad["note"] = (
        f"Ninguna fuente publicó algo reciente que mencione '{query}'. "
        "Se muestran las publicaciones nacionales más recientes."
    )
    return broad


def _normalize_q(q: str) -> str:
    return (q or "").strip().lower()


def _plain_answer(result: dict) -> str:
    """Deterministic, no-LLM rendering of the results.

    The whole point of this endpoint is that the journalist gets real
    publications; if DeepSeek is having a bad day the publications are
    already in hand, so ship them rather than an apology.
    """
    groups = {k: v for k, v in result.get("by_source", {}).items() if v}
    if not groups:
        return "No se encontraron publicaciones recientes en las fuentes consultadas."
    lines = []
    for name, items in groups.items():
        lines.append(f"**{name}**")
        for a in items:
            lines.append(f"- [{a['title']}]({a['link']})")
        lines.append("")
    return "\n".join(lines).strip()


def _client():
    from openai import OpenAI

    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="DEEPSEEK_API_KEY no está configurada en el backend (ver backend/.env.example).",
        )
    return OpenAI(api_key=api_key, base_url=DEEPSEEK_BASE_URL)


@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="La pregunta no puede estar vacía.")

    user_content = question
    if req.province:
        user_content = (
            PROVINCE_CONTEXT.format(
                province=req.province,
                ivd=req.ivd if req.ivd is not None else "s/d",
                nivel=req.nivel or "s/d",
            )
            + question
        )

    client = _client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]

    try:
        first = client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando DeepSeek: {e}")

    reply = first.choices[0].message
    articles_used: list[dict] = []
    by_source: dict = {}

    if reply.tool_calls:
        messages.append(reply.model_dump(exclude_none=True))
        for call in reply.tool_calls:
            try:
                args = json.loads(call.function.arguments)
            except json.JSONDecodeError:
                args = {}
            result = _search_widening(args.get("query", question))
            articles_used.extend(result["articles"])
            for name, items in result.get("by_source", {}).items():
                by_source.setdefault(name, []).extend(items)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

        try:
            second = client.chat.completions.create(model=MODEL, messages=messages)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Error consultando DeepSeek: {e}")
        answer = second.choices[0].message.content
    else:
        # No structured tool call. Either DeepSeek emitted one as plain text
        # (see _extract_text_tool_query) or it answered from training data,
        # which this prompt forbids. Either way: run the search ourselves so
        # the user still gets real publications rather than "no tengo idea".
        text_query = _extract_text_tool_query(reply.content)
        result = _search_widening(text_query or req.province or question)
        articles_used = result["articles"]
        by_source = result.get("by_source", {})

        answer = _summarize(client, question, result) or _scrub(reply.content)
        # A recovered text-form tool call scrubs down to bare search terms
        # ("Orellana política"), which is not an answer - prefer the plain
        # rendering over shipping that.
        if text_query and (not answer or len(answer) < 40):
            answer = _plain_answer(result)

    # De-duplicate by link: the same post can arrive from two tool calls.
    seen = set()
    deduped = []
    for a in articles_used:
        key = a.get("link")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(a)

    # Last line of defence: no internal tool-call markup ever reaches the UI.
    return AskResponse(answer=_scrub(answer), model=MODEL, articles_used=deduped, by_source=by_source)
