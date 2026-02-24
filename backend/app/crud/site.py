from sqlalchemy.orm import Session
from ..models.site import Site
from ..schemas.site import SiteCreate, SiteUpdate
from typing import Optional, List


def get_all_sites(db: Session, skip: int = 0, limit: int = 200) -> List[Site]:
    return db.query(Site).order_by(Site.name).offset(skip).limit(limit).all()


def search_sites(db: Session, q: str, skip: int = 0, limit: int = 50) -> List[Site]:
    return (
        db.query(Site)
        .filter(Site.name.ilike(f"%{q}%") | Site.description.ilike(f"%{q}%"))
        .order_by(Site.name)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_site(db: Session, site_id: int) -> Optional[Site]:
    return db.query(Site).filter(Site.id == site_id).first()


def get_site_by_name(db: Session, name: str) -> Optional[Site]:
    return db.query(Site).filter(Site.name == name).first()


def create_site(db: Session, site: SiteCreate) -> Site:
    db_site = Site(**site.model_dump())
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


def update_site(db: Session, site: Site, updates: SiteUpdate) -> Site:
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(site, field, value)
    db.commit()
    db.refresh(site)
    return site


def delete_site(db: Session, site: Site):
    db.delete(site)
    db.commit()
