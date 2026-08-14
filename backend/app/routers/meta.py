from fastapi import APIRouter

from app.data.provinces import PROVINCE_REGION
from app.scoring import IVD_LAYER_WEIGHT, MEDIA_LAYER_WEIGHT, OUTLET_COUNT_VULNERABILITY

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/methodology")
def methodology():
    return {
        "description": (
            "Índice de Vulnerabilidad ante la Desinformación (IVD) por provincia "
            "ecuatoriana, combinando privación material, capital educativo y "
            "desconfianza institucional - los tres factores que la literatura "
            "asocia a mayor permeabilidad a contenidos falsos."
        ),
        "ivd_layer": {
            "source": "INEC 2024 (pobreza/desigualdad, educación) + Latinobarómetro 2024 Ecuador (n=1200)",
            "dimensions": {
                "D1. Socioeconómica": "Pobreza por ingresos, pobreza extrema, pobreza multidimensional, NBI, coeficiente de Gini",
                "D2. Educativa": "Analfabetismo, años promedio de escolaridad, asistencia neta secundaria y bachillerato",
                "D3. Desconfianza institucional": "Desconfianza suavizada en 9 instituciones (Latinobarómetro)",
            },
            "coverage": "23 de 24 provincias (Galápagos excluida: sin datos INEC de pobreza)",
            "imputation": "Napo, Pastaza y Zamora Chinchipe (n=0 en Latinobarómetro) usan un valor de desconfianza institucional imputado a nivel nacional, marcado como 'Sin muestra (imputado nacional)'.",
        },
        "media_layer": {
            "source": "Curado manualmente vía POST /api/media (vacío por defecto)",
            "outlet_count_vulnerability_curve": OUTLET_COUNT_VULNERABILITY,
            "notes": "score = 0.5 * diversity_vulnerability + 0.5 * (100 - avg_credibility)",
        },
        "composite": {
            "ivd_layer_weight": IVD_LAYER_WEIGHT,
            "media_layer_weight": MEDIA_LAYER_WEIGHT,
            "fallback": "Si no hay medios registrados para una provincia, el índice compuesto es el IVD solo.",
        },
        "province_regions": PROVINCE_REGION,
    }
