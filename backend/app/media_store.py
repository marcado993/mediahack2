"""
Persistence for the media-ecosystem layer (Capas 1 & 2 of the original
concept: which outlets cover a province, and how credible each one is).

No real outlet is pre-loaded here. Latinobarometro microdata tells us
nothing about specific TV/radio/newspaper names, and inventing credibility
claims about real, named Ecuadorian media would be unverified and
reputationally risky. This store starts empty; the team fills it in during
the hackathon (manually, or from a source like Ecuador Chequea / CORDICOM /
ARCOTEL registries) via the /media API.

Backed by a single JSON file for hackathon simplicity - swap for a real
database if this goes beyond a demo.
"""
from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Optional

STORE_PATH = Path(__file__).parent / "data" / "media_outlets.json"

# Credibility rubric: 5 boolean criteria, weighted to sum to 100 points.
# Judges/teammates can see exactly why an outlet scored what it scored.
CREDIBILITY_WEIGHTS = {
    "cites_official_sources": 25,
    "separates_opinion_from_facts": 25,
    "has_public_editorial_policy": 20,
    "corrects_errors_publicly": 15,
    "not_previously_flagged_by_factcheckers": 15,
}


def compute_credibility_score(criteria: dict) -> float:
    score = 0
    for key, weight in CREDIBILITY_WEIGHTS.items():
        if criteria.get(key):
            score += weight
    return float(score)


class MediaStore:
    def __init__(self, path: Path = STORE_PATH):
        self._path = path
        self._lock = threading.Lock()
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._write([])

    def _read(self) -> list[dict]:
        with self._path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def _write(self, records: list[dict]) -> None:
        with self._path.open("w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

    def list_all(self) -> list[dict]:
        with self._lock:
            return self._read()

    def list_for_province(self, province: str) -> list[dict]:
        return [o for o in self.list_all() if o["province"] == province]

    def get(self, outlet_id: int) -> Optional[dict]:
        return next((o for o in self.list_all() if o["id"] == outlet_id), None)

    def add(self, province: str, name: str, outlet_type: str, criteria: dict) -> dict:
        with self._lock:
            records = self._read()
            next_id = (max((o["id"] for o in records), default=0)) + 1
            record = {
                "id": next_id,
                "province": province,
                "name": name,
                "type": outlet_type,  # "tv" | "radio" | "newspaper" | "online" | "other"
                "criteria": criteria,
                "credibility_score": compute_credibility_score(criteria),
            }
            records.append(record)
            self._write(records)
            return record

    def delete(self, outlet_id: int) -> bool:
        with self._lock:
            records = self._read()
            filtered = [o for o in records if o["id"] != outlet_id]
            if len(filtered) == len(records):
                return False
            self._write(filtered)
            return True
