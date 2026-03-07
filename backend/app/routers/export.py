import csv
import io
import os
import shutil
import sqlite3
import tempfile
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.specimen import get_specimens_for_export
from ..models.user import User
from ..config import settings
from typing import Optional

router = APIRouter(prefix="/export", tags=["export"])


def _specimens_to_csv(specimens) -> str:
    if not specimens:
        return ""

    max_species = max((len(s.species_associations) for s in specimens), default=0)

    base_fields = [
        "specimen_code",
        "project_code",
        "collection_date",
        "collection_date_end",
        "collector",
        "entered_by_username",
        "entered_by_full_name",
        "collection_lat",
        "collection_lon",
        "collection_location_text",
        "storage_location",
        "notes",
    ]
    species_fields = []
    for i in range(1, max_species + 1):
        species_fields += [
            f"species_{i}_name",
            f"species_{i}_life_stage",
            f"species_{i}_sex",
            f"species_{i}_count",
            f"species_{i}_confidence",
        ]

    fieldnames = base_fields + species_fields
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for s in specimens:
        row: dict = {
            "specimen_code": s.specimen_code,
            "project_code": s.project.code if s.project else "",
            "collection_date": str(s.collection_date) if s.collection_date else "",
            "collection_date_end": str(s.collection_date_end) if s.collection_date_end else "",
            "collector": s.collector.full_name if s.collector else (s.collector_name or "Unknown"),
            "entered_by_username": s.entered_by.username if s.entered_by else "",
            "entered_by_full_name": s.entered_by.full_name if s.entered_by else "",
            "collection_lat": s.collection_lat if s.collection_lat is not None else "",
            "collection_lon": s.collection_lon if s.collection_lon is not None else "",
            "collection_location_text": s.collection_location_text or "",
            "storage_location": s.storage_location or "",
            "notes": s.notes or "",
        }
        for i, assoc in enumerate(s.species_associations, 1):
            name = (
                assoc.species.scientific_name
                if assoc.species
                else (assoc.free_text_species or "")
            )
            row[f"species_{i}_name"] = name
            row[f"species_{i}_life_stage"] = assoc.life_stage or ""
            row[f"species_{i}_sex"] = assoc.sex or ""
            row[f"species_{i}_count"] = assoc.specimen_count if assoc.specimen_count is not None else ""
            row[f"species_{i}_confidence"] = assoc.confidence
        writer.writerow(row)

    return output.getvalue()


@router.get("/specimens")
def export_specimens(
    project_id: Optional[int] = None,
    collector_id: Optional[int] = None,
    species_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimens = get_specimens_for_export(
        db, project_id=project_id, collector_id=collector_id, species_id=species_id
    )
    content = _specimens_to_csv(specimens)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="specimens_export.csv"'},
    )


@router.get("/specimens/project/{project_id}")
def export_by_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimens = get_specimens_for_export(db, project_id=project_id)
    content = _specimens_to_csv(specimens)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="project_{project_id}_specimens.csv"'
        },
    )


@router.get("/specimens/collector/{collector_id}")
def export_by_collector(
    collector_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimens = get_specimens_for_export(db, collector_id=collector_id)
    content = _specimens_to_csv(specimens)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="collector_{collector_id}_specimens.csv"'
        },
    )


@router.get("/specimens/species/{species_id}")
def export_by_species(
    species_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    specimens = get_specimens_for_export(db, species_id=species_id)
    content = _specimens_to_csv(specimens)
    return StreamingResponse(
        io.BytesIO(content.encode()),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="species_{species_id}_specimens.csv"'
        },
    )


def _restore_db_bytes(db_bytes: bytes, db_path: str) -> None:
    """Write db_bytes into the live SQLite file using the backup API."""
    from ..database import engine

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(db_bytes)
        test_conn = sqlite3.connect(tmp_path)
        try:
            test_conn.execute("SELECT name FROM sqlite_master LIMIT 1").fetchall()
        finally:
            test_conn.close()
    except Exception as exc:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise HTTPException(status_code=400, detail=f"Invalid database file: {exc}")

    engine.dispose()
    try:
        src = sqlite3.connect(tmp_path)
        dst = sqlite3.connect(db_path)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Restore failed: {exc}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post("/restore")
async def restore_backup(
    file: UploadFile,
    _: User = Depends(require_admin),
):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    data = await file.read()

    is_zip = data[:4] == b"PK\x03\x04"
    is_sqlite = data.startswith(b"SQLite format 3\x00")

    if is_zip:
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Invalid ZIP file.")

        names = zf.namelist()
        if "tessera.db" not in names:
            raise HTTPException(status_code=400, detail="ZIP does not contain tessera.db.")

        db_bytes = zf.read("tessera.db")
        _restore_db_bytes(db_bytes, db_path)

        # Restore photos
        PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        photo_entries = [n for n in names if n.startswith("photos/") and not n.endswith("/")]
        if photo_entries:
            # Clear existing photos then extract
            shutil.rmtree(PHOTO_DIR, ignore_errors=True)
            PHOTO_DIR.mkdir(parents=True, exist_ok=True)
            for entry in photo_entries:
                rel = entry[len("photos/"):]
                dest = PHOTO_DIR / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(zf.read(entry))

    elif is_sqlite:
        # Legacy plain .db restore (no photos)
        _restore_db_bytes(data, db_path)
    else:
        raise HTTPException(
            status_code=400,
            detail="File must be a Tessera backup ZIP or a raw SQLite .db file.",
        )

    return {"status": "ok", "message": "Backup restored. Please refresh the application."}


PHOTO_DIR = Path("/data/photos")


@router.get("/backup")
def download_backup(_: User = Depends(require_admin)):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")

    # Snapshot the database into memory
    conn = sqlite3.connect(db_path)
    db_bytes = conn.serialize()
    conn.close()

    # Build a ZIP in memory: tessera.db + photos/*
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("tessera.db", db_bytes)
        if PHOTO_DIR.exists():
            for photo_file in PHOTO_DIR.rglob("*"):
                if photo_file.is_file():
                    zf.write(photo_file, arcname=f"photos/{photo_file.relative_to(PHOTO_DIR)}")
    buf.seek(0)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    filename = f"tessera_backup_{timestamp}.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
