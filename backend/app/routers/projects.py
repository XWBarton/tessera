from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..dependencies import get_db, get_current_user, require_admin
from ..crud.project import (
    get_project,
    get_projects,
    create_project,
    update_project,
    delete_project,
    get_project_by_code,
)
from ..crud.specimen import get_specimens
from ..schemas.project import ProjectRead, ProjectCreate, ProjectUpdate
from ..schemas.specimen import SpecimenList
from ..models.user import User
from typing import List

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectRead])
def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return get_projects(db, skip, limit)


@router.post("/", response_model=ProjectRead)
def create_new_project(
    project: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if get_project_by_code(db, project.code):
        raise HTTPException(status_code=400, detail="Project code already exists")
    return create_project(db, project, current_user.id)


@router.get("/{project_id}", response_model=ProjectRead)
def read_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_existing_project(
    project_id: int,
    project_update: ProjectUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return update_project(db, project, project_update)


@router.delete("/{project_id}")
def delete_existing_project(
    project_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    delete_project(db, project)
    return {"message": "Project deleted"}


@router.get("/{project_id}/specimens", response_model=SpecimenList)
def list_project_specimens(
    project_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    project = get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    items, total = get_specimens(db, project_id=project_id, skip=skip, limit=limit)
    return {"items": items, "total": total, "skip": skip, "limit": limit}
