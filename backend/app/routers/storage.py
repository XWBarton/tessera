from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.storage import (
    get_unit, get_all_units, create_unit, update_unit, delete_unit,
    get_tray, get_all_trays, create_tray, update_tray, delete_tray,
    get_tray_occupants,
)
from ..schemas.storage import (
    StorageUnitRead, StorageUnitCreate, StorageUnitUpdate,
    StorageTrayRead, StorageTrayCreate, StorageTrayUpdate,
    StorageTrayPosition, StorageOccupant,
)
from ..models.user import User
from typing import List, Optional

router = APIRouter(prefix="/storage", tags=["storage"])


def _occupant_label(specimen) -> str:
    primary = next((a for a in specimen.species_associations if a.is_primary), None) or (
        specimen.species_associations[0] if specimen.species_associations else None
    )
    if not primary:
        return ""
    return primary.species.scientific_name if primary.species else (primary.free_text_species or "")


@router.get("/units", response_model=List[StorageUnitRead])
def list_units(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return get_all_units(db)


@router.post("/units", response_model=StorageUnitRead)
def create_new_unit(
    unit: StorageUnitCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    return create_unit(db, unit)


@router.put("/units/{unit_id}", response_model=StorageUnitRead)
def update_existing_unit(
    unit_id: int, unit_update: StorageUnitUpdate,
    db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    unit = get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Storage unit not found")
    return update_unit(db, unit, unit_update)


@router.delete("/units/{unit_id}")
def delete_existing_unit(
    unit_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    unit = get_unit(db, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Storage unit not found")
    delete_unit(db, unit)
    return {"message": "Storage unit deleted"}


@router.get("/trays", response_model=List[StorageTrayRead])
def list_trays(
    unit_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_all_trays(db, unit_id)


@router.post("/trays", response_model=StorageTrayRead)
def create_new_tray(
    tray: StorageTrayCreate, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    if not get_unit(db, tray.unit_id):
        raise HTTPException(status_code=404, detail="Storage unit not found")
    return create_tray(db, tray)


@router.get("/trays/{tray_id}", response_model=StorageTrayRead)
def read_tray(tray_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    tray = get_tray(db, tray_id)
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    return tray


@router.put("/trays/{tray_id}", response_model=StorageTrayRead)
def update_existing_tray(
    tray_id: int, tray_update: StorageTrayUpdate,
    db: Session = Depends(get_db), _: User = Depends(require_admin),
):
    tray = get_tray(db, tray_id)
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    return update_tray(db, tray, tray_update)


@router.delete("/trays/{tray_id}")
def delete_existing_tray(
    tray_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)
):
    tray = get_tray(db, tray_id)
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    delete_tray(db, tray)
    return {"message": "Tray deleted"}


@router.get("/trays/{tray_id}/positions", response_model=List[StorageTrayPosition])
def read_tray_positions(
    tray_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)
):
    tray = get_tray(db, tray_id)
    if not tray:
        raise HTTPException(status_code=404, detail="Tray not found")
    occupants = get_tray_occupants(db, tray_id)
    return [
        StorageTrayPosition(
            position=pos,
            occupants=[
                StorageOccupant(
                    id=s.id,
                    specimen_code=s.specimen_code,
                    project_code=s.project.code if s.project else "",
                    species=_occupant_label(s),
                )
                for s in occupants.get(pos, [])
            ],
        )
        for pos in range(1, tray.capacity + 1)
    ]
