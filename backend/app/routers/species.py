import csv
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.species import (
    get_species,
    search_species,
    get_all_species,
    create_species,
    update_species,
    delete_species,
    get_species_by_name,
    bulk_create_species,
)
from ..schemas.species import SpeciesRead, SpeciesCreate, SpeciesUpdate
from ..models.user import User
from typing import List, Optional

router = APIRouter(prefix="/species", tags=["species"])


@router.get("/", response_model=List[SpeciesRead])
def list_species(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if q is not None:
        return search_species(db, q, skip, limit)
    return get_all_species(db, skip, limit)


@router.post("/", response_model=SpeciesRead)
def create_new_species(
    species: SpeciesCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if get_species_by_name(db, species.scientific_name):
        raise HTTPException(
            status_code=400,
            detail="Species with this scientific name already exists",
        )
    return create_species(db, species)


@router.get("/{species_id}", response_model=SpeciesRead)
def read_species(
    species_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    species = get_species(db, species_id)
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    return species


@router.put("/{species_id}", response_model=SpeciesRead)
def update_existing_species(
    species_id: int,
    species_update: SpeciesUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    species = get_species(db, species_id)
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    return update_species(db, species, species_update)


@router.post("/bulk-import")
async def bulk_import_species(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handles BOM from Excel
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None or "scientific_name" not in [f.strip() for f in reader.fieldnames]:
        raise HTTPException(
            status_code=400,
            detail="CSV must have a 'scientific_name' column",
        )

    # Normalise header names in case of leading/trailing spaces
    rows = [{k.strip(): v for k, v in row.items()} for row in reader]
    result = bulk_create_species(db, rows)
    return result


@router.delete("/{species_id}")
def delete_existing_species(
    species_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    species = get_species(db, species_id)
    if not species:
        raise HTTPException(status_code=404, detail="Species not found")
    delete_species(db, species)
    return {"message": "Species deleted"}
