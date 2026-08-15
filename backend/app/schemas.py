from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ProvinceSummary(BaseModel):
    province: str
    ranking: Optional[int]
    nivel: Optional[str]
    ivd: Optional[float]
    n_latinobarometro: int
    confiabilidad_muestra: str
    low_confidence: bool
    vulnerability_index: Optional[float]
    media_data_available: bool


class ProvinceDetail(ProvinceSummary):
    d1_socioeconomica: Optional[float]
    d2_educativa: Optional[float]
    d3_desconfianza_institucional: Optional[float]
    d3_desconfianza_bruta_pct: Optional[float] = None
    d3_desconfianza_suavizada_pct: Optional[float] = None
    d1_subindicadores: dict = {}
    d2_subindicadores: dict = {}
    d1_subindicadores_bruto: dict = {}
    d2_subindicadores_bruto: dict = {}
    desconfianza_por_institucion: dict = {}
    media_layer: dict


class MediaCriteria(BaseModel):
    cites_official_sources: bool = False
    separates_opinion_from_facts: bool = False
    has_public_editorial_policy: bool = False
    corrects_errors_publicly: bool = False
    not_previously_flagged_by_factcheckers: bool = False


class MediaOutletCreate(BaseModel):
    province: str
    name: str
    type: str = Field(pattern="^(tv|radio|newspaper|online|other)$")
    criteria: MediaCriteria


class MediaOutlet(BaseModel):
    id: int
    province: str
    name: str
    type: str
    criteria: dict
    credibility_score: float
