from sqlalchemy.orm import Session
from ..models.project import Project
from ..schemas.project import ProjectCreate, ProjectUpdate
from typing import Optional, List


def get_project(db: Session, project_id: int) -> Optional[Project]:
    return db.query(Project).filter(Project.id == project_id).first()


def get_project_by_code(db: Session, code: str) -> Optional[Project]:
    return db.query(Project).filter(Project.code == code).first()


def get_projects(db: Session, skip: int = 0, limit: int = 100) -> List[Project]:
    return db.query(Project).offset(skip).limit(limit).all()


def count_projects(db: Session) -> int:
    return db.query(Project).count()


def create_project(db: Session, project: ProjectCreate, user_id: int) -> Project:
    db_project = Project(
        code=project.code,
        name=project.name,
        description=project.description,
        created_by=user_id,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


def update_project(db: Session, project: Project, project_update: ProjectUpdate) -> Project:
    update_data = project_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project: Project):
    db.delete(project)
    db.commit()
