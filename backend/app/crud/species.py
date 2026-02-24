from sqlalchemy.orm import Session
from ..models.species import Species
from ..schemas.species import SpeciesCreate, SpeciesUpdate
from typing import Optional, List


def get_species(db: Session, species_id: int) -> Optional[Species]:
    return db.query(Species).filter(Species.id == species_id).first()


def get_species_by_name(db: Session, scientific_name: str) -> Optional[Species]:
    return db.query(Species).filter(Species.scientific_name == scientific_name).first()


def search_species(db: Session, q: str = "", skip: int = 0, limit: int = 20) -> List[Species]:
    query = db.query(Species)
    if q:
        query = query.filter(
            Species.scientific_name.ilike(f"%{q}%") |
            Species.common_name.ilike(f"%{q}%")
        )
    return query.order_by(Species.scientific_name).offset(skip).limit(limit).all()


def get_all_species(db: Session, skip: int = 0, limit: int = 100) -> List[Species]:
    return db.query(Species).order_by(Species.scientific_name).offset(skip).limit(limit).all()


def count_species(db: Session) -> int:
    return db.query(Species).count()


def create_species(db: Session, species: SpeciesCreate) -> Species:
    db_species = Species(**species.model_dump())
    db.add(db_species)
    db.commit()
    db.refresh(db_species)
    return db_species


def update_species(db: Session, species: Species, species_update: SpeciesUpdate) -> Species:
    update_data = species_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(species, field, value)
    db.commit()
    db.refresh(species)
    return species


def delete_species(db: Session, species: Species):
    db.delete(species)
    db.commit()
