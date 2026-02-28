from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base
from typing import Optional


class SpecimenPhoto(Base):
    __tablename__ = "specimen_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    specimen_id: Mapped[int] = mapped_column(Integer, ForeignKey("specimens.id"), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)          # UUID-based stored name
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False) # original upload name
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    uploaded_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    specimen = relationship("Specimen", back_populates="photos")
    uploaded_by = relationship("User")
