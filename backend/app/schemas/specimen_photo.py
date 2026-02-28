from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class UploaderInfo(BaseModel):
    id: int
    full_name: str
    model_config = {"from_attributes": True}


class SpecimenPhotoRead(BaseModel):
    id: int
    specimen_id: int
    filename: str
    original_filename: str
    caption: Optional[str] = None
    uploaded_by_id: int
    uploaded_at: datetime
    uploaded_by: Optional[UploaderInfo] = None
    model_config = {"from_attributes": True}
