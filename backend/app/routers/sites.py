from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.site import get_site, search_sites, get_all_sites, create_site, update_site, delete_site, get_site_by_name, validate_parent, descendant_ids, find_similar_sites, specimen_counts, merge_sites
from ..schemas.site import SiteRead, SiteCreate, SiteUpdate, DuplicateCheckRequest, DuplicateMatch, SiteMergeRequest
from ..schemas.specimen import SpecimenDetail
from ..models.user import User
from ..models.site import Site
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
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if q is not None:
        return search_sites(db, q, skip, limit, project_id, user=current_user)
    return get_all_sites(db, skip, limit, project_id, user=current_user)


@router.get("/counts")
def site_specimen_counts(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Specimens linked directly to each site, as {site_id: count}. Sum over children for rollups."""
    return specimen_counts(db)


@router.post("/check-duplicates", response_model=List[DuplicateMatch])
def check_duplicate_sites(
    body: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return find_similar_sites(
        db, body.name, body.parent_id, body.lat, body.lon, body.radius_m,
        exclude_id=body.exclude_id, user=current_user,
    )


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
            if get_site_by_name(db, row.name, any_parent=True):
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
    _: User = Depends(get_current_user),
):
    err = validate_parent(db, None, site.parent_id)
    if err:
        raise HTTPException(status_code=400, detail=err)
    if get_site_by_name(db, site.name, site.parent_id):
        raise HTTPException(status_code=400, detail="A site with this name already exists at this level")
    try:
        return create_site(db, site)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A site with this name already exists at this level")


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
    _: User = Depends(get_current_user),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    fields = site_update.model_fields_set
    new_parent = site_update.parent_id if "parent_id" in fields else site.parent_id
    if "parent_id" in fields:
        err = validate_parent(db, site.id, new_parent)
        if err:
            raise HTTPException(status_code=400, detail=err)
    new_name = site_update.name if site_update.name is not None else site.name
    if ("parent_id" in fields or "name" in fields):
        clash = get_site_by_name(db, new_name, new_parent)
        if clash and clash.id != site.id:
            raise HTTPException(status_code=400, detail="A site with this name already exists at this level")
    try:
        return update_site(db, site, site_update)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A site with this name already exists at this level")


@router.post("/{site_id}/merge", response_model=SiteRead)
def merge_site(
    site_id: int,
    body: SiteMergeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Merge this (duplicate) site into target_id: specimens, sub-sites and project tags move across."""
    source = get_site(db, site_id)
    target = get_site(db, body.target_id)
    if not source or not target:
        raise HTTPException(status_code=404, detail="Site not found")
    if source.id == target.id:
        raise HTTPException(status_code=400, detail="Cannot merge a site into itself")
    if target.id in descendant_ids(db, source.id):
        raise HTTPException(status_code=400, detail="Cannot merge a site into one of its own sub-sites")
    target_id = target.id
    try:
        merge_sites(db, source, target)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Merge would create two sub-sites with the same name under the target; rename one first")
    return get_site(db, target_id)


@router.get("/{site_id}/specimens", response_model=List[SpecimenDetail])
def list_specimens_for_site(
    site_id: int,
    include_children: bool = True,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    site = get_site(db, site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    ids = {site_id} | (descendant_ids(db, site_id) if include_children else set())
    return (
        db.query(Specimen)
        .filter(Specimen.sites.any(Site.id.in_(ids)))
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
    try:
        delete_site(db, site)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot delete: its sub-sites would clash by name with siblings at the parent level. Rename or merge them first")
    return {"message": "Site deleted"}
