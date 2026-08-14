from fastapi import APIRouter, HTTPException

from app import ivd
from app.media_store import MediaStore
from app.schemas import MediaOutlet, MediaOutletCreate

router = APIRouter(prefix="/api/media", tags=["media"])
store = MediaStore()

# Must match the province spelling ivd.py returns (e.g. "Santo Domingo",
# not "Santo Domingo de los Tsáchilas") - scoring.py looks up media outlets
# by that exact string when blending the composite index.
VALID_PROVINCES = {r["province"] for r in ivd.list_provinces()}


@router.get("", response_model=list[MediaOutlet])
def list_media(province: str | None = None):
    return store.list_for_province(province) if province else store.list_all()


@router.post("", response_model=MediaOutlet, status_code=201)
def create_media(outlet: MediaOutletCreate):
    if outlet.province not in VALID_PROVINCES:
        raise HTTPException(
            status_code=422,
            detail=f"'{outlet.province}' is not one of Ecuador's 24 provinces",
        )
    record = store.add(
        province=outlet.province,
        name=outlet.name,
        outlet_type=outlet.type,
        criteria=outlet.criteria.model_dump(),
    )
    return record


@router.delete("/{outlet_id}", status_code=204)
def delete_media(outlet_id: int):
    if not store.delete(outlet_id):
        raise HTTPException(status_code=404, detail="Outlet not found")
