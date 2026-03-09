from sqlalchemy.orm import Session
from ..models.site import Site
from ..models.project import Project
from ..schemas.site import SiteCreate, SiteUpdate
from typing import Optional, List


def _set_projects(db: Session, site: Site, project_ids: List[int]):
    if project_ids:
        site.projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    else:
        site.projects = []


def get_all_sites(db: Session, skip: int = 0, limit: int = 200, project_id: Optional[int] = None) -> List[Site]:
    q = db.query(Site)
    if project_id is not None:
        q = q.filter(Site.projects.any(id=project_id))
    return q.order_by(Site.name).offset(skip).limit(limit).all()


def search_sites(db: Session, q: str, skip: int = 0, limit: int = 50, project_id: Optional[int] = None) -> List[Site]:
    query = (
        db.query(Site)
        .filter(Site.name.ilike(f"%{q}%") | Site.description.ilike(f"%{q}%"))
    )
    if project_id is not None:
        query = query.filter(Site.projects.any(id=project_id))
    return query.order_by(Site.name).offset(skip).limit(limit).all()


def get_site(db: Session, site_id: int) -> Optional[Site]:
    return db.query(Site).filter(Site.id == site_id).first()


def get_site_by_name(db: Session, name: str) -> Optional[Site]:
    return db.query(Site).filter(Site.name == name).first()


def create_site(db: Session, site: SiteCreate) -> Site:
    db_site = Site(**site.model_dump(exclude={'project_ids'}))
    _set_projects(db, db_site, site.project_ids)
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


def update_site(db: Session, site: Site, updates: SiteUpdate) -> Site:
    data = updates.model_dump(exclude_unset=True, exclude={'project_ids'})
    for field, value in data.items():
        setattr(site, field, value)
    if 'project_ids' in updates.model_fields_set:
        _set_projects(db, site, updates.project_ids or [])
    db.commit()
    db.refresh(site)
    return site


def delete_site(db: Session, site: Site):
    db.delete(site)
    db.commit()
