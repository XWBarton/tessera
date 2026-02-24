import json
from datetime import date, datetime
from pydantic import BaseModel, field_validator
from typing import Optional, List
from .user import UserRead


class BreakdownItem(BaseModel):
    label: str
    count: int


class TubeUsageLogCreate(BaseModel):
    date: date
    quantity_taken: float
    unit: str
    purpose: Optional[str] = None
    molecular_ref: Optional[str] = None
    breakdown: Optional[List[BreakdownItem]] = None
    notes: Optional[str] = None


class TubeUsageLogRead(BaseModel):
    id: int
    specimen_id: int
    date: date
    quantity_taken: float
    unit: str
    purpose: Optional[str] = None
    molecular_ref: Optional[str] = None
    breakdown: Optional[List[BreakdownItem]] = None
    notes: Optional[str] = None
    created_at: datetime
    taken_by: Optional[UserRead] = None

    @field_validator('breakdown', mode='before')
    @classmethod
    def parse_breakdown(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v

    class Config:
        from_attributes = True
