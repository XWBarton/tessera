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
    country: Optional[str] = None
    state_province: Optional[str] = None
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    precision: Optional[str] = None
    notes: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[str] = None
    radius_m: Optional[float] = None


class SiteCreate(SiteBase):
    project_ids: List[int] = []


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    country: Optional[str] = None
    state_province: Optional[str] = None
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    precision: Optional[str] = None
    notes: Optional[str] = None
    parent_id: Optional[int] = None
    level: Optional[str] = None
    radius_m: Optional[float] = None
    project_ids: Optional[List[int]] = None


class SiteRead(SiteBase):
    id: int
    path: str
    created_at: datetime
    projects: List[SiteProjectRef] = []

    class Config:
        from_attributes = True


class DuplicateCheckRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_m: Optional[float] = None
    exclude_id: Optional[int] = None


class DuplicateMatch(BaseModel):
    site: SiteRead
    reasons: List[str]  # subset of {"name", "nearby"}
    distance_m: Optional[float] = None
    same_parent: bool


class SiteMergeRequest(BaseModel):
    target_id: int
