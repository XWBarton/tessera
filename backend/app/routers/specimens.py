import io
import csv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.specimen import (
    get_specimen,
    get_specimens,
    create_specimen,
    update_specimen,
    delete_specimen,
)
from ..crud.project import get_project
from ..crud.tube_usage_log import get_usage_log, create_usage_event, delete_usage_event
from ..schemas.specimen import SpecimenDetail, SpecimenCreate, SpecimenUpdate, SpecimenList
from ..schemas.tube_usage_log import TubeUsageLogCreate, TubeUsageLogRead
from ..models.tube_usage_log import TubeUsageLog
from ..models.user import User
from typing import Optional, List
from datetime import date

router = APIRouter(prefix="/specimens", tags=["specimens"])


def _generate_zpl_label(specimen) -> str:
    primary = next((a for a in specimen.species_associations if a.is_primary), None)
    if primary:
        species_name = (
            primary.species.scientific_name if primary.species else (primary.free_text_species or "")
        )
    else:
        species_name = ""
    species_name = species_name[:30]
    collector = specimen.collector.full_name if specimen.collector else (specimen.collector_name or "")
    col_date = str(specimen.collection_date) if specimen.collection_date else ""
    storage = specimen.storage_location or ""
    project_code = specimen.project.code if specimen.project else ""
    return (
        f"^XA\n"
        f"^FO50,50^A0N,40,40^FD{specimen.specimen_code}^FS\n"
        f"^FO50,100^A0N,25,25^FDProject: {project_code}^FS\n"
        f"^FO50,130^A0N,20,20^FDSpecies: {species_name}^FS\n"
        f"^FO50,155^A0N,20,20^FDCollector: {collector}^FS\n"
        f"^FO50,180^A0N,20,20^FDDate: {col_date}^FS\n"
        f"^FO50,205^A0N,20,20^FDStorage: {storage}^FS\n"
        f"^XZ\n"
    )


def _get_label_row(specimen) -> dict:
    primary = next((a for a in specimen.species_associations if a.is_primary), None)
    species_name = ""
    if primary:
        species_name = (
            primary.species.scientific_name if primary.species else (primary.free_text_species or "")
        )
    return {
        "specimen_code": specimen.specimen_code,
        "project_code": specimen.project.code if specimen.project else "",
        "species": species_name,
        "collector": specimen.collector.full_name if specimen.collector else (specimen.collector_name or ""),
        "collection_date": str(specimen.collection_date) if specimen.collection_date else "",
        "storage_location": specimen.storage_location or "",
    }


LABEL_FIELDS = ["specimen_code", "project_code", "species", "collector", "collection_date", "storage_location"]


@router.get("/", response_model=SpecimenList)
def list_specimens(
    project_id: Optional[int] = None,
    collector_id: Optional[int] = None,
    species_id: Optional[int] = None,
    confidence: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    items, total = get_specimens(
        db,
        project_id=project_id,
        collector_id=collector_id,
        species_id=species_id,
        confidence=confidence,
        date_from=date_from,
        date_to=date_to,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
        skip=skip,
        limit=limit,
    )
    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.post("/", response_model=SpecimenDetail)
def create_new_specimen(
    specimen: SpecimenCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_project(db, specimen.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return create_specimen(db, specimen, project, entered_by_id=current_user.id)


@router.get("/{specimen_id}", response_model=SpecimenDetail)
def read_specimen(
    specimen_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return specimen


@router.put("/{specimen_id}", response_model=SpecimenDetail)
def update_existing_specimen(
    specimen_id: int,
    specimen_update: SpecimenUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return update_specimen(db, specimen, specimen_update)


@router.delete("/{specimen_id}")
def delete_existing_specimen(
    specimen_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    delete_specimen(db, specimen)
    return {"message": "Specimen deleted"}


@router.get("/{specimen_id}/label")
def get_specimen_label(
    specimen_id: int,
    format: str = "zpl",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    if format == "zpl":
        content = _generate_zpl_label(specimen)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{specimen.specimen_code}.zpl"'
            },
        )
    else:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=LABEL_FIELDS)
        writer.writeheader()
        writer.writerow(_get_label_row(specimen))
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{specimen.specimen_code}_label.csv"'
            },
        )


@router.get("/{specimen_id}/usage", response_model=List[TubeUsageLogRead])
def list_usage_log(
    specimen_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return get_usage_log(db, specimen_id)


@router.post("/{specimen_id}/usage", response_model=TubeUsageLogRead)
def record_usage(
    specimen_id: int,
    usage: TubeUsageLogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return create_usage_event(db, specimen, usage, taken_by_id=current_user.id)


@router.delete("/{specimen_id}/usage/{entry_id}")
def delete_usage_entry(
    specimen_id: int,
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    entry = db.query(TubeUsageLog).filter(
        TubeUsageLog.id == entry_id,
        TubeUsageLog.specimen_id == specimen_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Usage entry not found")
    delete_usage_event(db, specimen, entry)
    return {"message": "Usage entry deleted"}


@router.post("/bulk-label")
def bulk_label(
    body: dict,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen_ids = body.get("specimen_ids", [])
    fmt = body.get("format", "zpl")
    specimens = [get_specimen(db, sid) for sid in specimen_ids]
    specimens = [s for s in specimens if s is not None]

    if fmt == "zpl":
        content = "".join(_generate_zpl_label(s) for s in specimens)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="labels.zpl"'},
        )
    else:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=LABEL_FIELDS)
        writer.writeheader()
        for s in specimens:
            writer.writerow(_get_label_row(s))
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={"Content-Disposition": 'attachment; filename="labels.csv"'},
        )
