import io
import csv
import mimetypes
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session, joinedload
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.specimen import (
    get_specimen,
    get_specimens,
    create_specimen,
    update_specimen,
    delete_specimen,
)
from ..crud.project import get_project
from ..crud.tube_usage_log import get_usage_log, create_usage_event, update_usage_event, delete_usage_event
from ..schemas.specimen import (
    SpecimenDetail, SpecimenCreate, SpecimenUpdate, SpecimenList,
    SpecimenBulkImportRequest, SpecimenBulkImportResult,
)
from ..schemas.tube_usage_log import TubeUsageLogCreate, TubeUsageLogRead
from pydantic import BaseModel


class UsageRefUpdate(BaseModel):
    molecular_ref: str


class ElementaLinkPayload(BaseModel):
    specimen_code: str
    elementa_ref: str
    run_type: str


class ElementaUnlinkPayload(BaseModel):
    specimen_code: str
    elementa_ref: str
from ..schemas.specimen_photo import SpecimenPhotoRead
from ..models.tube_usage_log import TubeUsageLog
from ..models.specimen_photo import SpecimenPhoto
from ..models.user import User
from ..models.site import Site
from ..models.sample_type import SampleType
from ..models.species import Species as SpeciesModel
from ..models.project import Project as ProjectModel
from sqlalchemy.exc import IntegrityError
from typing import Optional, List
from datetime import date, date as date_type

PHOTO_DIR = Path("/data/photos")
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif", ".tiff", ".tif"}

router = APIRouter(prefix="/specimens", tags=["specimens"])


def _label_fields(specimen):
    """Extract common label fields from a specimen."""
    first = specimen.species_associations[0] if specimen.species_associations else None
    species = ""
    if first:
        species = first.species.scientific_name if first.species else (first.free_text_species or "")
    return {
        "code": specimen.specimen_code,
        "project": specimen.project.code if specimen.project else "",
        "species": species,
        "collector": specimen.collector.full_name if specimen.collector else (specimen.collector_name or ""),
        "date": (
            f"{specimen.collection_date} – {specimen.collection_date_end}"
            if specimen.collection_date and specimen.collection_date_end
            else str(specimen.collection_date) if specimen.collection_date else ""
        ),
        "storage": specimen.storage_location or "",
    }


def _zpl_eppendorf_cap(f: dict) -> str:
    """~0.5" × 0.5" (101×101 dots) spot label for Eppendorf cap/lid.
    Space for specimen code and year only."""
    year = f["date"][:4] if f["date"] else ""
    return (
        "^XA\n"
        "^PW101^LL101\n"
        f"^FO3,5^A0N,18,15^FD{f['code'][:13]}^FS\n"
        f"^FO3,30^A0N,15,13^FD{f['project'][:12]}^FS\n"
        f"^FO3,52^A0N,15,13^FD{year}^FS\n"
        "^XZ\n"
    )


def _zpl_eppendorf_side(f: dict) -> str:
    """~1.75" × 0.5" (355×101 dots) side strip for Eppendorf tube."""
    return (
        "^XA\n"
        "^PW355^LL101\n"
        f"^FO5,6^A0N,28,24^FD{f['code']}^FS\n"
        f"^FO5,40^A0N,20,18^FD{f['species'][:30]}^FS\n"
        f"^FO5,66^A0N,18,16^FD{f['date']}  {f['collector'][:18]}^FS\n"
        "^XZ\n"
    )


def _zpl_falcon(f: dict) -> str:
    """~2" × 0.875" (406×177 dots) label for 20mL/50mL Falcon tube."""
    return (
        "^XA\n"
        "^PW406^LL177\n"
        f"^FO8,8^A0N,36,32^FD{f['code']}^FS\n"
        f"^FO8,52^A0N,22,20^FD{f['species'][:38]}^FS\n"
        f"^FO8,80^A0N,20,18^FDDate: {f['date']}^FS\n"
        f"^FO8,106^A0N,20,18^FDCollector: {f['collector'][:22]}^FS\n"
        f"^FO8,132^A0N,20,18^FDStorage: {f['storage'][:25]}^FS\n"
        "^XZ\n"
    )


