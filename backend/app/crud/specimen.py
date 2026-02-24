from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from ..models.specimen import Specimen
from ..models.specimen_species import SpecimenSpecies
from ..models.project import Project
from ..models.site import Site
from ..schemas.specimen import SpecimenCreate, SpecimenUpdate
from typing import Optional, List, Tuple
from datetime import date


def _build_base_query(
    db: Session,
    project_id=None,
    collector_id=None,
    species_id=None,
    confidence=None,
    date_from=None,
    date_to=None,
    search=None,
):
    query = db.query(Specimen).options(
        joinedload(Specimen.project),
        joinedload(Specimen.collector),
        joinedload(Specimen.site),
        joinedload(Specimen.sample_type),
        joinedload(Specimen.species_associations).joinedload(SpecimenSpecies.species),
    )
    if project_id:
        query = query.filter(Specimen.project_id == project_id)
    if collector_id:
        query = query.filter(Specimen.collector_id == collector_id)
    if species_id:
        query = query.join(Specimen.species_associations).filter(
            SpecimenSpecies.species_id == species_id
        )
    if confidence:
        query = query.join(Specimen.species_associations).filter(
            SpecimenSpecies.confidence == confidence
        )
    if date_from:
        query = query.filter(Specimen.collection_date >= date_from)
    if date_to:
        query = query.filter(Specimen.collection_date <= date_to)
    if search:
        query = query.filter(
            Specimen.specimen_code.ilike(f"%{search}%")
            | Specimen.collection_location_text.ilike(f"%{search}%")
            | Specimen.notes.ilike(f"%{search}%")
        )
    return query


def get_specimens(
    db: Session,
    project_id=None,
    collector_id=None,
    species_id=None,
    confidence=None,
    date_from=None,
    date_to=None,
    search=None,
    sort_by="created_at",
    sort_dir="desc",
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[Specimen], int]:
    query = _build_base_query(
        db, project_id, collector_id, species_id, confidence, date_from, date_to, search
    )
    total = query.count()

    sort_col = getattr(Specimen, sort_by, Specimen.created_at)
    if sort_dir == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())

    items = query.offset(skip).limit(limit).all()
    return items, total


def get_specimen(db: Session, specimen_id: int) -> Optional[Specimen]:
    return (
        db.query(Specimen)
        .options(
            joinedload(Specimen.project),
            joinedload(Specimen.collector),
            joinedload(Specimen.site),
            joinedload(Specimen.sample_type),
            joinedload(Specimen.species_associations).joinedload(SpecimenSpecies.species),
        )
        .filter(Specimen.id == specimen_id)
        .first()
    )


def _create_specimen_attempt(
    db: Session, specimen_data: SpecimenCreate, project: Project, entered_by_id: int
) -> Specimen:
    max_seq = (
        db.query(func.max(Specimen.sequence_number))
        .filter(Specimen.project_id == project.id)
        .scalar()
    )
    next_seq = (max_seq or 0) + 1
    code = f"{project.code}-{str(next_seq).zfill(3)}"

    # Initialise quantity_remaining = quantity_value when first set
    qty_remaining = specimen_data.quantity_remaining
    if qty_remaining is None and specimen_data.quantity_value is not None:
        qty_remaining = specimen_data.quantity_value

    db_specimen = Specimen(
        specimen_code=code,
        project_id=specimen_data.project_id,
        sequence_number=next_seq,
        collection_date=specimen_data.collection_date,
        collector_id=specimen_data.collector_id,
        collector_name=specimen_data.collector_name,
        entered_by_id=entered_by_id,
        site_id=specimen_data.site_id,
        sample_type_id=specimen_data.sample_type_id,
        quantity_value=specimen_data.quantity_value,
        quantity_unit=specimen_data.quantity_unit,
        quantity_remaining=qty_remaining,
        collection_lat=specimen_data.collection_lat,
        collection_lon=specimen_data.collection_lon,
        collection_location_text=specimen_data.collection_location_text,
        storage_location=specimen_data.storage_location,
        notes=specimen_data.notes,
    )
    db.add(db_specimen)
    db.flush()

    for assoc in specimen_data.species_associations:
        db_assoc = SpecimenSpecies(
            specimen_id=db_specimen.id,
            species_id=assoc.species_id,
            free_text_species=assoc.free_text_species,
            specimen_count=assoc.specimen_count,
            life_stage=assoc.life_stage,
            sex=assoc.sex,
            confidence=assoc.confidence,
            is_primary=assoc.is_primary,
        )
        db.add(db_assoc)

    db.commit()
    db.refresh(db_specimen)
    return db_specimen


def create_specimen(
    db: Session, specimen_data: SpecimenCreate, project: Project, entered_by_id: int
) -> Specimen:
    try:
        return _create_specimen_attempt(db, specimen_data, project, entered_by_id)
    except IntegrityError:
        db.rollback()
        return _create_specimen_attempt(db, specimen_data, project, entered_by_id)


def update_specimen(
    db: Session, specimen: Specimen, specimen_update: SpecimenUpdate
) -> Specimen:
    update_data = specimen_update.model_dump(
        exclude_unset=True, exclude={"species_associations"}
    )

    # When quantity_value changes, preserve how much has been used so the
    # progress bar reflects the new total correctly
    if "quantity_value" in update_data and "quantity_remaining" not in update_data:
        new_qty = update_data["quantity_value"]
        if new_qty is not None and specimen.quantity_value is not None and specimen.quantity_remaining is not None:
            amount_used = specimen.quantity_value - specimen.quantity_remaining
            update_data["quantity_remaining"] = max(0.0, new_qty - amount_used)
        elif new_qty is not None:
            update_data["quantity_remaining"] = new_qty

    for field, value in update_data.items():
        setattr(specimen, field, value)

    if specimen_update.species_associations is not None:
        for assoc in specimen.species_associations:
            db.delete(assoc)
        db.flush()
        for assoc in specimen_update.species_associations:
            db_assoc = SpecimenSpecies(
                specimen_id=specimen.id,
                species_id=assoc.species_id,
                free_text_species=assoc.free_text_species,
                specimen_count=assoc.specimen_count,
                life_stage=assoc.life_stage,
                sex=assoc.sex,
                confidence=assoc.confidence,
                is_primary=assoc.is_primary,
            )
            db.add(db_assoc)

    db.commit()
    db.refresh(specimen)
    return specimen


def delete_specimen(db: Session, specimen: Specimen):
    db.delete(specimen)
    db.commit()


def get_specimens_for_export(
    db: Session, project_id=None, collector_id=None, species_id=None
) -> List[Specimen]:
    query = _build_base_query(
        db, project_id=project_id, collector_id=collector_id, species_id=species_id
    )
    return query.all()
