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
            result = search_news_articles(args.get("query", question), limit=12)
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
        # DeepSeek answered without searching, which this prompt tells it never
        # to do for these questions. Rather than pass through a "no tengo idea"
        # answer, run the search ourselves so the user still gets publications.
        result = search_news_articles(req.province or question, limit=12)
        articles_used = result["articles"]
        by_source = result.get("by_source", {})
        answer = reply.content

    # De-duplicate by link: the same post can arrive from two tool calls.
    seen = set()
    deduped = []
    for a in articles_used:
        key = a.get("link")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(a)

    return AskResponse(answer=answer, model=MODEL, articles_used=deduped, by_source=by_source)
