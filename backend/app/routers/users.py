import os
import uuid
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.user import (
    get_user,
    get_users,
    create_user,
    update_user,
    delete_user,
    hard_delete_user,
    get_user_by_username,
    get_user_by_email,
)
from ..schemas.user import UserRead, UserCreate, UserUpdate
from ..models.user import User
from typing import List

AVATAR_DIR = Path("/data/avatars")
AVATAR_ALLOWED = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/", response_model=List[UserRead])
def list_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return get_users(db, skip, limit)


@router.post("/", response_model=UserRead)
def create_new_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if get_user_by_username(db, user.username):
        raise HTTPException(status_code=400, detail="Username already registered")
    if get_user_by_email(db, user.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    return create_user(db, user)


@router.get("/{user_id}", response_model=UserRead)
def read_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserRead)
def update_existing_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return update_user(db, user, user_update)


@router.delete("/{user_id}", response_model=UserRead)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return delete_user(db, user)


@router.delete("/{user_id}/hard")
def hard_delete(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user = get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    hard_delete_user(db, user, reassign_to_id=current_user.id)
    return {"ok": True}


@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in AVATAR_ALLOWED:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {', '.join(sorted(AVATAR_ALLOWED))}")
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    # Delete old avatar file if present
    if current_user.avatar_filename:
        old_path = AVATAR_DIR / current_user.avatar_filename
        if old_path.exists():
            os.unlink(old_path)
    stored_name = f"{uuid.uuid4()}{ext}"
    content = await file.read()
    with open(AVATAR_DIR / stored_name, "wb") as f:
        f.write(content)
    current_user.avatar_filename = stored_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/avatar", response_model=UserRead)
def delete_avatar(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.avatar_filename:
        old_path = AVATAR_DIR / current_user.avatar_filename
        if old_path.exists():
            os.unlink(old_path)
        current_user.avatar_filename = None
        db.commit()
        db.refresh(current_user)
    return current_user


@router.get("/{user_id}/avatar")
def get_avatar(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    user = get_user(db, user_id)
    if not user or not user.avatar_filename:
        raise HTTPException(status_code=404, detail="No avatar set")
    file_path = AVATAR_DIR / user.avatar_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Avatar file not found")
    media_type = mimetypes.guess_type(user.avatar_filename)[0] or "image/jpeg"
    return FileResponse(str(file_path), media_type=media_type)
