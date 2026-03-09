from datetime import date, datetime
from pydantic import BaseModel, model_validator
from typing import Optional, List
from .species import SpeciesRead
from .user import UserRead
from .project import ProjectRead
from .site import SiteRead
from .sample_type import SampleTypeRead


class SpecimenSpeciesBase(BaseModel):
    species_id: Optional[int] = None
    free_text_species: Optional[str] = None
    specimen_count: Optional[int] = None
    life_stage: Optional[str] = None
    sex: Optional[str] = None
    confidence: str = "Unknown"

    @model_validator(mode="after")
    def check_species_or_free_text(self):
        if self.species_id is None and not self.free_text_species:
            raise ValueError("Either species_id or free_text_species must be provided")
        return self


class SpecimenSpeciesCreate(SpecimenSpeciesBase):
    pass


class SpecimenSpeciesRead(BaseModel):
    id: int
    specimen_id: int
    species_id: Optional[int] = None
    free_text_species: Optional[str] = None
    specimen_count: Optional[int] = None
    life_stage: Optional[str] = None
    sex: Optional[str] = None
    confidence: str
    created_at: datetime
    species: Optional[SpeciesRead] = None

    class Config:
        from_attributes = True


class SpecimenBase(BaseModel):
    project_id: int
    collection_date: Optional[date] = None
    collection_date_end: Optional[date] = None
    collector_id: Optional[int] = None
    collector_name: Optional[str] = None
    site_ids: List[int] = []
    sample_type_id: Optional[int] = None
    quantity_value: Optional[float] = None
    quantity_unit: Optional[str] = None
    quantity_remaining: Optional[float] = None
    collection_lat: Optional[float] = None
    collection_lon: Optional[float] = None
    collection_location_text: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None


class SpecimenCreate(SpecimenBase):
    specimen_code: Optional[str] = None  # admin only: custom code override
    species_associations: List[SpecimenSpeciesCreate] = []


class SpecimenUpdate(BaseModel):
    specimen_code: Optional[str] = None  # admin only: rename code
    project_id: Optional[int] = None  # admin only: move to different project
    collection_date: Optional[date] = None
    collection_date_end: Optional[date] = None
    collector_id: Optional[int] = None
    collector_name: Optional[str] = None
    site_ids: Optional[List[int]] = None
    sample_type_id: Optional[int] = None
    quantity_value: Optional[float] = None
    quantity_unit: Optional[str] = None
    quantity_remaining: Optional[float] = None
    collection_lat: Optional[float] = None
    collection_lon: Optional[float] = None
    collection_location_text: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    species_associations: Optional[List[SpecimenSpeciesCreate]] = None


class SpecimenBulkImportRow(BaseModel):
    specimen_code: str
    project_code: str
    collection_date: Optional[str] = None
    collection_date_end: Optional[str] = None
    collector_name: Optional[str] = None
    site_name: Optional[str] = None
    sample_type_name: Optional[str] = None
    quantity_value: Optional[float] = None
    quantity_unit: Optional[str] = None
    storage_location: Optional[str] = None
    notes: Optional[str] = None
    species: Optional[str] = None  # semicolon-separated free-text species names


class SpecimenBulkImportRequest(BaseModel):
    rows: List[SpecimenBulkImportRow]


class SpecimenBulkImportResult(BaseModel):
    created: int
    errors: List[str]


class SpecimenRead(SpecimenBase):
    id: int
    specimen_code: str
    sequence_number: int
    entered_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SpecimenDetail(SpecimenRead):
    project: Optional[ProjectRead] = None
    collector: Optional[UserRead] = None
    entered_by: Optional[UserRead] = None
    sites: List[SiteRead] = []
    sample_type: Optional[SampleTypeRead] = None
    species_associations: List[SpecimenSpeciesRead] = []
    restricted: bool = False

    class Config:
        from_attributes = True


class SpecimenList(BaseModel):
    items: List[SpecimenDetail]
    total: int
    skip: int
    limit: int
