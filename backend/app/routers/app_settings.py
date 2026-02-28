from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..dependencies import get_db, get_current_user, require_admin
from ..models.user import User
from pydantic import BaseModel
import urllib.request
import urllib.error

router = APIRouter(prefix="/admin/settings", tags=["settings"])

ALLOWED_KEYS = {"elementa_url"}


class SettingValue(BaseModel):
    value: str


@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.execute(text("SELECT key, value FROM app_settings")).fetchall()
    return {row[0]: row[1] for row in rows}


@router.put("/{key}")
def set_setting(
    key: str,
    body: SettingValue,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if key not in ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail="Unknown setting key")
    db.execute(
        text("INSERT INTO app_settings (key, value) VALUES (:k, :v) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
        {"k": key, "v": body.value},
    )
    db.commit()
    return {"key": key, "value": body.value}


@router.get("/test-connection")
def test_connection(
    url: str,
    _: User = Depends(get_current_user),
):
    """Server-side connectivity check — avoids browser CORS restrictions.
    Rewrites localhost to host.docker.internal so the request escapes the container."""
    import re
    clean = url.rstrip("/")
    server_url = re.sub(r"(?i)^(https?://)localhost\b", r"\1host.docker.internal", clean)
    try:
        req = urllib.request.urlopen(f"{server_url}/api/health", timeout=5)
        return {"ok": req.status == 200}
    except Exception:
        return {"ok": False}
