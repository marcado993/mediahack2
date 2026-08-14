"""
Blends the curated IVD (see app/ivd.py) with the optional media-ecosystem
layer registered via /api/media. The IVD itself is the authoritative,
documented composite (INEC socioeconomic + educational data blended with
Latinobarometro institutional trust) - this module's only remaining job is
folding in outlet-diversity/credibility data when a province has any
registered, and falling back to the IVD alone otherwise.
"""
from __future__ import annotations

from app.media_store import MediaStore

IVD_LAYER_WEIGHT = 0.6
MEDIA_LAYER_WEIGHT = 0.4

OUTLET_COUNT_VULNERABILITY = {0: 100.0, 1: 100.0, 2: 70.0, 3: 50.0, 4: 30.0}
OUTLET_COUNT_VULNERABILITY_FLOOR = 10.0


def compute_media_layer(province: str, store: MediaStore) -> dict:
    outlets = store.list_for_province(province)
    n = len(outlets)
    if n == 0:
        return {"outlet_count": 0, "avg_credibility": None, "score": None}

    diversity_vuln = OUTLET_COUNT_VULNERABILITY.get(n, OUTLET_COUNT_VULNERABILITY_FLOOR)
    avg_credibility = sum(o["credibility_score"] for o in outlets) / n
    credibility_deficit = 100.0 - avg_credibility
    score = round(0.5 * diversity_vuln + 0.5 * credibility_deficit, 1)

    return {
        "outlet_count": n,
        "avg_credibility": round(avg_credibility, 1),
        "diversity_vulnerability": round(diversity_vuln, 1),
        "credibility_deficit": round(credibility_deficit, 1),
        "score": score,
    }


def compute_vulnerability_index(ivd_record: dict, store: MediaStore) -> dict:
    media = compute_media_layer(ivd_record["province"], store)
    ivd_score = ivd_record["ivd"]

    if media["score"] is not None and ivd_score is not None:
        composite = round(IVD_LAYER_WEIGHT * ivd_score + MEDIA_LAYER_WEIGHT * media["score"], 1)
    else:
        composite = ivd_score

    return {
        "vulnerability_index": composite,
        "media_data_available": media["score"] is not None,
        "media_layer": media,
    }
