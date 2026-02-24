from pydantic import BaseModel


class LookupOptionCreate(BaseModel):
    value: str


class LookupOptionRead(BaseModel):
    id: int
    category: str
    value: str
    sort_order: int

    class Config:
        from_attributes = True
