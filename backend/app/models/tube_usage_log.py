from datetime import datetime, date, timezone
from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import Optional


class TubeUsageLog(Base):
    __tablename__ = "tube_usage_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specimen_id: Mapped[int] = mapped_column(Integer, ForeignKey("specimens.id"), nullable=False, index=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    quantity_taken: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    purpose: Mapped[str] = mapped_column(String(200), nullable=True)       # e.g. "DNA extraction", "morphology"
    taken_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    molecular_ref: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)  # future: Tessera Molecular job ID
    breakdown: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: [{label, count}]
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    specimen = relationship("Specimen", back_populates="usage_log")
    taken_by = relationship("User")
