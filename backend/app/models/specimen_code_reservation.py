from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from ..database import Base


class SpecimenCodeReservation(Base):
    """A short-lived hold on the next auto-generated tube code for a project.

    Created when a user opens the new-tube form so two people filling out the
    form for the same project at once can't both be shown (and later save) the
    same code. Consumed and deleted when the tube is actually created, or
    released/expired otherwise.
    """

    __tablename__ = "specimen_code_reservations"
    __table_args__ = (
        UniqueConstraint("project_id", "sequence_number", name="uq_reservation_project_sequence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id"), nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    reserved_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
