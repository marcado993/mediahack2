"""
Mapping from Latinobarometro REG codes (country prefix 218 = Ecuador) to
Ecuador's 24 provinces, in the alphabetical order Latinobarometro uses for
its regional/province variable.

Confirmed against the source files two ways:
- Sample sizes per code in the microdata line up with known population
  ranking (218010 = 304 resp. -> Guayas, the most populous province;
  218019 = 232 resp. -> Pichincha, the second most populous).
- The tail of the alphabetical listing printed in the codebook PDF
  ("Santo Domingo de los Tsachilas", "Sucumbios", "Tungurahua", in that
  order) matches codes 218021-218023 here.

Provinces absent from the 1200-respondent sample (no rows in the CSV):
Galapagos (09), Napo (16), Pastaza (18), Zamora Chinchipe (24) - all
low-population provinces, consistent with a national sample of this size.
These four will not appear in /api/provinces output at all, since there is
no data to aggregate.
"""

REG_TO_PROVINCE = {
    218001: "Azuay",
    218002: "Bolívar",
    218003: "Cañar",
    218004: "Carchi",
    218005: "Cotopaxi",
    218006: "Chimborazo",
    218007: "El Oro",
    218008: "Esmeraldas",
    218009: "Galápagos",
    218010: "Guayas",
    218011: "Imbabura",
    218012: "Loja",
    218013: "Los Ríos",
    218014: "Manabí",
    218015: "Morona Santiago",
    218016: "Napo",
    218017: "Orellana",
    218018: "Pastaza",
    218019: "Pichincha",
    218020: "Santa Elena",
    218021: "Santo Domingo de los Tsáchilas",
    218022: "Sucumbíos",
    218023: "Tungurahua",
    218024: "Zamora Chinchipe",
}

# Macro-region grouping, used for optional roll-up views.
PROVINCE_REGION = {
    "Azuay": "Sierra", "Bolívar": "Sierra", "Cañar": "Sierra", "Carchi": "Sierra",
    "Cotopaxi": "Sierra", "Chimborazo": "Sierra", "Imbabura": "Sierra", "Loja": "Sierra",
    "Pichincha": "Sierra", "Tungurahua": "Sierra", "Santo Domingo de los Tsáchilas": "Sierra",
    "El Oro": "Costa", "Esmeraldas": "Costa", "Guayas": "Costa", "Los Ríos": "Costa",
    "Manabí": "Costa", "Santa Elena": "Costa",
    "Morona Santiago": "Amazonía", "Napo": "Amazonía", "Orellana": "Amazonía",
    "Pastaza": "Amazonía", "Sucumbíos": "Amazonía", "Zamora Chinchipe": "Amazonía",
    "Galápagos": "Insular",
}


def province_name(reg_code) -> str:
    code = int(float(reg_code))
    return REG_TO_PROVINCE.get(code, f"Desconocido ({code})")
