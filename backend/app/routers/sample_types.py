from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.sample_type import (
    get_all_sample_types, get_sample_type, get_sample_type_by_name,
    create_sample_type, update_sample_type, delete_sample_type,
)
from ..schemas.sample_type import SampleTypeRead, SampleTypeCreate, SampleTypeUpdate
from ..models.user import User
from typing import List

router = APIRouter(prefix="/sample-types", tags=["sample-types"])


@router.get("/", response_model=List[SampleTypeRead])
def list_sample_types(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_all_sample_types(db)


@router.post("/", response_model=SampleTypeRead)
def create_new_sample_type(
    data: SampleTypeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if get_sample_type_by_name(db, data.name):
        raise HTTPException(status_code=400, detail="A sample type with this name already exists")
    return create_sample_type(db, data)


@router.put("/{sample_type_id}", response_model=SampleTypeRead)
def update_existing_sample_type(
    sample_type_id: int,
    updates: SampleTypeUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    st = get_sample_type(db, sample_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Sample type not found")
    return update_sample_type(db, st, updates)


@router.delete("/{sample_type_id}")
def delete_existing_sample_type(
    sample_type_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    st = get_sample_type(db, sample_type_id)
    if not st:
        raise HTTPException(status_code=404, detail="Sample type not found")
    delete_sample_type(db, st)
    return {"message": "Sample type deleted"}
