import json
from sqlalchemy.orm import Session, joinedload
from ..models.tube_usage_log import TubeUsageLog
from ..models.specimen import Specimen
from ..schemas.tube_usage_log import TubeUsageLogCreate
from typing import List

# Conversion factors to a common base unit within each physical family.
# Volume base: µL.  Mass base: µg.
_VOLUME_TO_UL: dict[str, float] = {
    "ul": 1.0, "µl": 1.0, "μl": 1.0,
    "ml": 1_000.0,
    "cl": 10_000.0,
    "dl": 100_000.0,
    "l": 1_000_000.0,
}
_MASS_TO_UG: dict[str, float] = {
    "ug": 1.0, "µg": 1.0, "μg": 1.0,
    "mg": 1_000.0,
    "g": 1_000_000.0,
    "kg": 1_000_000_000.0,
}


def _convert(value: float, from_unit: str, to_unit: str) -> float:
    """Convert value from from_unit into to_unit.

    Returns value unchanged when conversion is not possible (unknown units,
    incompatible families, or identical units).
    """
    if not from_unit or not to_unit:
        return value
    from_key = from_unit.strip().lower()
    to_key = to_unit.strip().lower()
    if from_key == to_key:
        return value

    # Volume family
    if from_key in _VOLUME_TO_UL and to_key in _VOLUME_TO_UL:
        return value * _VOLUME_TO_UL[from_key] / _VOLUME_TO_UL[to_key]

    # Mass family
    if from_key in _MASS_TO_UG and to_key in _MASS_TO_UG:
        return value * _MASS_TO_UG[from_key] / _MASS_TO_UG[to_key]

    # Units are in different families or completely unknown — can't convert
    return value


def get_usage_log(db: Session, specimen_id: int) -> List[TubeUsageLog]:
    return (
        db.query(TubeUsageLog)
        .options(joinedload(TubeUsageLog.taken_by))
        .filter(TubeUsageLog.specimen_id == specimen_id)
        .order_by(TubeUsageLog.date.desc(), TubeUsageLog.created_at.desc())
        .all()
    )


def create_usage_event(
    db: Session, specimen: Specimen, data: TubeUsageLogCreate, taken_by_id: int
) -> TubeUsageLog:
    breakdown_json = (
        json.dumps([item.model_dump() for item in data.breakdown])
        if data.breakdown
        else None
    )
    entry = TubeUsageLog(
        specimen_id=specimen.id,
        date=data.date,
        quantity_taken=data.quantity_taken,
        unit=data.unit,
        purpose=data.purpose,
        molecular_ref=data.molecular_ref,
        breakdown=breakdown_json,
        notes=data.notes,
        taken_by_id=taken_by_id,
    )
    db.add(entry)

    if specimen.quantity_remaining is not None:
        taken_in_spec = _convert(data.quantity_taken, data.unit, specimen.quantity_unit or data.unit)
        specimen.quantity_remaining = max(0.0, specimen.quantity_remaining - taken_in_spec)

    db.commit()
    db.refresh(entry)
    return entry


def update_usage_event(
    db: Session, specimen: Specimen, entry: TubeUsageLog, data: TubeUsageLogCreate
) -> TubeUsageLog:
    if specimen.quantity_remaining is not None:
        spec_unit = specimen.quantity_unit or data.unit
        old_in_spec = _convert(entry.quantity_taken, entry.unit, spec_unit)
        new_in_spec = _convert(data.quantity_taken, data.unit, spec_unit)
        specimen.quantity_remaining = max(0.0, specimen.quantity_remaining - (new_in_spec - old_in_spec))

    breakdown_json = (
        json.dumps([item.model_dump() for item in data.breakdown])
        if data.breakdown
        else None
    )
    entry.date = data.date
    entry.quantity_taken = data.quantity_taken
    entry.unit = data.unit
    entry.purpose = data.purpose
    entry.breakdown = breakdown_json
    entry.notes = data.notes
    db.commit()
    db.refresh(entry)
    return entry


def delete_usage_event(db: Session, specimen: Specimen, entry: TubeUsageLog):
    if specimen.quantity_remaining is not None:
        taken_in_spec = _convert(entry.quantity_taken, entry.unit, specimen.quantity_unit or entry.unit)
        specimen.quantity_remaining += taken_in_spec
    db.delete(entry)
    db.commit()
