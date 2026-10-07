from sqlalchemy.orm import Session, joinedload
from ..models.storage import StorageUnit, StorageTray
from ..models.specimen import Specimen
from ..models.specimen_species import SpecimenSpecies
from ..schemas.storage import StorageUnitCreate, StorageUnitUpdate, StorageTrayCreate, StorageTrayUpdate
from typing import Optional, List, Dict


def get_unit(db: Session, unit_id: int) -> Optional[StorageUnit]:
    return db.query(StorageUnit).filter(StorageUnit.id == unit_id).first()


def get_all_units(db: Session) -> List[StorageUnit]:
    return db.query(StorageUnit).order_by(StorageUnit.name).all()


def create_unit(db: Session, unit: StorageUnitCreate) -> StorageUnit:
    db_unit = StorageUnit(**unit.model_dump())
    db.add(db_unit)
    db.commit()
    db.refresh(db_unit)
    return db_unit


def update_unit(db: Session, unit: StorageUnit, unit_update: StorageUnitUpdate) -> StorageUnit:
    for field, value in unit_update.model_dump(exclude_unset=True).items():
        setattr(unit, field, value)
    db.commit()
    db.refresh(unit)
    return unit


def delete_unit(db: Session, unit: StorageUnit):
    db.delete(unit)
    db.commit()


def get_tray(db: Session, tray_id: int) -> Optional[StorageTray]:
    return (
        db.query(StorageTray)
        .options(joinedload(StorageTray.unit))
        .filter(StorageTray.id == tray_id)
        .first()
    )


def get_all_trays(db: Session, unit_id: Optional[int] = None) -> List[StorageTray]:
    query = db.query(StorageTray).options(joinedload(StorageTray.unit))
    if unit_id:
        query = query.filter(StorageTray.unit_id == unit_id)
    return query.order_by(StorageTray.name).all()


def create_tray(db: Session, tray: StorageTrayCreate) -> StorageTray:
    db_tray = StorageTray(**tray.model_dump())
    db.add(db_tray)
    db.commit()
    db.refresh(db_tray)
    return db_tray


def update_tray(db: Session, tray: StorageTray, tray_update: StorageTrayUpdate) -> StorageTray:
    for field, value in tray_update.model_dump(exclude_unset=True).items():
        setattr(tray, field, value)
    db.commit()
    db.refresh(tray)
    return tray


def delete_tray(db: Session, tray: StorageTray):
    db.delete(tray)
    db.commit()


def get_tray_occupants(db: Session, tray_id: int) -> Dict[int, List[Specimen]]:
    """Map position -> list of specimens occupying it, for the tray browser grid."""
    specimens = (
        db.query(Specimen)
        .options(joinedload(Specimen.project), joinedload(Specimen.species_associations).joinedload(SpecimenSpecies.species))
        .filter(Specimen.storage_tray_id == tray_id, Specimen.storage_position.isnot(None))
        .all()
    )
    occupants: Dict[int, List[Specimen]] = {}
    for s in specimens:
        occupants.setdefault(s.storage_position, []).append(s)
    return occupants


def get_position_occupants(db: Session, tray_id: int, position: int) -> List[Specimen]:
    return (
        db.query(Specimen)
        .options(joinedload(Specimen.project))
        .filter(Specimen.storage_tray_id == tray_id, Specimen.storage_position == position)
        .all()
    )
