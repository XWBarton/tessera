from sqlalchemy.orm import Session
from ..models.site import Site
from ..models.project import Project
from ..schemas.site import SiteCreate, SiteUpdate
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from ..models.user import User


def _set_projects(db: Session, site: Site, project_ids: List[int]):
    if project_ids:
        site.projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    else:
        site.projects = []


def _site_visible(site: Site, user: "User") -> bool:
    """Return False if every associated project is protected and the user has no access to any."""
    if user.is_admin:
        return True
    if not site.projects:
        return True  # untagged site — visible to everyone
    accessible = [
        p for p in site.projects
        if not p.is_protected or any(u.id == user.id for u in p.allowed_users)
    ]
    return len(accessible) > 0


def get_all_sites(db: Session, skip: int = 0, limit: int = 200, project_id: Optional[int] = None, user: Optional["User"] = None) -> List[Site]:
    q = db.query(Site)
    if project_id is not None:
        q = q.filter(Site.projects.any(id=project_id))
    sites = q.order_by(Site.name).offset(skip).limit(limit).all()
    if user is not None:
        sites = [s for s in sites if _site_visible(s, user)]
    return sites


def search_sites(db: Session, q: str, skip: int = 0, limit: int = 50, project_id: Optional[int] = None, user: Optional["User"] = None) -> List[Site]:
    query = (
        db.query(Site)
        .filter(Site.name.ilike(f"%{q}%") | Site.description.ilike(f"%{q}%"))
    )
    if project_id is not None:
        query = query.filter(Site.projects.any(id=project_id))
    sites = query.order_by(Site.name).offset(skip).limit(limit).all()
    if user is not None:
        sites = [s for s in sites if _site_visible(s, user)]
    return sites


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
