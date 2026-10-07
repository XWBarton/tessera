from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class StorageUnitBase(BaseModel):
    name: str
    notes: Optional[str] = None


class StorageUnitCreate(StorageUnitBase):
    pass


class StorageUnitUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None


class StorageUnitRead(StorageUnitBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StorageTrayBase(BaseModel):
    unit_id: int
    name: str
    capacity: int = 50
    notes: Optional[str] = None


class StorageTrayCreate(StorageTrayBase):
    pass


class StorageTrayUpdate(BaseModel):
    unit_id: Optional[int] = None
    name: Optional[str] = None
    capacity: Optional[int] = None
    notes: Optional[str] = None


class StorageTrayRead(StorageTrayBase):
    id: int
    created_at: datetime
    unit: Optional[StorageUnitRead] = None

    class Config:
        from_attributes = True


class StorageOccupant(BaseModel):
    id: int
    specimen_code: str
    project_code: str
    species: str

    class Config:
        from_attributes = True


class StorageTrayPosition(BaseModel):
    position: int
    occupants: list[StorageOccupant] = []
