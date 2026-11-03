from datetime import datetime
from pydantic import BaseModel
from typing import Literal, Optional

Rank = Literal["species", "genus", "family", "order"]


class SpeciesBase(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    notes: Optional[str] = None
    genus: Optional[str] = None
    family: Optional[str] = None
    order_name: Optional[str] = None
    taxon_id: Optional[str] = None
    rank: Rank = "species"


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
    rank: Optional[Rank] = None


class SpeciesRead(SpeciesBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
