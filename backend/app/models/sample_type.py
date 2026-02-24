from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class SampleType(Base):
    __tablename__ = "sample_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    default_unit: Mapped[str] = mapped_column(String(50), nullable=True)  # e.g. "specimens", "mL", "mg"
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # pre-seeded, protected from delete
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    specimens = relationship("Specimen", back_populates="sample_type")
