from sqlalchemy.orm import Session
from ..models.sample_type import SampleType
from ..schemas.sample_type import SampleTypeCreate, SampleTypeUpdate
from typing import Optional, List

DEFAULT_SAMPLE_TYPES = [
    {"name": "Specimen", "default_unit": "specimens", "is_specimen": True},
    {"name": "Blood",    "default_unit": "mL",        "is_specimen": False},
    {"name": "Water",    "default_unit": "mL",        "is_specimen": False},
    {"name": "Swab",     "default_unit": "swabs",     "is_specimen": False},
    {"name": "Tissue",   "default_unit": "mg",        "is_specimen": False},
]


def seed_sample_types(db: Session):
    for st in DEFAULT_SAMPLE_TYPES:
        existing = db.query(SampleType).filter(SampleType.name == st["name"]).first()
        if not existing:
            db.add(SampleType(
                name=st["name"],
                default_unit=st["default_unit"],
                is_default=True,
                is_specimen=st["is_specimen"],
            ))
    db.commit()


def get_all_sample_types(db: Session) -> List[SampleType]:
    return db.query(SampleType).order_by(SampleType.name).all()


def get_sample_type(db: Session, sample_type_id: int) -> Optional[SampleType]:
    return db.query(SampleType).filter(SampleType.id == sample_type_id).first()


def get_sample_type_by_name(db: Session, name: str) -> Optional[SampleType]:
    return db.query(SampleType).filter(SampleType.name == name).first()


def create_sample_type(db: Session, data: SampleTypeCreate) -> SampleType:
    db_st = SampleType(name=data.name, default_unit=data.default_unit, is_specimen=data.is_specimen, is_default=False)
    db.add(db_st)
    db.commit()
    db.refresh(db_st)
    return db_st


def update_sample_type(db: Session, sample_type: SampleType, updates: SampleTypeUpdate) -> SampleType:
    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(sample_type, field, value)
    db.commit()
    db.refresh(sample_type)
    return sample_type


def delete_sample_type(db: Session, sample_type: SampleType):
    db.delete(sample_type)
    db.commit()
