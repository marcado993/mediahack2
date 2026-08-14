# Backend — Mapa de Vulnerabilidad a Desinformación (Ecuador)

FastAPI service that scores each of Ecuador's provinces on vulnerability to
political disinformation.

## Run

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Interactive docs at `http://localhost:8000/docs`.

## What's real vs. placeholder

- **IVD layer** (`GET /api/provinces`, `/api/provinces/{province}`) is the
  curated Índice de Vulnerabilidad ante la Desinformación 2024, loaded from
  `app/data/ivd_2024.xlsx` via `app/ivd.py`. Combines three documented
  dimensions (see the spreadsheet's own "Metodología" sheet):
  - **D1. Socioeconómica** — INEC poverty/inequality indicators
  - **D2. Educativa** — INEC literacy/schooling indicators
  - **D3. Desconfianza institucional** — Latinobarometro 2024 trust in 9
    state/political institutions

  Covers 23 of 24 provinces — Galápagos is excluded because INEC has no
  poverty data for it. Napo, Pastaza and Zamora Chinchipe had zero
  Latinobarometro respondents, so their D3 uses a national-average
  imputation; every province's `confiabilidad_muestra` field says exactly
  where its numbers stand (`Alta` / `Media (n<100)` / `Baja (n<50)` /
  `Sin muestra (imputado nacional)`).
- **Media-ecosystem layer** (`/api/media`) is empty by default and not
  currently wired into the frontend UI (deprioritized for now, per the
  user). Nothing about real named outlets is pre-filled. Populate it with
  `POST /api/media` (see `/docs` for the schema); once a province has at
  least one outlet registered, `GET /api/provinces` blends it into
  `vulnerability_index` automatically (`app/scoring.py`).
- Full weighting/formula is served at `GET /api/methodology`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/provinces` | All 23 provinces with a computed IVD, sorted by vulnerability index desc |
| GET | `/api/provinces/{province}` | Full D1/D2/D3 breakdown + raw sub-indicators for one province |
| GET | `/api/media?province=X` | List registered outlets (optionally filtered) — not currently used by the frontend |
| POST | `/api/media` | Register an outlet with its credibility criteria |
| DELETE | `/api/media/{id}` | Remove an outlet |
| GET | `/api/methodology` | Weights and data sources, machine-readable |

Galápagos returns 404 from `/api/provinces/{province}` — it has no IVD. The
frontend handles this directly rather than surfacing a raw error.
