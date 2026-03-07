from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.site import get_site, search_sites, get_all_sites, create_site, update_site, delete_site, get_site_by_name
from ..schemas.site import SiteRead, SiteCreate, SiteUpdate
from ..schemas.specimen import SpecimenDetail
from ..models.user import User
from ..models.specimen import Specimen
from ..models.specimen_species import SpecimenSpecies
from pydantic import BaseModel
from typing import List, Optional


class SiteBulkImportRow(BaseModel):
    name: str
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    precision: Optional[str] = None
    notes: Optional[str] = None


class SiteBulkImportRequest(BaseModel):
    rows: List[SiteBulkImportRow]


class SiteBulkImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[str]

router = APIRouter(prefix="/sites", tags=["sites"])


@router.get("/", response_model=List[SiteRead])
def list_sites(
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if q is not None:
        return search_sites(db, q, skip, limit)
    return get_all_sites(db, skip, limit)


@router.post("/bulk-import", response_model=SiteBulkImportResult)
def bulk_import_sites(
    body: SiteBulkImportRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    created = 0
    skipped = 0
    errors: List[str] = []
    for row in body.rows:
        if not row.name:
            errors.append("Row skipped: name is required")
            continue
        try:
            if get_site_by_name(db, row.name):
                skipped += 1
                continue
            create_site(db, SiteCreate(
                name=row.name,
                description=row.description,
                habitat_type=row.habitat_type,
                lat=row.lat,
                lon=row.lon,
                precision=row.precision,
                notes=row.notes,
            ))
            created += 1
        except Exception as e:
            errors.append(f"{row.name}: {e}")
    return {"created": created, "skipped": skipped, "errors": errors}


@router.post("/", response_model=SiteRead)
def create_new_site(
    site: SiteCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if get_site_by_name(db, site.name):
        raise HTTPException(status_code=400, detail="A site with this name already exists")
    return create_site(db, site)


@router.get("/{site_id}", response_model=SiteRead)
def read_site(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return site


@router.put("/{site_id}", response_model=SiteRead)
def update_existing_site(
    site_id: int,
    site_update: SiteUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return update_site(db, site, site_update)


@router.get("/{site_id}/specimens", response_model=List[SpecimenDetail])
def list_specimens_for_site(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    return (
        db.query(Specimen)
        .filter(Specimen.sites.any(id=site_id))
        .options(
            joinedload(Specimen.project),
            joinedload(Specimen.collector),
            joinedload(Specimen.sites),
            joinedload(Specimen.sample_type),
            joinedload(Specimen.species_associations).joinedload(SpecimenSpecies.species),
        )
        .all()
    )


@router.delete("/{site_id}")
def delete_existing_site(
    site_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    delete_site(db, site)
    return {"message": "Site deleted"}
