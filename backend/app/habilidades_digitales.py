"""
Digital-competence score per province, from MINTEL's Encuesta/Censo
Nacional de Habilidades Digitales 2023 (public microdata, Ministerio de
Telecomunicaciones y de la Sociedad de la Información -
datosabiertos.gob.ec).

The source file is respondent-level and carries PII (cédula, nombre,
correo, teléfono) - it is NOT committed here. Only the derived,
already-aggregated, anonymous result is: data/mintel_habilidades_digitales_2023.csv
(province, mean score, respondent count - nothing that identifies a
person).

The score itself is the share of "Sí" answers across the 31-question
"Competencias digitales" block of the CIUDADANO sheet (uso crítico y
seguro de la tecnología: búsqueda avanzada, contraste de fuentes,
herramientas colaborativas, identidad digital, fundamentos de
programación, privacidad, reconocer SPAM, etc.) - not the survey's own
overall "Puntuación" column, which mixes in business/government questions
that don't apply to a citizen respondent.

Coverage is uneven and this is a self-selected online sample (428 citizen
respondents nationwide), nothing like the Censo or Latinobarómetro in
rigor - several provinces have single-digit n, and Galápagos, Morona
Santiago, Napo, Orellana, Pastaza, Sucumbíos and Zamora Chinchipe have no
respondents at all. Treat this as a directional, supplementary layer, not
a load-bearing indicator - callers should surface `n` alongside the score.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).parent / "data" / "mintel_habilidades_digitales_2023.csv"

# Provinces with too few respondents for the score to mean anything on its
# own - still returned, but callers should flag these rather than hide
# them outright (same "sin muestra" convention used for Latinobarómetro).
MIN_RELIABLE_N = 10


@lru_cache(maxsize=1)
def load_habilidades_digitales() -> dict[str, dict]:
    df = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    out: dict[str, dict] = {}
    for _, row in df.iterrows():
        out[row["provincia"]] = {
            "score": round(float(row["habilidades_digitales_score"]), 1),
            "n": int(row["n_respuestas"]),
            "confiable": int(row["n_respuestas"]) >= MIN_RELIABLE_N,
        }
    return out


def get_province(name: str) -> dict | None:
    return load_habilidades_digitales().get(name)