def _zpl_bottle(f: dict) -> str:
    """~3" × 2" (610×406 dots) label for larger bottles."""
    return (
        "^XA\n"
        "^PW610^LL406\n"
        f"^FO15,15^A0N,50,46^FD{f['code']}^FS\n"
        f"^FO15,78^A0N,28,26^FDProject: {f['project']}^FS\n"
        f"^FO15,116^A0N,26,24^FD{f['species'][:45]}^FS\n"
        f"^FO15,154^A0N,24,22^FDDate: {f['date']}^FS\n"
        f"^FO15,188^A0N,24,22^FDCollector: {f['collector'][:32]}^FS\n"
        f"^FO15,222^A0N,24,22^FDStorage: {f['storage'][:36]}^FS\n"
        "^XZ\n"
    )


ZPL_TEMPLATES = {
    "standard":        lambda f: (
        "^XA\n"
        f"^FO50,50^A0N,40,40^FD{f['code']}^FS\n"
        f"^FO50,100^A0N,25,25^FDProject: {f['project']}^FS\n"
        f"^FO50,130^A0N,20,20^FDSpecies: {f['species'][:30]}^FS\n"
        f"^FO50,155^A0N,20,20^FDCollector: {f['collector']}^FS\n"
        f"^FO50,180^A0N,20,20^FDDate: {f['date']}^FS\n"
        f"^FO50,205^A0N,20,20^FDStorage: {f['storage']}^FS\n"
        "^XZ\n"
    ),
    "eppendorf_cap":   _zpl_eppendorf_cap,
    "eppendorf_side":  _zpl_eppendorf_side,
    "eppendorf_combo": lambda f: _zpl_eppendorf_cap(f) + _zpl_eppendorf_side(f),
    "falcon":          _zpl_falcon,
    "bottle":          _zpl_bottle,
}


