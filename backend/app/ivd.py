"""
Loads the curated Índice de Vulnerabilidad ante la Desinformación (IVD) —
Ecuador 2024, combining two sources:

  - IVD_vulnerabilidad_Ecuador_2024.csv - the up-to-date main dataset, with
    three combined dimensions (D1 Socioeconómica, D2 Educativa, D3
    Desconfianza institucional) plus, for every D1/D2 sub-indicator, BOTH
    its normalized 0-100 score (used for ranking/coloring) and its raw
    real-world value (the number a journalist would actually cite - a Gini
    coefficient, a % poverty rate, years of schooling). D3 similarly carries
    both the raw survey distrust % and the smoothed % actually used in
    scoring.
  - ivd_2024.xlsx's "Desconfianza por institución" sheet - the CSV has only
    D3's aggregate, not the per-institution breakdown (Congreso, Policía,
    etc.), so that one sheet is still loaded and joined in by province name
    (spellings confirmed identical across both files).

Covers 23 of 24 provinces (all but Galápagos, which INEC has no poverty data
for), and imputes a national baseline for the three provinces with zero
Latinobarometro respondents (Napo, Pastaza, Zamora Chinchipe) instead of
silently omitting them.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).parent / "data" / "IVD_vulnerabilidad_Ecuador_2024.csv"
XLSX_PATH = Path(__file__).parent / "data" / "ivd_2024.xlsx"

# label -> (norm column, bruto column, unit, whether the bruto value is a
# 0-1 fraction that should be shown as a %)
D1_SUBINDICATORS = {
    "Pobreza por ingresos": ("norm_pobreza_por_ingresos", "bruto_pobreza_por_ingresos", "%", True),
    "Pobreza extrema por ingresos": ("norm_pobreza_extrema_por_ingresos", "bruto_pobreza_extrema_por_ingresos", "%", True),
    "Pobreza multidimensional": ("norm_pobreza_multidimensional", "bruto_pobreza_multidimensional", "%", True),
    "Pobreza por NBI": ("norm_pobreza_por_nbi", "bruto_pobreza_por_nbi", "%", True),
    "Coeficiente de Gini": ("norm_coeficiente_de_gini", "bruto_coeficiente_de_gini", "índice", False),
}
D2_SUBINDICATORS = {
    "Tasa de analfabetismo": ("norm_tasa_de_analfabetismo", "bruto_tasa_de_analfabetismo", "%", True),
    "Años promedio de escolaridad": ("norm_años_promedio_de_escolaridad", "bruto_años_promedio_de_escolaridad", "años", False),
    "Tasa neta asistencia secundaria": ("norm_tasa_neta_asistencia_secundaria", "bruto_tasa_neta_asistencia_secundaria", "%", True),
    "Tasa neta asistencia bachillerato": ("norm_tasa_neta_asistencia_bachillerato", "bruto_tasa_neta_asistencia_bachillerato", "%", True),
}
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


def _clean_xlsx(df: pd.DataFrame) -> pd.DataFrame:
    """Drops the trailing footer rows the sheet has (a blank row, then a
    source-citation row whose only non-empty cell happens to land in the
    "Provincia" column - the citation text itself, not a province name)."""
    return df.dropna(subset=["Provincia"])


def _num(row, col):
    v = row.get(col)
    return None if pd.isna(v) else float(v)


@lru_cache(maxsize=1)
def load_ivd() -> dict[str, dict]:
    """Returns {province: {...}} keyed by province name."""
    main = pd.read_csv(CSV_PATH, encoding="utf-8-sig")
    main = main.dropna(subset=["provincia"])

    institutions = _clean_xlsx(pd.read_excel(XLSX_PATH, sheet_name="Desconfianza por institución")).set_index("Provincia")

    out: dict[str, dict] = {}
    for _, row in main.iterrows():
        province = row["provincia"]

        rec = {
            "province": province,
            "ivd": round(float(row["IVD"]), 1),
            "ranking": int(row["ranking"]),
            "nivel": row["nivel"],
            "d1_socioeconomica": round(float(row["D1_socioeconomica"]), 1),
            "d2_educativa": round(float(row["D2_educativa"]), 1),
            "d3_desconfianza_institucional": round(float(row["D3_desconfianza"]), 1),
            "n_latinobarometro": int(row["n_latinobarometro"]),
            "confiabilidad_muestra": row["confiabilidad_muestra_lb"],
            "d3_desconfianza_bruta_pct": _num(row, "desconfianza_bruta_pct"),
            "d3_desconfianza_suavizada_pct": _num(row, "desconfianza_suavizada_pct"),
        }

        d1, d1_bruto = {}, {}
        for label, (norm_col, bruto_col, unidad, as_pct) in D1_SUBINDICATORS.items():
            norm_v = _num(row, norm_col)
            bruto_v = _num(row, bruto_col)
            if norm_v is not None:
                d1[label] = round(norm_v, 1)
            if bruto_v is not None:
                d1_bruto[label] = {"valor": round(bruto_v * 100 if as_pct else bruto_v, 2), "unidad": unidad}
        rec["d1_subindicadores"] = d1
        rec["d1_subindicadores_bruto"] = d1_bruto

        d2, d2_bruto = {}, {}
        for label, (norm_col, bruto_col, unidad, as_pct) in D2_SUBINDICATORS.items():
            norm_v = _num(row, norm_col)
            bruto_v = _num(row, bruto_col)
            if norm_v is not None:
                d2[label] = round(norm_v, 1)
            if bruto_v is not None:
                d2_bruto[label] = {"valor": round(bruto_v * 100 if as_pct else bruto_v, 2), "unidad": unidad}
        rec["d2_subindicadores"] = d2
        rec["d2_subindicadores_bruto"] = d2_bruto

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
