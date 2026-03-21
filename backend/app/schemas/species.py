from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class SpeciesBase(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    notes: Optional[str] = None
    genus: Optional[str] = None
    family: Optional[str] = None
    order_name: Optional[str] = None
    taxon_id: Optional[str] = None


class SpeciesCreate(SpeciesBase):
    pass


class SpeciesUpdate(BaseModel):
    scientific_name: Optional[str] = None
    common_name: Optional[str] = None
    notes: Optional[str] = None
    genus: Optional[str] = None
    family: Optional[str] = None
    order_name: Optional[str] = None
    taxon_id: Optional[str] = None


class SpeciesRead(SpeciesBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
