from fastapi import APIRouter, HTTPException

from app import ivd, scoring
from app.media_store import MediaStore
from app.schemas import ProvinceDetail, ProvinceSummary

router = APIRouter(prefix="/api/provinces", tags=["provinces"])
store = MediaStore()

LOW_CONFIDENCE_PREFIXES = ("Baja", "Sin muestra")


def _low_confidence(confiabilidad: str) -> bool:
    return confiabilidad.startswith(LOW_CONFIDENCE_PREFIXES)


@router.get("", response_model=list[ProvinceSummary])
def list_provinces():
    results = []
    for record in ivd.list_provinces():
        idx = scoring.compute_vulnerability_index(record, store)
        results.append(
            ProvinceSummary(
                province=record["province"],
                ranking=record["ranking"],
                nivel=record["nivel"],
                ivd=record["ivd"],
                n_latinobarometro=record["n_latinobarometro"],
                confiabilidad_muestra=record["confiabilidad_muestra"],
                low_confidence=_low_confidence(record["confiabilidad_muestra"]),
                vulnerability_index=idx["vulnerability_index"],
                media_data_available=idx["media_data_available"],
            )
        )
    return sorted(results, key=lambda r: (r.vulnerability_index or 0), reverse=True)


@router.get("/{province}", response_model=ProvinceDetail)
def get_province(province: str):
    record = ivd.get_province(province)
    if record is None:
        raise HTTPException(status_code=404, detail=f"No hay IVD calculado para '{province}'")

    idx = scoring.compute_vulnerability_index(record, store)
    return ProvinceDetail(
        province=record["province"],
        ranking=record["ranking"],
        nivel=record["nivel"],
        ivd=record["ivd"],
        n_latinobarometro=record["n_latinobarometro"],
        confiabilidad_muestra=record["confiabilidad_muestra"],
        low_confidence=_low_confidence(record["confiabilidad_muestra"]),
        vulnerability_index=idx["vulnerability_index"],
        media_data_available=idx["media_data_available"],
        d1_socioeconomica=record["d1_socioeconomica"],
        d2_educativa=record["d2_educativa"],
        d3_desconfianza_institucional=record["d3_desconfianza_institucional"],
        d3_desconfianza_bruta_pct=record.get("d3_desconfianza_bruta_pct"),
        d3_desconfianza_suavizada_pct=record.get("d3_desconfianza_suavizada_pct"),
        d1_subindicadores=record.get("d1_subindicadores", {}),
        d2_subindicadores=record.get("d2_subindicadores", {}),
        d1_subindicadores_bruto=record.get("d1_subindicadores_bruto", {}),
        d2_subindicadores_bruto=record.get("d2_subindicadores_bruto", {}),
        desconfianza_por_institucion=record.get("desconfianza_por_institucion", {}),
        media_layer=idx["media_layer"],
    )
