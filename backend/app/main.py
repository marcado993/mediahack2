from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ask, media, meta, news, provinces, trends

app = FastAPI(
    title="Mapa de Vulnerabilidad a Desinformación - API",
    description=(
        "Backend for the territorial disinformation-vulnerability map. "
        "Serves per-province indicators derived from Latinobarometro 2024 "
        "Ecuador survey data, plus a manually curated media-ecosystem layer."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # hackathon: wide open. Restrict before any real deploy.
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(provinces.router)
app.include_router(media.router)
app.include_router(meta.router)
app.include_router(ask.router)
app.include_router(news.router)
app.include_router(trends.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
