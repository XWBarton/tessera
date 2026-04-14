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


def bulk_create_species(db: Session, rows: list[dict]) -> dict:
    created = 0
    skipped = 0
    errors = []

    for i, row in enumerate(rows, start=1):
        scientific_name = (row.get("scientific_name") or "").strip()
        if not scientific_name:
            errors.append(f"Row {i}: missing scientific_name")
            continue
        if get_species_by_name(db, scientific_name):
            skipped += 1
            continue
        try:
            db_species = Species(
                scientific_name=scientific_name,
                common_name=(row.get("common_name") or "").strip() or None,
                genus=(row.get("genus") or "").strip() or None,
                family=(row.get("family") or "").strip() or None,
                order_name=(row.get("order_name") or "").strip() or None,
                taxon_id=(row.get("taxon_id") or "").strip() or None,
                notes=(row.get("notes") or "").strip() or None,
            )
            db.add(db_species)
            db.commit()
            created += 1
        except Exception as e:
            db.rollback()
            errors.append(f"Row {i} ({scientific_name}): {str(e)}")

    return {"created": created, "skipped": skipped, "errors": errors}
