from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class SpecimenSpecies(Base):
    __tablename__ = "specimen_species"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specimen_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("specimens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    species_id: Mapped[int] = mapped_column(Integer, ForeignKey("species.id"), nullable=True)
    free_text_species: Mapped[str] = mapped_column(Text, nullable=True)
    specimen_count: Mapped[int] = mapped_column(Integer, nullable=True)
    life_stage: Mapped[str] = mapped_column(String(20), nullable=True)
    sex: Mapped[str] = mapped_column(String(10), nullable=True)
    confidence: Mapped[str] = mapped_column(String(20), nullable=False, default="Unknown")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    specimen = relationship("Specimen", back_populates="species_associations")
    species = relationship("Species", back_populates="specimen_associations")
