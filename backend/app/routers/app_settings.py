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


@router.get("/api-token")
def get_api_token(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Return the stored API token, or null if not yet generated."""
    row = db.execute(text("SELECT value FROM app_settings WHERE key = 'api_token'")).fetchone()
    return {"token": row[0] if row else None}


@router.post("/api-token/regenerate")
def regenerate_api_token(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Generate a new long-lived API token (invalidates any previous token)."""
    from ..security import create_access_token
    from datetime import timedelta

    token = create_access_token(
        data={"sub": current_user.id},
        expires_delta=timedelta(days=3650),
    )
    db.execute(
        text("INSERT INTO app_settings (key, value) VALUES ('api_token', :v) ON CONFLICT(key) DO UPDATE SET value = excluded.value"),
        {"v": token},
    )
    db.commit()
    return {"token": token}


@router.get("/test-connection")
def test_connection(
    url: str,
    _: User = Depends(get_current_user),
):
    """Server-side connectivity check — avoids browser CORS restrictions.
    Uses ELEMENTA_INTERNAL_URL env var if set (for tunnelled/cloud deployments where
    the public URL isn't reachable from inside Docker), otherwise rewrites localhost
    to host.docker.internal so the request escapes the container."""
    import re
    import os
    clean = url.rstrip("/")
    internal = os.environ.get("ELEMENTA_INTERNAL_URL", "").strip()
    server_url = internal.rstrip("/") if internal else re.sub(
        r"(?i)^(https?://)localhost\b", r"\1host.docker.internal", clean
    )
    try:
        req = urllib.request.urlopen(f"{server_url}/api/health", timeout=5)
        return {"ok": req.status == 200}
    except Exception:
        return {"ok": False}
