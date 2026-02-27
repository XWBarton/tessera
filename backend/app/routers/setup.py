from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from ..dependencies import get_db
from ..schemas.user import UserCreate
from ..crud.user import get_user_by_username, get_user_by_email, create_user
from ..config import settings

router = APIRouter(prefix="/setup", tags=["setup"])


class SetupData(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    password: str


@router.get("/status")
def setup_status(db: Session = Depends(get_db)):
    default_admin = get_user_by_username(db, settings.FIRST_ADMIN_USERNAME)
    needs_setup = default_admin is not None and default_admin.is_active
    return {"needs_setup": needs_setup}


@router.post("/complete")
def complete_setup(data: SetupData, db: Session = Depends(get_db)):
    default_admin = get_user_by_username(db, settings.FIRST_ADMIN_USERNAME)
    if not default_admin or not default_admin.is_active:
        raise HTTPException(status_code=400, detail="Setup already complete")
    if get_user_by_username(db, data.username):
        raise HTTPException(status_code=400, detail="Username already taken")
    if get_user_by_email(db, data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    create_user(db, UserCreate(
        username=data.username,
        full_name=data.full_name,
        email=data.email,
        password=data.password,
        is_admin=True,
    ))
    db.delete(default_admin)
    db.commit()
    return {"ok": True}
