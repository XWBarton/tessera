from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class SampleTypeBase(BaseModel):
    name: str
    default_unit: Optional[str] = None


class SampleTypeCreate(SampleTypeBase):
    pass


class SampleTypeUpdate(BaseModel):
    name: Optional[str] = None
    default_unit: Optional[str] = None


class SampleTypeRead(SampleTypeBase):
    id: int
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True
