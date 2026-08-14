"""
Research assistant for journalists, backed by DeepSeek's chat API
(OpenAI-compatible), now with real tool-calling: the model can call
search_news() - our RSS-backed search over Ecuadorian news outlets
(app/news_search.py) - instead of only answering from training data.

This replaces the earlier "Facebook API" plan: Facebook access is still
blocked on cookie extraction (kevinzg/facebook-scraper needs a logged-in
session we don't have working yet), and GDELT's servers are unreachable
from this network. The RSS search is real and already proven working, so
that's the tool DeepSeek actually gets - swap in a Facebook-backed search
function here later if that path unblocks, the tool-calling wiring won't
need to change, just what search_news() calls internally.

The model still has no *general* internet access - only this one search
tool, over one outlet's recent headlines. The system prompt and the
frontend disclaimer both say so; don't drop one without the other.
"""
from __future__ import annotations

import json
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.news_search import search_news_articles

router = APIRouter(prefix="/api", tags=["ask"])

DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-chat"

SYSTEM_PROMPT = (
    "Eres un asistente de investigación para periodistas ecuatorianos, dentro de un proyecto "
    "sobre vulnerabilidad territorial a la desinformación POLÍTICA - no deportes, no "
    "entretenimiento. Respondes en español, de forma concisa y verificable. "
    "Tienes UNA herramienta: search_news, que busca en los titulares políticos más recientes de "
    "medios ecuatorianos y páginas de Facebook (deportes ya viene excluido) - no es un archivo "
    "histórico, solo lo publicado recientemente. "
    "LLAMA search_news de inmediato en casi cualquier pregunta sobre Ecuador, política, "
    "funcionarios, candidatos, provincias o eventos actuales - incluso si la pregunta es amplia o "
    "ambigua (ej. solo 'Ecuador'). No pidas que el usuario aclare primero; usa el término tal cual "
    "como query y muestra lo que encuentres. Solo evita la herramienta para preguntas claramente "
    "atemporales (definiciones, historia antigua, geografía general). "
    "Si la herramienta no devuelve resultados, dilo explícitamente - no inventes una noticia que no "
    "encontraste. Cuando SÍ haya resultados, cita cada uno en tu respuesta como un enlace en "
    "markdown usando su título y URL exactos, ej. [Título del artículo](url) - el usuario quiere "
    "poder hacer clic directo desde tu respuesta, no solo ver las tarjetas separadas. Para todo lo "
    "demás, respondes desde tu conocimiento entrenado y dejas claro que no tienes acceso a "
    "internet en general, solo a esa única búsqueda de noticias."
)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_news",
            "description": (
                "Busca en los titulares políticos recientes de medios de noticias ecuatorianos "
                "(deportes excluido automáticamente). Solo cubre lo publicado en los últimos "
                "días, no es un archivo buscable."
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


class AskResponse(BaseModel):
    answer: str
    model: str
    articles_used: list[dict] = []


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

    client = _client()
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    try:
        first = client.chat.completions.create(model=MODEL, messages=messages, tools=TOOLS)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando DeepSeek: {e}")

    reply = first.choices[0].message
    articles_used: list[dict] = []

    if reply.tool_calls:
        messages.append(reply.model_dump(exclude_none=True))
        for call in reply.tool_calls:
            try:
                args = json.loads(call.function.arguments)
            except json.JSONDecodeError:
                args = {}
            result = search_news_articles(args.get("query", question), limit=6)
            articles_used.extend(result["articles"])
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
        answer = reply.content

    return AskResponse(answer=answer, model=MODEL, articles_used=articles_used)
