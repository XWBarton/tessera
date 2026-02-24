from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class SiteBase(BaseModel):
    name: str
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    notes: Optional[str] = None


class SiteCreate(SiteBase):
    pass


class SiteUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    habitat_type: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    notes: Optional[str] = None


class SiteRead(SiteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
