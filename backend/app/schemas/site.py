import json
from datetime import datetime
from pydantic import BaseModel, field_validator
from typing import Optional, List

from ..geo import validate_boundary


def _check_boundary(v):
    return validate_boundary(v) if v is not None else None


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
    boundary: Optional[dict] = None
    project_ids: List[int] = []

    _validate_boundary = field_validator("boundary")(_check_boundary)


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
    boundary: Optional[dict] = None
    project_ids: Optional[List[int]] = None

    _validate_boundary = field_validator("boundary")(_check_boundary)


class SiteRead(SiteBase):
    id: int
    path: str
    boundary: Optional[dict] = None
    created_at: datetime
    projects: List[SiteProjectRef] = []

    @field_validator("boundary", mode="before")
    @classmethod
    def _parse_boundary(cls, v):
        return json.loads(v) if isinstance(v, str) else v

    class Config:
        from_attributes = True


class DuplicateCheckRequest(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    radius_m: Optional[float] = None
    boundary: Optional[dict] = None
    exclude_id: Optional[int] = None


class DuplicateMatch(BaseModel):
    site: SiteRead
    reasons: List[str]  # subset of {"name", "nearby"}
    distance_m: Optional[float] = None
    same_parent: bool


class SiteMergeRequest(BaseModel):
    target_id: int
