"""
Loads the second-generation Índice de Vulnerabilidad Electoral Informativa
(IVEI) - Ecuador 2024, from data/IVEI_Ecuador_base_integrada.csv.

Standalone from app/ivd.py on purpose: the original IVD (3 dimensions) is
what /api/provinces, the map coloring and every existing dashboard component
are wired to, and nothing here should be able to touch that path. This is
the new, additive "segmentadores" layer (see app/routers/segmentadores.py) -
a richer 4-dimension index (estructural / exposición / resiliencia /
presión coyuntural) plus digital-diet, demographic and socioeconomic
breakdowns per province, modeled on the reference observatory the team
shared (24 provincias + Galápagos, one national row).

The diagnóstico and newsroom-guidance text below are ported rule-by-rule
from that reference (province vs. national-average comparisons only) - no
profiling of individuals, no verdicts on candidates, same constraints as
the rest of this project's ethics framework (see GOBERNANZA_ETICA.md).

Source CSV is Ecuador-standard: ";"-delimited, ","-decimal, UTF-8 with BOM.
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

CSV_PATH = Path(__file__).parent / "data" / "IVEI_Ecuador_base_integrada.csv"

# Aligns this dataset's own spelling with the canonical name used elsewhere
# in the project (app/data/provinces.py) so a province selected on the main
# map resolves to the same record here.
NAME_ALIASES = {
    "Santo Domingo": "Santo Domingo de los Tsáchilas",
}

# short_key -> (csv_column, label, unit, source, direction)
# direction: 1 = higher reads as more vulnerable/worse, -1 = higher is
# better/more resilient, 0 = descriptive only (no inherent "better/worse").
INDICATORS = {
    "IVEI": ("IVEI_indice_integrado", "Vulnerabilidad electoral integrada", "pts/100", "IVEI 2024", 1),
    "EST": ("dim1_vulnerab_estructural", "Vulnerabilidad estructural", "pts/100", "IVEI 2024", 1),
    "EXP": ("dim2_exposicion_informativa", "Exposición informativa", "pts/100", "IVEI 2024", 1),
    "RES": ("dim3_resiliencia_informativa", "Resiliencia informativa", "pts/100", "IVEI 2024", -1),
    "PRE": ("dim4_presion_coyuntural", "Presión coyuntural", "pts/100", "IVEI 2024", 1),
    "EXCLUSION": ("idx_exclusion_digital", "Exclusión digital", "pts/100", "IVEI 2024", 1),
    "HIPEREXP": ("idx_hiperexposicion_digital", "Hiperexposición digital", "pts/100", "IVEI 2024", 1),
    "ivd_original": ("IVD_original_fase1", "IVD original (fase 1)", "pts/100", "IVD 2024", 1),
    "poblacion": ("poblacion_2022", "Población", "hab.", "Censo 2022 (INEC)", 0),
    "densidad": ("densidad_hab_km2", "Densidad poblacional", "hab/km²", "Censo 2022 (INEC)", 0),
    "pct_urbano": ("pct_urbano", "Población urbana", "%", "Censo 2022 (INEC)", 0),
    "pct_rural": ("pct_rural", "Población rural", "%", "Censo 2022 (INEC)", 1),
    "pct_0_14": ("pct_edad_0a14", "0 a 14 años", "%", "Censo 2022 (INEC)", 0),
    "pct_15_29": ("pct_edad_15a29", "15 a 29 años", "%", "Censo 2022 (INEC)", 0),
    "pct_30_44": ("pct_edad_30a44", "30 a 44 años", "%", "Censo 2022 (INEC)", 0),
    "pct_45_64": ("pct_edad_45a64", "45 a 64 años", "%", "Censo 2022 (INEC)", 0),
    "pct_65": ("pct_edad_65ymas", "65 años y más", "%", "Censo 2022 (INEC)", 1),
    "et_mestizo": ("pct_etnia_mestiza", "Mestizo/a", "%", "Censo 2022 (INEC)", 0),
    "et_indigena": ("pct_etnia_indigena", "Indígena", "%", "Censo 2022 (INEC)", 0),
    "et_montubio": ("pct_etnia_montubia", "Montubio/a", "%", "Censo 2022 (INEC)", 0),
    "et_afro": ("pct_etnia_afroecuatoriana", "Afroecuatoriano/a", "%", "Censo 2022 (INEC)", 0),
    "et_blanco": ("pct_etnia_blanca", "Blanco/a", "%", "Censo 2022 (INEC)", 0),
    "et_otro": ("pct_etnia_otra", "Otro", "%", "Censo 2022 (INEC)", 0),
    "pobreza_ingresos": ("pobreza_ingresos_pct_2024", "Pobreza por ingresos", "%", "ENEMDU 2024 (INEC)", 1),
    "pobreza_extrema": ("pobreza_extrema_pct_2024", "Pobreza extrema por ingresos", "%", "ENEMDU 2024 (INEC)", 1),
    "pobreza_multi": ("pobreza_multidimensional_pct_2024", "Pobreza multidimensional", "%", "ENEMDU 2024 (INEC)", 1),
    "nbi": ("pobreza_NBI_pct_2024", "Pobreza por NBI", "%", "ENEMDU 2024 (INEC)", 1),
    "gini": ("coef_gini_2024", "Coeficiente de Gini", "índice", "ENEMDU 2024 (INEC)", 1),
    "nbi_censo": ("pobreza_NBI_censal_pct_2022", "Pobreza por NBI (censal)", "%", "Censo 2022 (INEC)", 1),
    "escolaridad": ("escolaridad_prom_anios_24ymas", "Escolaridad promedio", "años", "ENEMDU 2024 (INEC)", -1),
    "analfabetismo": ("analfabetismo_pct_15ymas", "Analfabetismo", "%", "ENEMDU 2024 (INEC)", 1),
    "analf_digital": ("analf_digital_pct_15ymas", "Analfabetismo digital", "%", "ENEMDU-TIC 2024 (INEC)", 1),
    "adig_65": ("analf_digital_pct_65ymas", "Analfabetismo digital 65+", "%", "ENEMDU-TIC 2024 (INEC)", 1),
    "adig_rural": ("analf_digital_pct_rural", "Analfabetismo digital rural", "%", "ENEMDU-TIC 2024 (INEC)", 1),
    "uso_internet": ("uso_internet_pct_2022", "Uso de internet", "%", "Censo 2022 (INEC)", -1),
    "net_urbano": ("uso_internet_pct_urbano_2022", "Internet urbano", "%", "Censo 2022 (INEC)", -1),
    "net_rural": ("uso_internet_pct_rural_2022", "Internet rural", "%", "Censo 2022 (INEC)", -1),
    "tic_internet_2024": ("uso_internet_pct_2024_ENEMDU", "Uso de internet 2024", "%", "ENEMDU-TIC 2024 (INEC)", -1),
    "uso_celular": ("uso_celular_pct_2022", "Uso de celular", "%", "Censo 2022 (INEC)", -1),
    "uso_computadora": ("uso_computadora_pct_2022", "Uso de computadora", "%", "Censo 2022 (INEC)", -1),
    "usa_redes": ("usa_redes_sociales_pct", "Usa redes sociales", "%", "Latinobarómetro 2024", 0),
    "n_plataformas": ("plataformas_por_persona_n", "Plataformas por persona", "n", "Latinobarómetro 2024", 0),
    "rapidas": ("usa_facebook_whatsapp_o_tiktok_pct", "Usa Facebook, WhatsApp o TikTok", "%", "Latinobarómetro 2024", 1),
    "mensajeria": ("usa_whatsapp_pct", "Usa WhatsApp", "%", "Latinobarómetro 2024", 0),
    "conciencia": ("percibe_info_falsa_promedio_pct", "Percibe información falsa", "%", "Latinobarómetro 2024", -1),
    "conf_interp": ("confianza_interpersonal_pct", "Confianza interpersonal", "%", "Latinobarómetro 2024", -1),
    "desconfianza": ("desconfianza_institucional_pct", "Desconfianza institucional", "%", "Latinobarómetro 2024", 1),
    "fraude": ("elecciones_fraudulentas_pct", "Cree que hubo elecciones fraudulentas", "%", "Latinobarómetro 2024", 1),
    "victima": ("victima_delito_12meses_pct", "Víctima de delito (12 meses)", "%", "Latinobarómetro 2024", 1),
    "temor": ("temor_delito_violento_pct", "Temor al delito violento", "%", "Latinobarómetro 2024", 1),
    "narco": ("narcotrafico_muy_grave_pct", "Narcotráfico muy grave", "%", "Latinobarómetro 2024", 1),
    "corrupcion": ("percepcion_corrupcion_0a100", "Percepción de corrupción", "pts/100", "Latinobarómetro 2024", 1),
    "extremos": ("polarizacion_ideologica_pct", "Polarización ideológica", "%", "Latinobarómetro 2024", 1),
}

DIMENSIONS = [
    ("EST", "Vulnerabilidad estructural", "#4a6fa5"),
    ("EXP", "Exposición informativa", "#b3541e"),
    ("RES", "Resiliencia informativa", "#2f7d52"),
    ("PRE", "Presión coyuntural", "#7a4a9e"),
]

PLATFORM_COLS = {
    "Facebook": "plat_facebook_pct",
    "WhatsApp": "plat_whatsapp_pct",
    "YouTube": "plat_youtube_pct",
    "TikTok": "plat_tiktok_pct",
    "Instagram": "plat_instagram_pct",
    "X": "plat_x_pct",
    "Snapchat": "plat_snapchat_pct",
    "LinkedIn": "plat_linkedin_pct",
    "Otra red": "plat_otra_red_pct",
}

MEDIA_TYPE_COLS = {
    "Televisión": "percibe_info_falsa_TV_pct",
    "Radio": "percibe_info_falsa_radio_pct",
    "Prensa": "percibe_info_falsa_prensa_pct",
    "Redes sociales": "percibe_info_falsa_redes_pct",
}

# One factual sentence per categorical archetype (perfil_territorial) - what
# the label means methodologically, not a judgment of the province.
PERFIL_DESCRIPCIONES = {
    "Alta exposición con capacidad de filtro": (
        "Buena parte de la población está conectada y consume contenido digital, "
        "pero también cuenta con escolaridad y percepción de riesgo informativo "
        "por encima del promedio nacional, lo que amortigua esa exposición."
    ),
    "Exclusión digital con carencia estructural": (
        "El acceso a internet y a dispositivos está por debajo del promedio "
        "nacional y coincide con indicadores socioeconómicos más débiles: la "
        "vulnerabilidad aquí es sobre todo de acceso, no de exceso de exposición."
    ),
    "Perfil intermedio": (
        "Ninguna de las cuatro dimensiones se aparta de forma marcada del "
        "promedio nacional en ningún sentido."
    ),
    "Hiperexposición con baja resiliencia": (
        "Alto consumo de plataformas de circulación rápida (Facebook, WhatsApp, "
        "TikTok) combinado con menor capacidad de contraste (escolaridad, "
        "percepción de riesgo, diversidad de fuentes) que el promedio nacional."
    ),
    "Carencia estructural y déficit de resiliencia": (
        "Coinciden indicadores socioeconómicos débiles y baja capacidad de "
        "contraste de la información: es el perfil con menos amortiguadores "
        "frente a la desinformación."
    ),
    "Exposición alta sobre base estructural sólida": (
        "Alta exposición al ecosistema digital, pero sobre indicadores "
        "socioeconómicos y educativos por encima del promedio nacional."
    ),
}


def _num(v):
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _row_to_record(row: pd.Series) -> dict:
    rec = {key: _num(row.get(col)) for key, (col, *_rest) in INDICATORS.items()}
    rec["poblacion_16mas"] = _num(row.get("poblacion_16ymas_2022"))
    rec["superficie_km2"] = _num(row.get("superficie_km2"))
    rec["nivel"] = row.get("IVEI_nivel")
    rec["rank"] = _num(row.get("IVEI_puesto"))
    rec["perfil"] = row.get("perfil_territorial")
    rec["perfil_desc"] = PERFIL_DESCRIPCIONES.get(row.get("perfil_territorial"), "")
    rec["n_lb"] = int(_num(row.get("n_casos_latinobarometro")) or 0)
    rec["n_tic"] = int(_num(row.get("n_casos_enemdu_tic")) or 0)
    rec["confiabilidad"] = row.get("confiabilidad_encuesta")
    rec["plataformas"] = {label: _num(row.get(col)) for label, col in PLATFORM_COLS.items()}
    rec["percibe_falsa_por_medio"] = {label: _num(row.get(col)) for label, col in MEDIA_TYPE_COLS.items()}
    rec["brecha_internet_urbano_rural"] = _num(row.get("brecha_internet_urbano_rural_pp"))
    return rec


@lru_cache(maxsize=1)
def load_ivei() -> dict:
    """Returns {"provincias": {name: record}, "nacional": record}."""
    df = pd.read_csv(CSV_PATH, sep=";", decimal=",", encoding="utf-8-sig")
    df.columns = [c.strip() for c in df.columns]

    provincias: dict[str, dict] = {}
    nacional: dict | None = None
    for _, row in df.iterrows():
        if row.get("ambito") == "Nacional":
            nacional = _row_to_record(row)
            nacional["nombre"] = "Ecuador (nacional)"
            continue
        name = NAME_ALIASES.get(row["provincia"], row["provincia"])
        rec = _row_to_record(row)
        rec["nombre"] = name
        provincias[name] = rec

    return {"provincias": provincias, "nacional": nacional}


def get_province(name: str) -> dict | None:
    return load_ivei()["provincias"].get(name)


def get_national() -> dict | None:
    return load_ivei()["nacional"]


def list_provinces() -> list[dict]:
    return sorted(load_ivei()["provincias"].values(), key=lambda r: r["rank"] or 99)


def _dif(p: dict, nac: dict, key: str) -> float:
    return (p.get(key) or 0) - (nac.get(key) or 0)


def diagnostico(name: str) -> list[str]:
    """Rule-based, territory-level explanation of where a province sits vs.
    the national average. No inference about individuals or candidates -
    every sentence cites a real column and a real national comparison."""
    p = get_province(name)
    nac = get_national()
    if p is None or nac is None:
        return []

    out: list[str] = []
    dim_labels = {
        "EST": "la vulnerabilidad estructural",
        "EXP": "la exposición al ecosistema digital",
        "RES": "el déficit de resiliencia informativa",
        "PRE": "la presión coyuntural",
    }
    dim_labels2 = {
        "EST": "de la vulnerabilidad estructural",
        "EXP": "de la exposición al ecosistema digital",
        "RES": "del déficit de resiliencia informativa",
        "PRE": "de la presión coyuntural",
    }
    dims = [
        ("EST", _dif(p, nac, "EST")),
        ("EXP", _dif(p, nac, "EXP")),
        ("RES", -_dif(p, nac, "RES")),
        ("PRE", _dif(p, nac, "PRE")),
    ]
    dims.sort(key=lambda d: d[1], reverse=True)
    top = [d for d in dims if d[1] > 3]

    out.append(
        f"{p['nombre']} ocupa el puesto {int(p['rank'])} de 24 en el índice integrado "
        f"({p['IVEI']:.1f} sobre 100, vulnerabilidad {(p['nivel'] or '').lower()}), "
        f"frente a un promedio nacional de {nac['IVEI']:.1f}."
    )
    if top:
        sentence = f"Lo que explica ese resultado es, en primer lugar, {dim_labels[top[0][0]]} ({p[top[0][0]]:.1f} sobre 100)"
        if len(top) > 1:
            sentence += f", seguida {dim_labels2[top[1][0]]}"
        out.append(sentence + ".")
    else:
        out.append("Ninguna dimensión se aparta de forma marcada del promedio nacional.")

    ex = []
    if _dif(p, nac, "pobreza_ingresos") > 4:
        ex.append(f"una pobreza por ingresos de {p['pobreza_ingresos']:.1f}% ({_dif(p, nac, 'pobreza_ingresos'):+.1f} puntos sobre el promedio)")
    if _dif(p, nac, "pct_rural") > 8:
        ex.append(f"una población mayoritariamente dispersa: {p['pct_rural']:.1f}% rural")
    if _dif(p, nac, "analf_digital") > 3:
        ex.append(f"un analfabetismo digital de {p['analf_digital']:.1f}% frente al {nac['analf_digital']:.1f}% nacional")
    if _dif(p, nac, "escolaridad") < -0.6:
        ex.append(f"una escolaridad promedio de {p['escolaridad']:.1f} años, por debajo de los {nac['escolaridad']:.1f} del país")
    if _dif(p, nac, "uso_internet") < -6:
        ex.append(f"un uso de internet de apenas {p['uso_internet']:.1f}%")
    elif _dif(p, nac, "uso_internet") > 6:
        ex.append(f"un uso de internet de {p['uso_internet']:.1f}%, superior al promedio")
    if _dif(p, nac, "desconfianza") > 2:
        ex.append(f"una desconfianza institucional de {p['desconfianza']:.1f}%")
    if ex:
        out.append("En términos concretos, la provincia combina " + "; ".join(ex) + ".")

    out.append(f"Perfil territorial: {p['perfil']}. {p['perfil_desc']}")

    brecha = (p.get("net_urbano") or 0) - (p.get("net_rural") or 0)
    if brecha > 12:
        out.append(
            f"La brecha interna es relevante: el uso de internet alcanza {p['net_urbano']:.1f}% en el área "
            f"urbana pero cae a {p['net_rural']:.1f}% en la rural ({brecha:.1f} puntos de diferencia), y el "
            f"analfabetismo digital llega a {p['adig_65']:.1f}% entre las personas de 65 años y más."
        )

    if p["n_lb"] == 0:
        out.append(
            "Advertencia: el Latinobarómetro 2024 no incluyó muestra en esta provincia, de modo que los "
            "indicadores de confianza, dieta informativa y presión coyuntural corresponden al promedio "
            "nacional imputado y no describen a la provincia."
        )
    elif p["n_lb"] < 50:
        out.append(
            f"Advertencia: la muestra provincial del Latinobarómetro es pequeña (n = {p['n_lb']}); los "
            "indicadores de confianza y coyuntura están suavizados hacia la media nacional y deben leerse "
            "como aproximaciones."
        )

    return out


def recomendaciones_periodismo(name: str) -> list[dict]:
    """Newsroom-guidance derived purely from where the province's own
    indicators sit vs. the national average - never a claim about any
    individual, outlet or candidate."""
    p = get_province(name)
    nac = get_national()
    if p is None or nac is None:
        return []

    r: list[dict] = []

    if (p.get("uso_internet") or 0) < (nac.get("uso_internet") or 0) - 5 or (p.get("EXCLUSION") or 0) > 60:
        r.append({
            "titulo": "No asuma cobertura digital",
            "texto": (
                f"Con {p['uso_internet']:.1f}% de uso de internet y {p['analf_digital']:.1f}% de "
                "analfabetismo digital, una parte sustancial de la población no será alcanzada por "
                "contenido publicado solo en redes. La radio y los canales presenciales siguen siendo "
                "necesarios para llegar a ese público."
            ),
        })
    if (p.get("HIPEREXP") or 0) > 60:
        r.append({
            "titulo": "Priorice el desmentido en plataformas de circulación rápida",
            "texto": (
                f"Entre la población conectada, el {p['rapidas']:.1f}% usa Facebook, WhatsApp o TikTok y el "
                f"{p['mensajeria']:.1f}% usa mensajería privada, donde el contenido no pasa por mediación "
                "editorial y no es rastreable públicamente. Los formatos cortos y verificables funcionan "
                "mejor que los textos largos."
            ),
        })
    if (p.get("pct_65") or 0) > (nac.get("pct_65") or 0) or (p.get("adig_65") or 0) > (nac.get("adig_65") or 0) + 3:
        r.append({
            "titulo": "Grupo prioritario: personas de 65 años y más",
            "texto": (
                f"El {p['adig_65']:.1f}% de este grupo es analfabeto digital en la provincia (nacional "
                f"{nac['adig_65']:.1f}%). Es el segmento con menor capacidad de contrastar lo que recibe "
                "por mensajería o televisión."
            ),
        })
    if (p.get("pct_rural") or 0) > (nac.get("pct_rural") or 0) + 6:
        r.append({
            "titulo": "Grupo prioritario: población rural",
            "texto": (
                f"El {p['pct_rural']:.1f}% de la provincia es rural y allí el uso de internet cae a "
                f"{p['net_rural']:.1f}% frente a {p['net_urbano']:.1f}% en el área urbana. Los medios "
                "locales y comunitarios son el canal efectivo."
            ),
        })
    etnias = [(l, p.get(k) or 0) for l, k in [("indígena", "et_indigena"), ("montubia", "et_montubio"), ("afroecuatoriana", "et_afro")] if (p.get(k) or 0) > 10]
    if etnias:
        r.append({
            "titulo": "Composición étnica relevante para el enfoque",
            "texto": (
                "La población que se autoidentifica como "
                + " y ".join(f"{l} ({v:.1f}%)" for l, v in etnias)
                + " tiene un peso muy superior al promedio nacional. Considere lengua, organizaciones y "
                "liderazgos propios en la estrategia de difusión."
            ),
        })
    if (p.get("desconfianza") or 0) > (nac.get("desconfianza") or 0):
        r.append({
            "titulo": "La fuente institucional no basta como respaldo",
            "texto": (
                f"El {p['desconfianza']:.1f}% de las personas declara poca o ninguna confianza en las "
                "instituciones. Citar una fuente oficial como única prueba puede resultar contraproducente: "
                "conviene combinarla con evidencia verificable de forma independiente y con voces locales "
                "creíbles."
            ),
        })
    if (p.get("conciencia") or 0) < (nac.get("conciencia") or 0):
        r.append({
            "titulo": "Baja conciencia del riesgo informativo",
            "texto": (
                f"Solo el {p['conciencia']:.1f}% percibe que circula información falsa en los medios que "
                f"consume, por debajo del {nac['conciencia']:.1f}% nacional. Explicitar cómo se verificó "
                "una información tiene aquí más valor pedagógico."
            ),
        })
    if (p.get("PRE") or 0) > (nac.get("PRE") or 0) + 5:
        r.append({
            "titulo": "Coyuntura sensible",
            "texto": (
                "Los indicadores de victimización, temor al delito y desconfianza electoral están sobre "
                f"el promedio (presión coyuntural {p['PRE']:.1f} sobre 100). Los rumores sobre seguridad y "
                "sobre integridad del voto tienen aquí terreno más fértil."
            ),
        })

    if not r:
        r.append({
            "titulo": "Sin alertas diferenciales",
            "texto": (
                "Los indicadores de la provincia se mantienen próximos al promedio nacional en todas las "
                "dimensiones. Aplican las buenas prácticas generales de verificación y comunicación "
                "multicanal."
            ),
        })
    return r


def perfil_completo(name: str) -> dict | None:
    p = get_province(name)
    nac = get_national()
    if p is None or nac is None:
        return None

    def meta(key):
        _, label, unit, source, direction = INDICATORS[key]
        return {"key": key, "label": label, "unit": unit, "source": source, "direction": direction, "valor": p.get(key), "nacional": nac.get(key)}

    return {
        "provincia": p["nombre"],
        "identificacion": {
            "poblacion": p.get("poblacion"),
            "poblacion_16mas": p.get("poblacion_16mas"),
            "densidad": p.get("densidad"),
            "superficie_km2": p.get("superficie_km2"),
            "pct_urbano": p.get("pct_urbano"),
            "pct_rural": p.get("pct_rural"),
        },
        "ivei": {
            "indice": p.get("IVEI"),
            "puesto": p.get("rank"),
            "nivel": p.get("nivel"),
            "nacional": nac.get("IVEI"),
        },
        "perfil_territorial": {"tipo": p.get("perfil"), "descripcion": p.get("perfil_desc")},
        "dimensiones": [
            {"codigo": code, "nombre": label, "color": color, "valor": p.get(code), "nacional": nac.get(code)}
            for code, label, color in DIMENSIONS
        ],
        "demografia": {
            "edades": [meta(k) for k in ["pct_0_14", "pct_15_29", "pct_30_44", "pct_45_64", "pct_65"]],
            "etnias": [meta(k) for k in ["et_mestizo", "et_indigena", "et_montubio", "et_afro", "et_blanco", "et_otro"]],
        },
        "digital": {
            "acceso": [meta(k) for k in ["uso_internet", "tic_internet_2024", "uso_celular", "analf_digital"]],
            "brecha": [meta(k) for k in ["net_urbano", "net_rural", "adig_65", "adig_rural"]],
            "mecanismo": {
                "exclusion": p.get("EXCLUSION"),
                "hiperexposicion": p.get("HIPEREXP"),
                "nacional_exclusion": nac.get("EXCLUSION"),
                "nacional_hiperexposicion": nac.get("HIPEREXP"),
                "nota": "Son dos mecanismos independientes: una provincia puede puntuar alto en ambos, en uno o en ninguno.",
            },
        },
        "dieta_informativa": {
            "plataformas": p.get("plataformas", {}),
            "usa_redes": meta("usa_redes"),
            "n_plataformas": meta("n_plataformas"),
            "mensajeria": meta("mensajeria"),
            "conciencia": meta("conciencia"),
            "percibe_falsa_por_medio": p.get("percibe_falsa_por_medio", {}),
            "advertencia": (
                "Estos porcentajes se calculan sobre las personas encuestadas por el Latinobarómetro, cuya "
                "muestra es predominantemente urbana y conectada; no son comparables con el uso de internet "
                "del Censo, que se mide sobre toda la población de 5 años y más. Las bases disponibles "
                "(Censo 2022, ENEMDU-TIC y Latinobarómetro 2024) no contienen preguntas sobre consumo de "
                "televisión, radio o prensa como fuente de información política, ni sobre fuentes "
                "interpersonales o comunitarias: esa parte del perfil queda pendiente de una encuesta "
                "específica."
                + (f" Estimación basada en {p['n_lb']} casos provinciales, suavizados hacia la media nacional." if p["n_lb"] > 0 else "")
            ),
        },
        "resiliencia": {
            "escolaridad": meta("escolaridad"),
            "componentes": [meta(k) for k in ["analf_digital", "conciencia", "conf_interp"]],
            "nota": "La resiliencia se mide como dimensión propia, no como inverso de la vulnerabilidad.",
        },
        "presion_coyuntural": {
            "componentes": [meta(k) for k in ["fraude", "victima", "temor", "narco", "corrupcion", "extremos"]],
            "nota": "Latinobarómetro 2024. Es la dimensión con datos más frágiles a nivel provincial.",
        },
        "socioeconomico": [meta(k) for k in ["pobreza_ingresos", "pobreza_extrema", "nbi", "gini", "escolaridad", "analfabetismo", "desconfianza", "ivd_original"]],
        "diagnostico": diagnostico(name),
        "recomendaciones_periodismo": recomendaciones_periodismo(name),
        "n_lb": p.get("n_lb"),
        "n_tic": p.get("n_tic"),
        "confiabilidad": p.get("confiabilidad"),
    }


COMPARE_KEYS = [
    "IVEI", "EST", "EXP", "RES", "PRE", "EXCLUSION", "HIPEREXP",
    "poblacion", "densidad", "pct_rural", "pct_65", "et_indigena", "et_montubio", "et_afro",
    "escolaridad", "analfabetismo", "analf_digital", "uso_internet", "tic_internet_2024",
    "uso_celular", "net_rural", "net_urbano", "usa_redes", "mensajeria", "n_plataformas",
    "conciencia", "desconfianza", "pobreza_ingresos", "pobreza_multi", "gini",
    "fraude", "victima", "extremos",
]


def comparar(a: str, b: str) -> dict | None:
    pa, pb, nac = get_province(a), get_province(b), get_national()
    if pa is None or pb is None or nac is None:
        return None

    filas = []
    for key in COMPARE_KEYS:
        _, label, unit, source, direction = INDICATORS[key]
        va, vb, n = pa.get(key), pb.get(key), nac.get(key)
        diff = (va - vb) if (va is not None and vb is not None) else None
        filas.append({"key": key, "label": label, "unit": unit, "source": source, "direction": direction, "a": va, "b": vb, "diferencia": diff, "nacional": n})

    return {
        "a": {"provincia": pa["nombre"], "ivei": pa.get("IVEI"), "nivel": pa.get("nivel"), "perfil": pa.get("perfil"), "perfil_desc": pa.get("perfil_desc"), "dimensiones": [{"codigo": c, "nombre": l, "color": col, "valor": pa.get(c)} for c, l, col in DIMENSIONS]},
        "b": {"provincia": pb["nombre"], "ivei": pb.get("IVEI"), "nivel": pb.get("nivel"), "perfil": pb.get("perfil"), "perfil_desc": pb.get("perfil_desc"), "dimensiones": [{"codigo": c, "nombre": l, "color": col, "valor": pb.get(c)} for c, l, col in DIMENSIONS]},
        "indicadores": filas,
    }


TABLE_KEYS = [
    "IVEI", "EST", "EXP", "RES", "PRE", "EXCLUSION", "HIPEREXP", "poblacion", "pct_rural", "pct_65",
    "escolaridad", "analfabetismo", "analf_digital", "uso_internet", "tic_internet_2024", "usa_redes",
    "conciencia", "desconfianza", "pobreza_ingresos", "gini", "fraude", "victima", "corrupcion",
]


def tabla_provincias() -> dict:
    columnas = [{"key": k, "label": INDICATORS[k][1], "unit": INDICATORS[k][2], "direction": INDICATORS[k][4]} for k in TABLE_KEYS]
    filas = []
    for rec in list_provinces():
        fila = {"provincia": rec["nombre"], "rank": rec["rank"], "nivel": rec["nivel"], "perfil": rec["perfil"]}
        fila.update({k: rec.get(k) for k in TABLE_KEYS})
        filas.append(fila)
    return {"columnas": columnas, "filas": filas, "nacional": {k: get_national().get(k) for k in TABLE_KEYS}}
