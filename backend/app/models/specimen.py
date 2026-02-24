from datetime import datetime, timezone
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import Optional


class Specimen(Base):
    __tablename__ = "specimens"
    __table_args__ = (
        UniqueConstraint("project_id", "sequence_number", name="uq_project_sequence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specimen_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    collection_date: Mapped[datetime] = mapped_column(Date, nullable=True)
    collector_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    collector_name: Mapped[str] = mapped_column(String(200), nullable=True)
    entered_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    site_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sites.id"), nullable=True)
    sample_type_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sample_types.id"), nullable=True)
    quantity_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    quantity_unit: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    quantity_remaining: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    collection_lat: Mapped[float] = mapped_column(Float, nullable=True)
    collection_lon: Mapped[float] = mapped_column(Float, nullable=True)
    collection_location_text: Mapped[str] = mapped_column(Text, nullable=True)
    storage_location: Mapped[str] = mapped_column(String(200), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    project = relationship("Project", back_populates="specimens")
    collector = relationship("User", back_populates="specimens_collected", foreign_keys=[collector_id])
    entered_by = relationship("User", back_populates="specimens_entered", foreign_keys=[entered_by_id])
    site = relationship("Site", back_populates="specimens")
    sample_type = relationship("SampleType", back_populates="specimens")
    usage_log = relationship("TubeUsageLog", back_populates="specimen", cascade="all, delete-orphan")
    species_associations = relationship(
        "SpecimenSpecies", back_populates="specimen", cascade="all, delete-orphan"
    )
