from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base


class SpecimenHost(Base):
    """One host organism on a tube. A tube can have several, kept in entry order."""
    __tablename__ = "specimen_hosts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    specimen_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("specimens.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    specimen = relationship("Specimen", back_populates="host_links")
