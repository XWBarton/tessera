from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.site import get_site, search_sites, get_all_sites, create_site, update_site, delete_site, get_site_by_name
from ..schemas.site import SiteRead, SiteCreate, SiteUpdate
from ..models.user import User
from typing import List, Optional

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
