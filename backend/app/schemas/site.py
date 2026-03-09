from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List


class SiteProjectRef(BaseModel):
    id: int
    code: str
    name: str

    class Config:
        from_attributes = True


class SiteBase(BaseModel):
    name: str
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    precision: Optional[str] = None
    notes: Optional[str] = None


class SiteCreate(SiteBase):
    project_ids: List[int] = []


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    precision: Optional[str] = None
    notes: Optional[str] = None
    project_ids: Optional[List[int]] = None


class SiteRead(SiteBase):
    id: int
    created_at: datetime
    projects: List[SiteProjectRef] = []

    class Config:
        from_attributes = True
