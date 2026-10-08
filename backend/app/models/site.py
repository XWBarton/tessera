from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..database import Base

site_projects_table = Table(
    "site_projects",
    Base.metadata,
    Column("site_id", Integer, ForeignKey("sites.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
)


class Site(Base):
    __tablename__ = "sites"
    # Names are unique among siblings: see the uq_sites_parent_name index created in run_migrations.

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    parent_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sites.id"), nullable=True, index=True)
    level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    radius_m: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # GeoJSON Polygon/MultiPolygon geometry as JSON text (WGS84, lon/lat order)
    boundary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state_province: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    habitat_type: Mapped[str] = mapped_column(String(100), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lon: Mapped[float] = mapped_column(Float, nullable=True)
    precision: Mapped[str] = mapped_column(String(50), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    parent = relationship("Site", remote_side=[id], back_populates="children")
    children = relationship("Site", back_populates="parent")
    specimens = relationship("Specimen", back_populates="site")
    projects = relationship("Project", secondary=site_projects_table, lazy="joined")

    @property
    def path(self) -> str:
        """Full hierarchy path, e.g. 'Victoria > Lakes Entrance > Jemmys Point'."""
        names = []
        node, seen = self, set()
        while node is not None and node.id not in seen:
            seen.add(node.id)
            names.append(node.name)
            node = node.parent
        return " > ".join(reversed(names))
