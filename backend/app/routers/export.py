import csv
import io
import os
import shutil
import sqlite3
import tempfile
from datetime import datetime, timezone
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
            f"species_{i}_is_primary",
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
            row[f"species_{i}_is_primary"] = assoc.is_primary
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


@router.post("/restore")
async def restore_backup(
    file: UploadFile,
    _: User = Depends(require_admin),
):
    from ..database import engine

    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    data = await file.read()

    # Validate SQLite magic bytes
    if not data.startswith(b"SQLite format 3\x00"):
        raise HTTPException(
            status_code=400,
            detail="File does not appear to be a valid SQLite database.",
        )

    # Write to a temp file and verify it opens cleanly
    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(tmp_fd, "wb") as f:
            f.write(data)
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

    # Close all pooled connections
    engine.dispose()

    # Use SQLite's own backup API to write restored data into the live file.
    # This correctly handles WAL mode — a plain file swap leaves the old
    # -wal/-shm files which SQLite would re-apply on next open, losing the restore.
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

    return {"status": "ok", "message": "Database restored. Please refresh the application."}


@router.get("/backup")
def download_backup(_: User = Depends(require_admin)):
    # Strip "sqlite:///" prefix to get the file path (/data/tessera.db)
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")

    # serialize() creates a consistent in-memory snapshot safe to read during writes
    conn = sqlite3.connect(db_path)
    data = conn.serialize()
    conn.close()

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    filename = f"tessera_backup_{timestamp}.db"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
