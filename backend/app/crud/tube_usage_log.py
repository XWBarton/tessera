import json
from sqlalchemy.orm import Session, joinedload
from ..models.tube_usage_log import TubeUsageLog
from ..models.specimen import Specimen
from ..schemas.tube_usage_log import TubeUsageLogCreate
from typing import List


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

    # Decrement quantity_remaining if it is tracked
    if specimen.quantity_remaining is not None:
        specimen.quantity_remaining = max(0.0, specimen.quantity_remaining - data.quantity_taken)

    db.commit()
    db.refresh(entry)
    return entry


def delete_usage_event(db: Session, specimen: Specimen, entry: TubeUsageLog):
    # Restore quantity_remaining
    if specimen.quantity_remaining is not None:
        specimen.quantity_remaining = specimen.quantity_remaining + entry.quantity_taken
    db.delete(entry)
    db.commit()
