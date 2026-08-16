"""
Segmented views over the richer IVEI dataset (app/ivei.py) - mapa / perfil /
comparar / tabla, modeled on the reference observatory the team shared.
Additive: doesn't touch app/ivd.py or anything /api/provinces depends on.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app import habilidades_digitales, ivei

router = APIRouter(prefix="/api/segmentadores", tags=["segmentadores"])


@router.get("/provincias")
def provincias():
    return {"provincias": [p["nombre"] for p in ivei.list_provinces()]}


@router.get("/mapa")
def mapa():
    hd = habilidades_digitales.load_habilidades_digitales()
    provincias = []
    for p in ivei.list_provinces():
        hd_rec = hd.get(p["nombre"])
        provincias.append(
            {
                "provincia": p["nombre"],
                "rank": p["rank"],
                "nivel": p["nivel"],
                "perfil": p["perfil"],
                "IVEI": p["IVEI"],
                "EST": p["EST"],
                "EXP": p["EXP"],
                "RES": p["RES"],
                "PRE": p["PRE"],
                "EXCLUSION": p["EXCLUSION"],
                "HIPEREXP": p["HIPEREXP"],
                "poblacion": p["poblacion"],
                "n_lb": p["n_lb"],
                "HABDIG": hd_rec["score"] if hd_rec else None,
                "HABDIG_n": hd_rec["n"] if hd_rec else 0,
            }
        )
    return {"capas": [{"codigo": c, "nombre": n, "color": col} for c, n, col in ivei.DIMENSIONS] + [
        {"codigo": "IVEI", "nombre": "Vulnerabilidad electoral integrada", "color": "#b23a2e"},
        {"codigo": "EXCLUSION", "nombre": "Exclusión digital", "color": "#1d6a96"},
        {"codigo": "HIPEREXP", "nombre": "Hiperexposición digital", "color": "#b3541e"},
        {"codigo": "HABDIG", "nombre": "Habilidades digitales", "color": "#0e7c86"},
    ], "provincias": provincias, "nacional": ivei.get_national()}


@router.get("/perfil/{provincia}")
def perfil(provincia: str):
    result = ivei.perfil_completo(provincia)
    if result is None:
        raise HTTPException(status_code=404, detail=f"No hay datos IVEI para '{provincia}'")
    return result


@router.get("/comparar")
def comparar(a: str, b: str):
    result = ivei.comparar(a, b)
    if result is None:
        raise HTTPException(status_code=404, detail="Alguna de las provincias no tiene datos IVEI")
    return result


@router.get("/tabla")
def tabla():
    return ivei.tabla_provincias()


@router.get("/metodologia")
def metodologia():
    return {
        "descripcion": (
            "Índice de Vulnerabilidad Electoral Informativa (IVEI) - segunda generación del IVD, "
            "que integra cuatro dimensiones en lugar de tres: vulnerabilidad estructural, exposición "
            "informativa, resiliencia informativa y presión coyuntural."
        ),
        "dimensiones": {
            "Vulnerabilidad estructural": "Condiciones socioeconómicas, educativas y de acceso digital de base (INEC).",
            "Exposición informativa": "Uso de plataformas digitales y de circulación rápida (Facebook, WhatsApp, TikTok).",
            "Resiliencia informativa": "Escolaridad, alfabetización digital, percepción del riesgo informativo y diversidad de fuentes - medida como dimensión propia, no como el inverso de la vulnerabilidad.",
            "Presión coyuntural": "Victimización, temor al delito, percepción de fraude electoral, narcotráfico, corrupción y polarización (Latinobarómetro 2024) - la capa más dinámica, pensada para actualizarse ante cada elección.",
        },
        "mecanismos_digitales": {
            "Exclusión digital": "Provincias donde la vulnerabilidad viene sobre todo de la falta de acceso.",
            "Hiperexposición digital": "Provincias con alto consumo de plataformas de circulación rápida y baja capacidad de contraste. Son mecanismos independientes: una provincia puede puntuar alto en ambos, en uno o en ninguno.",
        },
        "fuentes": [
            "Censo de Población y Vivienda 2022 (INEC)",
            "ENEMDU y ENEMDU-TIC 2024 (INEC)",
            "Latinobarómetro 2024 Ecuador",
        ],
        "cobertura": "24 provincias + Galápagos, más un valor nacional agregado.",
        "limitaciones": (
            "El componente de dieta informativa se reconstruye únicamente en su parte digital: las bases "
            "disponibles no preguntan por consumo de TV, radio o prensa como fuente política, ni por "
            "fuentes interpersonales o comunitarias. Provincias sin muestra propia del Latinobarómetro "
            "(n=0) usan el promedio nacional imputado para confianza, dieta informativa y presión "
            "coyuntural, y quedan marcadas como tal en cada respuesta."
        ),
        "advertencia": (
            "El diagnóstico y las recomendaciones por provincia se generan por reglas a partir de la "
            "comparación con el promedio nacional - no son una evaluación de personas, medios ni "
            "candidatos, y no deben leerse como tal."
        ),
    }
