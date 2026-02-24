from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Optional
import re


class ProjectBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

    @field_validator("code")
    @classmethod
    def validate_code(cls, v):
        if not re.match(r"^[A-Z0-9]{1,20}$", v):
            raise ValueError("Project code must be 1-20 uppercase alphanumeric characters")
        return v


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ProjectRead(ProjectBase):
    id: int
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True