def _generate_zpl_label(specimen, template: str = "standard") -> str:
    f = _label_fields(specimen)
    fn = ZPL_TEMPLATES.get(template, ZPL_TEMPLATES["standard"])
    return fn(f)


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
    life_stage: Optional[str] = None,
    sex: Optional[str] = None,
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
        life_stage=life_stage,
        sex=sex,
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
    if specimen.specimen_code and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can set custom tube codes")
    project = get_project(db, specimen.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        return create_specimen(db, specimen, project, entered_by_id=current_user.id)
    except IntegrityError:
        raise HTTPException(status_code=400, detail=f"Tube code '{specimen.specimen_code}' already exists")


@router.get("/find-by-code")
def find_by_code(code: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from ..models.specimen import Specimen as SpecimenModel
    specimen = db.query(SpecimenModel).filter(SpecimenModel.specimen_code == code).first()
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return {"id": specimen.id}


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
    current_user: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    if (
        specimen_update.specimen_code is not None
        and specimen_update.specimen_code != specimen.specimen_code
        and not current_user.is_admin
    ):
        raise HTTPException(status_code=403, detail="Only admins can change tube codes")
    if (
        specimen_update.project_id is not None
        and specimen_update.project_id != specimen.project_id
        and not current_user.is_admin
    ):
        raise HTTPException(status_code=403, detail="Only admins can move tubes between projects")
    try:
        return update_specimen(db, specimen, specimen_update)
    except IntegrityError:
        raise HTTPException(status_code=400, detail=f"Tube code '{specimen_update.specimen_code}' already exists")


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
    template: str = "standard",
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    if format == "zpl":
        content = _generate_zpl_label(specimen, template)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{specimen.specimen_code}_{template}.zpl"'
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


@router.post("/link-elementa")
def link_elementa_run(
    payload: ElementaLinkPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from ..models.specimen import Specimen as SpecimenModel
    specimen = db.query(SpecimenModel).filter(SpecimenModel.specimen_code == payload.specimen_code).first()
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found in Tessera")
    usage = TubeUsageLog(
        specimen_id=specimen.id,
        date=date.today(),
        quantity_taken=0,
        unit="Elementa",
        purpose=payload.run_type,
        taken_by_id=current_user.id,
        molecular_ref=payload.elementa_ref,
    )
    db.add(usage)
    db.commit()
    return {"ok": True, "usage_id": usage.id}


@router.delete("/unlink-elementa")
def unlink_elementa_run(
    payload: ElementaUnlinkPayload,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    from ..models.specimen import Specimen as SpecimenModel
    specimen = db.query(SpecimenModel).filter(SpecimenModel.specimen_code == payload.specimen_code).first()
    if not specimen:
        return {"ok": False}
    updated = (
        db.query(TubeUsageLog)
        .filter(
            TubeUsageLog.specimen_id == specimen.id,
            TubeUsageLog.molecular_ref == payload.elementa_ref,
        )
        .update({"molecular_ref": None})
    )
    db.commit()
    return {"ok": True, "cleared": updated}


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


@router.patch("/{specimen_id}/usage/{entry_id}/ref", response_model=TubeUsageLogRead)
def set_usage_ref(
    specimen_id: int,
    entry_id: int,
    body: UsageRefUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    entry = db.query(TubeUsageLog).filter(
        TubeUsageLog.id == entry_id,
        TubeUsageLog.specimen_id == specimen_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Usage entry not found")
    entry.molecular_ref = body.molecular_ref
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/{specimen_id}/usage/{entry_id}", response_model=TubeUsageLogRead)
def update_usage_entry(
    specimen_id: int,
    entry_id: int,
    usage: TubeUsageLogCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
    return update_usage_event(db, specimen, entry, usage)


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


@router.post("/bulk-import", response_model=SpecimenBulkImportResult)
def bulk_import_specimens(
    body: SpecimenBulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    from sqlalchemy import func as sqlfunc
    created = 0
    errors: List[str] = []

    for i, row in enumerate(body.rows):
        row_num = i + 1
        try:
            with db.begin_nested():
                project = db.query(ProjectModel).filter(ProjectModel.code == row.project_code).first()
                if not project:
                    errors.append(f"Row {row_num} ({row.specimen_code}): Project '{row.project_code}' not found")
                    continue

                existing = db.query(Specimen).filter(Specimen.specimen_code == row.specimen_code).first()
                if existing:
                    errors.append(f"Row {row_num}: Code '{row.specimen_code}' already exists")
                    continue

                site_id = None
                site_obj = None
                if row.site_name:
                    site_obj = db.query(Site).filter(Site.name == row.site_name).first()
                    if site_obj:
                        site_id = site_obj.id

                sample_type_id = None
                if row.sample_type_name:
                    st = db.query(SampleType).filter(SampleType.name == row.sample_type_name).first()
                    if st:
                        sample_type_id = st.id

                collection_date = None
                if row.collection_date:
                    try:
                        collection_date = date_type.fromisoformat(row.collection_date)
                    except ValueError:
                        pass

                collection_date_end = None
                if row.collection_date_end:
                    try:
                        collection_date_end = date_type.fromisoformat(row.collection_date_end)
                    except ValueError:
                        pass

                max_seq = (
                    db.query(sqlfunc.max(Specimen.sequence_number))
                    .filter(Specimen.project_id == project.id)
                    .scalar()
                )
                next_seq = (max_seq or 0) + 1

                qty_remaining = row.quantity_value

                db_specimen = Specimen(
                    specimen_code=row.specimen_code,
                    project_id=project.id,
                    sequence_number=next_seq,
                    collection_date=collection_date,
                    collection_date_end=collection_date_end,
                    collector_name=row.collector_name or None,
                    entered_by_id=current_user.id,
                    site_id=site_id,
                    sample_type_id=sample_type_id,
                    quantity_value=row.quantity_value,
                    quantity_unit=row.quantity_unit or None,
                    quantity_remaining=qty_remaining,
                    storage_location=row.storage_location or None,
                    notes=row.notes or None,
                    sites=[site_obj] if site_obj else [],
                )
                db.add(db_specimen)
                db.flush()

                if row.species:
                    valid_confidences = {'Confirmed', 'Probable', 'Possible', 'Unknown'}
                    for sp_entry in row.species.split(';'):
                        sp_entry = sp_entry.strip()
                        if not sp_entry:
                            continue
                        parts = [p.strip() for p in sp_entry.split('|')]
                        sp_name = parts[0]
                        if not sp_name:
                            continue
                        sp_count = None
                        if len(parts) > 1 and parts[1]:
                            try:
                                sp_count = int(parts[1])
                            except ValueError:
                                pass
                        life_stage = parts[2] if len(parts) > 2 and parts[2] else None
                        sex = parts[3] if len(parts) > 3 and parts[3] else None
                        confidence = parts[4] if len(parts) > 4 and parts[4] in valid_confidences else 'Unknown'
                        sp = db.query(SpeciesModel).filter(
                            SpeciesModel.scientific_name == sp_name
                        ).first()
                        assoc = SpecimenSpecies(
                            specimen_id=db_specimen.id,
                            species_id=sp.id if sp else None,
                            free_text_species=None if sp else sp_name,
                            specimen_count=sp_count,
                            life_stage=life_stage,
                            sex=sex,
                            confidence=confidence,
                            is_primary=False,
                        )
                        db.add(assoc)

                created += 1
        except Exception as e:
            errors.append(f"Row {row_num} ({row.specimen_code}): {str(e)}")

    db.commit()
    return {"created": created, "errors": errors}


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
        tmpl = body.get("template", "standard")
        content = "".join(_generate_zpl_label(s, tmpl) for s in specimens)
        return StreamingResponse(
            io.BytesIO(content.encode()),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="labels_{tmpl}.zpl"'},
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


# ── Photo endpoints ────────────────────────────────────────────────────────────

@router.get("/{specimen_id}/photos", response_model=List[SpecimenPhotoRead])
def list_photos(
    specimen_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")
    return (
        db.query(SpecimenPhoto)
        .options(joinedload(SpecimenPhoto.uploaded_by))
        .filter(SpecimenPhoto.specimen_id == specimen_id)
        .order_by(SpecimenPhoto.uploaded_at)
        .all()
    )


@router.post("/{specimen_id}/photos", response_model=SpecimenPhotoRead)
async def upload_photo(
    specimen_id: int,
    file: UploadFile = File(...),
    caption: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    specimen = get_specimen(db, specimen_id)
    if not specimen:
        raise HTTPException(status_code=404, detail="Specimen not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    stored_name = f"{uuid.uuid4()}{ext}"
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    file_path = PHOTO_DIR / stored_name

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    photo = SpecimenPhoto(
        specimen_id=specimen_id,
        filename=stored_name,
        original_filename=file.filename or stored_name,
        caption=caption or None,
        uploaded_by_id=current_user.id,
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    # reload with uploader
    return (
        db.query(SpecimenPhoto)
        .options(joinedload(SpecimenPhoto.uploaded_by))
        .filter(SpecimenPhoto.id == photo.id)
        .first()
    )


@router.get("/{specimen_id}/photos/{photo_id}/file")
def get_photo_file(
    specimen_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    photo = (
        db.query(SpecimenPhoto)
        .filter(SpecimenPhoto.id == photo_id, SpecimenPhoto.specimen_id == specimen_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    file_path = PHOTO_DIR / photo.filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Photo file not found on disk")
    media_type = mimetypes.guess_type(photo.filename)[0] or "application/octet-stream"
    return FileResponse(str(file_path), media_type=media_type)


@router.delete("/{specimen_id}/photos/{photo_id}")
def delete_photo(
    specimen_id: int,
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    photo = (
        db.query(SpecimenPhoto)
        .filter(SpecimenPhoto.id == photo_id, SpecimenPhoto.specimen_id == specimen_id)
        .first()
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    if photo.uploaded_by_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorised to delete this photo")
    file_path = PHOTO_DIR / photo.filename
    if file_path.exists():
        os.unlink(file_path)
    db.delete(photo)
    db.commit()
    return {"message": "Photo deleted"}
