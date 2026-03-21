from datetime import datetime, timezone
from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import Optional


class Species(Base):
    __tablename__ = "species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scientific_name: Mapped[str] = mapped_column(String(200), unique=True, index=True, nullable=False)
    common_name: Mapped[str] = mapped_column(String(200), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    genus: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    family: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    order_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    taxon_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    specimen_associations = relationship("SpecimenSpecies", back_populates="species")
