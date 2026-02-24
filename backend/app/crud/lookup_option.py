from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..models.lookup_option import LookupOption
from typing import List

DEFAULTS = {
    "life_stage": ["Adult", "Subadult", "Juvenile", "Nymph", "Larva"],
    "sex":        ["Female", "Male"],
    "unit":       ["specimens", "individuals", "mL", "µL", "L", "mg", "g",
                   "slides", "vials", "tubes", "swabs", "cards"],
}


def get_options(db: Session, category: str) -> List[LookupOption]:
    return (
        db.query(LookupOption)
        .filter(LookupOption.category == category)
        .order_by(LookupOption.sort_order, LookupOption.id)
        .all()
    )


def create_option(db: Session, category: str, value: str) -> LookupOption:
    max_order = (
        db.query(LookupOption)
        .filter(LookupOption.category == category)
        .count()
    )
    option = LookupOption(category=category, value=value.strip(), sort_order=max_order)
    db.add(option)
    db.commit()
    db.refresh(option)
    return option


def delete_option(db: Session, option: LookupOption):
    db.delete(option)
    db.commit()


def get_option(db: Session, option_id: int):
    return db.query(LookupOption).filter(LookupOption.id == option_id).first()


def seed_lookup_options(db: Session):
    for category, values in DEFAULTS.items():
        existing = get_options(db, category)
        if not existing:
            for i, value in enumerate(values):
                db.add(LookupOption(category=category, value=value, sort_order=i))
            db.commit()
            print(f"[tessera] Seeded {len(values)} lookup options for '{category}'")
