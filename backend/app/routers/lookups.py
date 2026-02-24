from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.lookup_option import get_options, create_option, delete_option, get_option
from ..schemas.lookup_option import LookupOptionCreate, LookupOptionRead
from ..models.user import User
from typing import List

VALID_CATEGORIES = {"life_stage", "sex", "unit"}

router = APIRouter(prefix="/lookups", tags=["lookups"])


@router.get("/{category}", response_model=List[LookupOptionRead])
def list_options(
    category: str,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown category")
    return get_options(db, category)


@router.post("/{category}", response_model=LookupOptionRead)
def add_option(
    category: str,
    body: LookupOptionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if category not in VALID_CATEGORIES:
        raise HTTPException(status_code=404, detail="Unknown category")
    if not body.value.strip():
        raise HTTPException(status_code=422, detail="Value cannot be empty")
    try:
        return create_option(db, category, body.value)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Option already exists")


@router.delete("/{category}/{option_id}", status_code=204)
def remove_option(
    category: str,
    option_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    option = get_option(db, option_id)
    if not option or option.category != category:
        raise HTTPException(status_code=404, detail="Option not found")
    delete_option(db, option)
