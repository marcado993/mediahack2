"""
Loads the curated Índice de Vulnerabilidad ante la Desinformación (IVD) —
Ecuador 2024, provided as a spreadsheet with three combined dimensions:

  D1. Socioeconómica       - INEC poverty/inequality indicators
  D2. Educativa             - INEC literacy/schooling indicators
  D3. Desconfianza institucional - Latinobarometro 2024 trust-in-institutions

This supersedes the province-level scoring this backend used to compute
directly from the raw Latinobarometro CSV (see git history / pipeline.py):
the spreadsheet is authoritative, documented in its own "Metodología" sheet,
covers 23 of 24 provinces (all but Galápagos, which INEC has no poverty data
for), and imputes a national baseline for the three provinces with zero
Latinobarometro respondents (Napo, Pastaza, Zamora Chinchipe) instead of
silently omitting them.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

XLSX_PATH = Path(__file__).parent / "data" / "ivd_2024.xlsx"

D1_SUBINDICATORS = [
    "Pobreza por ingresos",
    "Pobreza extrema por ingresos",
    "Pobreza multidimensional",
    "Pobreza por NBI",
    "Coeficiente de Gini",
]
D2_SUBINDICATORS = [
    "Tasa de analfabetismo",
    "Años promedio de escolaridad",
    "Tasa neta asistencia secundaria",
    "Tasa neta asistencia bachillerato",
]
INSTITUTIONS = [
    "Fuerzas Armadas",
    "Policía",
    "Iglesia",
    "Congreso",
    "Gobierno",
    "Poder Judicial",
    "Partidos políticos",
    "Institución electoral",
    "Presidente",
]


def _clean(df: pd.DataFrame) -> pd.DataFrame:
    """Drops the trailing footer rows some sheets have (a blank row, then a
    source-citation row whose only non-empty cell happens to land in the
    "Provincia" column - the citation text itself, not a province name).
    A real data row always has a Provincia value; rows also carrying a
    "Ranking" column only exist on the main sheet, so key off whichever
    column is present and non-null there instead of a name whitelist that
    would fight the sheet's own "Santo Domingo" vs "Santo Domingo de los
    Tsáchilas" spelling differences.
    """
    df = df.dropna(subset=["Provincia"])
    if "Ranking" in df.columns:
        df = df[df["Ranking"].notna()]
    return df


@lru_cache(maxsize=1)
def load_ivd() -> dict[str, dict]:
    """Returns {province: {...}} keyed by the spreadsheet's own province spelling."""
    main = _clean(pd.read_excel(XLSX_PATH, sheet_name="IVD por provincia"))
    normalized = _clean(pd.read_excel(XLSX_PATH, sheet_name="Indicadores normalizados")).set_index("Provincia")
    institutions = _clean(pd.read_excel(XLSX_PATH, sheet_name="Desconfianza por institución")).set_index("Provincia")

    out: dict[str, dict] = {}
    for _, row in main.iterrows():
        province = row["Provincia"]
        rec = {
            "province": province,
            "ivd": round(float(row["IVD (0-100)"]), 1),
            "ranking": int(row["Ranking"]),
            "nivel": row["Nivel de vulnerabilidad"],
            "d1_socioeconomica": round(float(row["D1. Socioeconómica"]), 1),
            "d2_educativa": round(float(row["D2. Educativa"]), 1),
            "d3_desconfianza_institucional": round(float(row["D3. Desconfianza institucional"]), 1),
            "n_latinobarometro": int(row["n Latinobarómetro"]),
            "confiabilidad_muestra": row["Confiabilidad muestra LB"],
        }

        if province in normalized.index:
            nrow = normalized.loc[province]
            rec["d1_subindicadores"] = {k: round(float(nrow[k]), 1) for k in D1_SUBINDICATORS}
            rec["d2_subindicadores"] = {k: round(float(nrow[k]), 1) for k in D2_SUBINDICATORS}

        if province in institutions.index:
            irow = institutions.loc[province]
            rec["desconfianza_por_institucion"] = {
                k: (round(float(irow[k]), 1) if pd.notna(irow[k]) else None) for k in INSTITUTIONS
            }

        out[province] = rec

    return out


def get_province(name: str) -> dict | None:
    return load_ivd().get(name)


def list_provinces() -> list[dict]:
    return list(load_ivd().values())
