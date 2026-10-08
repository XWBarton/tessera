from sqlalchemy.orm import Session
from ..models.site import Site
from ..models.specimen import Specimen
from ..models.project import Project
from ..schemas.site import SiteCreate, SiteUpdate
from typing import Optional, List, Set, TYPE_CHECKING
from difflib import SequenceMatcher
import json
import math
import re
from sqlalchemy import func
from ..models.specimen import specimen_sites_table
from .. import geo

if TYPE_CHECKING:
    from ..models.user import User


def _set_projects(db: Session, site: Site, project_ids: List[int]):
    if project_ids:
        site.projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    else:
        site.projects = []


def _site_visible(site: Site, user: "User") -> bool:
    """Return False if every associated project is protected and the user has no access to any."""
    if user.is_admin:
        return True
    if not site.projects:
        return True  # untagged site — visible to everyone
    accessible = [
        p for p in site.projects
        if not p.is_protected or any(u.id == user.id for u in p.allowed_users)
    ]
    return len(accessible) > 0


def get_all_sites(db: Session, skip: int = 0, limit: int = 200, project_id: Optional[int] = None, user: Optional["User"] = None) -> List[Site]:
    q = db.query(Site)
    if project_id is not None:
        q = q.filter(Site.projects.any(id=project_id))
    sites = q.order_by(Site.name).offset(skip).limit(limit).all()
    if user is not None:
        sites = [s for s in sites if _site_visible(s, user)]
    return sites


def search_sites(db: Session, q: str, skip: int = 0, limit: int = 50, project_id: Optional[int] = None, user: Optional["User"] = None) -> List[Site]:
    query = (
        db.query(Site)
        .filter(Site.name.ilike(f"%{q}%") | Site.description.ilike(f"%{q}%"))
    )
    if project_id is not None:
        query = query.filter(Site.projects.any(id=project_id))
    sites = query.order_by(Site.name).offset(skip).limit(limit).all()
    if user is not None:
        sites = [s for s in sites if _site_visible(s, user)]
    return sites


def get_site(db: Session, site_id: int) -> Optional[Site]:
    return db.query(Site).filter(Site.id == site_id).first()


def get_site_by_name(db: Session, name: str, parent_id: Optional[int] = None, any_parent: bool = False) -> Optional[Site]:
    q = db.query(Site).filter(Site.name == name)
    if not any_parent:
        q = q.filter(Site.parent_id == parent_id) if parent_id is not None else q.filter(Site.parent_id.is_(None))
    return q.first()


def ancestor_ids(db: Session, site_id: Optional[int]) -> List[int]:
    """Ids from site_id up to the root, inclusive, nearest first."""
    out: List[int] = []
    while site_id is not None and site_id not in out:
        out.append(site_id)
        site_id = db.query(Site.parent_id).filter(Site.id == site_id).scalar()
    return out


def descendant_ids(db: Session, site_id: int) -> Set[int]:
    """All ids below site_id (excluding itself)."""
    parent_map: dict = {}
    for sid, pid in db.query(Site.id, Site.parent_id).all():
        parent_map.setdefault(pid, []).append(sid)
    found: Set[int] = set()
    stack = list(parent_map.get(site_id, []))
    while stack:
        cur = stack.pop()
        if cur in found:
            continue
        found.add(cur)
        stack.extend(parent_map.get(cur, []))
    return found


def validate_parent(db: Session, site_id: Optional[int], parent_id: Optional[int]) -> Optional[str]:
    """Return an error message if parent_id is not a valid parent for site_id."""
    if parent_id is None:
        return None
    if not get_site(db, parent_id):
        return "Parent site not found"
    if site_id is not None and (parent_id == site_id or parent_id in descendant_ids(db, site_id)):
        return "A site cannot be placed under itself or one of its own sub-sites"
    return None


def _normalise_name(name: str) -> str:
    tokens = re.sub(r"[^a-z0-9]+", " ", name.lower()).split()
    tokens = [t for t in tokens if t not in ("the", "of")]
    tokens = [t[:-1] if len(t) > 3 and t.endswith("s") else t for t in tokens]
    return " ".join(tokens)


def _names_similar(a: str, b: str) -> bool:
    na, nb = _normalise_name(a), _normalise_name(b)
    if not na or not nb:
        return False
    return na == nb or SequenceMatcher(None, na, nb).ratio() >= 0.85


def distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


MIN_PROXIMITY_M = 200.0


def find_similar_sites(
    db: Session,
    name: Optional[str],
    parent_id: Optional[int],
    lat: Optional[float],
    lon: Optional[float],
    radius_m: Optional[float],
    exclude_id: Optional[int] = None,
    user: Optional["User"] = None,
    boundary: Optional[dict] = None,
) -> List[dict]:
    """Sites that look like the one described: similar name, or overlapping/nearby location.

    Sites in the same lineage (ancestors of the proposed parent, or descendants of the
    site being edited) are skipped: a locality overlapping its own town is expected.
    """
    skip: Set[int] = set(ancestor_ids(db, parent_id))
    if exclude_id is not None:
        skip.add(exclude_id)
        skip |= descendant_ids(db, exclude_id)
    if boundary and (lat is None or lon is None):
        lat, lon = geo.boundary_centroid(boundary)
    has_coords = lat is not None and lon is not None
    results = []
    for cand in db.query(Site).all():
        if cand.id in skip:
            continue
        if user is not None and not _site_visible(cand, user):
            continue
        reasons = []
        if name and _names_similar(name, cand.name):
            reasons.append("name")
        dist = None
        if has_coords and cand.lat is not None and cand.lon is not None:
            dist = distance_m(lat, lon, cand.lat, cand.lon)
            cand_boundary = geo.parse_boundary(cand.boundary)
            if boundary or cand_boundary:
                # At least one real polygon: compare actual footprints rather than circles
                a = geo.local_footprint(boundary, lat, lon, radius_m, lat)
                b = geo.local_footprint(cand_boundary, cand.lat, cand.lon, cand.radius_m, lat)
                if a is not None and b is not None and geo.footprints_conflict(a, b):
                    reasons.append("nearby")
            elif dist <= max((radius_m or 0) + (cand.radius_m or 0), MIN_PROXIMITY_M):
                reasons.append("nearby")
        if reasons:
            results.append({
                "site": cand,
                "reasons": reasons,
                "distance_m": round(dist, 1) if dist is not None else None,
                "same_parent": cand.parent_id == parent_id,
            })
    results.sort(key=lambda r: (-len(r["reasons"]), r["distance_m"] if r["distance_m"] is not None else 1e12))
    return results[:10]


def sites_at_point(db: Session, lat: float, lon: float, user: Optional["User"] = None) -> List[Site]:
    """Sites whose boundary (or radius circle) contains the point, most specific first."""
    parent_of = dict(db.query(Site.id, Site.parent_id).all())

    def depth(site_id: int) -> int:
        d, seen = 0, set()
        while parent_of.get(site_id) is not None and site_id not in seen:
            seen.add(site_id)
            site_id = parent_of[site_id]
            d += 1
        return d

    hits = [
        s for s in db.query(Site).all()
        if geo.point_in_site(s, lat, lon) and (user is None or _site_visible(s, user))
    ]
    hits.sort(key=lambda s: (-depth(s.id), geo.site_area_m2(s)))
    return hits


def get_sites_for_export(db: Session, ids: Optional[List[int]] = None, project_id: Optional[int] = None,
                         user: Optional["User"] = None) -> List[Site]:
    q = db.query(Site)
    if ids:
        q = q.filter(Site.id.in_(ids))
    if project_id is not None:
        q = q.filter(Site.projects.any(id=project_id))
    sites = q.order_by(Site.name).all()
    if user is not None:
        sites = [s for s in sites if _site_visible(s, user)]
    return sites


def specimen_counts(db: Session) -> dict:
    """Specimens linked directly to each site (via the many-to-many table)."""
    rows = (
        db.query(specimen_sites_table.c.site_id, func.count(func.distinct(specimen_sites_table.c.specimen_id)))
        .group_by(specimen_sites_table.c.site_id)
        .all()
    )
    return {sid: n for sid, n in rows}


def merge_sites(db: Session, source: Site, target: Site) -> None:
    """Move everything from source onto target, then delete source."""
    # Specimen links (many-to-many): add target where missing, then drop source rows.
    spec_ids = [r[0] for r in db.query(specimen_sites_table.c.specimen_id).filter(specimen_sites_table.c.site_id == source.id)]
    already = {r[0] for r in db.query(specimen_sites_table.c.specimen_id).filter(specimen_sites_table.c.site_id == target.id)}
    for sp_id in spec_ids:
        if sp_id not in already:
            db.execute(specimen_sites_table.insert().values(specimen_id=sp_id, site_id=target.id))
    db.execute(specimen_sites_table.delete().where(specimen_sites_table.c.site_id == source.id))
    db.query(Specimen).filter(Specimen.site_id == source.id).update({Specimen.site_id: target.id}, synchronize_session=False)
    # Sub-sites and project tags
    db.query(Site).filter(Site.parent_id == source.id).update({Site.parent_id: target.id}, synchronize_session=False)
    for proj in list(source.projects):
        if proj not in target.projects:
            target.projects.append(proj)
    # Fill gaps on the target from the source
    for field in ("lat", "lon", "radius_m", "habitat_type", "description", "country", "state_province", "precision"):
        if getattr(target, field) is None and getattr(source, field) is not None:
            setattr(target, field, getattr(source, field))
    source.projects = []
    db.flush()
    db.expire(source)
    db.delete(source)
    db.flush()
    db.refresh(target)
    sync_geo_fields(db, target)
    db.commit()


COUNTRY_LEVELS = {"country"}
STATE_LEVELS = {"state", "province", "territory", "state/province"}


def sync_geo_fields(db: Session, site: Site) -> None:
    """Set country/state_province on site and everything beneath it from ancestors with a
    Country / State level. Sites with no such ancestor keep whatever text they already have."""
    def apply(node: Site, country: Optional[str], state: Optional[str], seen: Set[int]) -> None:
        if node.id in seen:
            return
        seen.add(node.id)
        lvl = (node.level or "").strip().lower()
        if lvl in COUNTRY_LEVELS:
            country = node.name
        elif lvl in STATE_LEVELS:
            state = node.name
        if country:
            node.country = country
        if state:
            node.state_province = state
        for child in node.children:
            apply(child, country, state, seen)

    country = state = None
    chain, node, seen_up = [], site.parent, {site.id}
    while node is not None and node.id not in seen_up:
        seen_up.add(node.id)
        chain.append(node)
        node = node.parent
    for anc in reversed(chain):  # root first, so nearer ancestors win
        lvl = (anc.level or "").strip().lower()
        if lvl in COUNTRY_LEVELS:
            country = anc.name
        elif lvl in STATE_LEVELS:
            state = anc.name
    apply(site, country, state, set())


def backfill_hierarchy(db: Session, apply: bool) -> dict:
    """Create Country / State nodes from the text country and state_province fields and move
    top-level sites under them. With apply=False nothing is saved (the work is rolled back)."""
    created: List[str] = []
    moved: List[dict] = []
    skipped: List[dict] = []

    def find_or_create(name: str, level: str, parent: Optional[Site]) -> Site:
        pid = parent.id if parent else None
        q = db.query(Site).filter(func.lower(Site.name) == name.lower())
        q = q.filter(Site.parent_id == pid) if pid is not None else q.filter(Site.parent_id.is_(None))
        node = q.first()
        if node:
            if not node.level:
                node.level = level
            return node
        node = Site(name=name, level=level, parent_id=pid)
        db.add(node)
        db.flush()
        db.refresh(node)
        created.append(f"{node.path} ({level})")
        touched.append(node)
        return node

    touched: List[Site] = []
    candidates = db.query(Site).filter(Site.parent_id.is_(None)).order_by(Site.id).all()
    # Sites that already are a place node (named after their own state/country) go first so
    # that later sites find and reuse them instead of a duplicate node being created.
    def _is_place_node(s: Site) -> bool:
        n = s.name.strip().lower()
        return n in {(s.country or "").strip().lower(), (s.state_province or "").strip().lower()} - {""}
    candidates.sort(key=lambda s: (not _is_place_node(s), s.id))
    for site in candidates:
        country = (site.country or "").strip()
        state = (site.state_province or "").strip()
        if not country and not state:
            continue
        if (site.level or "").strip().lower() in COUNTRY_LEVELS | STATE_LEVELS:
            continue
        if site.name.strip().lower() == country.lower():
            if not site.level:
                site.level = "Country"
            continue
        parent: Optional[Site] = find_or_create(country, "Country", None) if country else None
        if site.name.strip().lower() == state.lower():
            # This site *is* the state: keep it, file it under its country
            if not site.level:
                site.level = "State"
        elif state:
            parent = find_or_create(state, "State", parent)
        if parent is None:
            continue
        clash = get_site_by_name(db, site.name, parent.id)
        if clash and clash.id != site.id:
            skipped.append({"id": site.id, "name": site.name,
                            "reason": f"'{clash.path}' already exists: possible duplicate, merge them first"})
            continue
        site.parent_id = parent.id
        db.flush()
        db.refresh(site)
        moved.append({"id": site.id, "name": site.name, "to": parent.path})
        touched.append(site)
    for site in touched:
        sync_geo_fields(db, site)
    result = {"created": created, "moved": moved, "skipped": skipped, "applied": apply}
    if apply:
        db.commit()
    else:
        db.rollback()
    return result


def _prepare_boundary(data: dict, existing: Optional[Site] = None) -> None:
    """Serialise a boundary dict to JSON text, and give a boundary-only site its centroid as lat/lon."""
    if data.get("boundary") is None:
        return
    boundary = data["boundary"]
    data["boundary"] = json.dumps(boundary)
    have_lat = data.get("lat", existing.lat if existing else None)
    have_lon = data.get("lon", existing.lon if existing else None)
    if have_lat is None or have_lon is None:
        data["lat"], data["lon"] = geo.boundary_centroid(boundary)


def create_site(db: Session, site: SiteCreate) -> Site:
    data = site.model_dump(exclude={'project_ids'})
    _prepare_boundary(data)
    db_site = Site(**data)
    _set_projects(db, db_site, site.project_ids)
    db.add(db_site)
    db.flush()
    db.refresh(db_site)
    sync_geo_fields(db, db_site)
    db.commit()
    db.refresh(db_site)
    return db_site


def update_site(db: Session, site: Site, updates: SiteUpdate) -> Site:
    data = updates.model_dump(exclude_unset=True, exclude={'project_ids'})
    _prepare_boundary(data, site)
    for field, value in data.items():
        setattr(site, field, value)
    if 'project_ids' in updates.model_fields_set:
        _set_projects(db, site, updates.project_ids or [])
    db.flush()
    db.refresh(site)
    sync_geo_fields(db, site)
    db.commit()
    db.refresh(site)
    return site


def delete_site(db: Session, site: Site):
    # Sub-sites move up to this site's parent so the tree stays connected.
    db.query(Site).filter(Site.parent_id == site.id).update(
        {Site.parent_id: site.parent_id}, synchronize_session=False
    )
    # Clear the legacy single-site FK on any specimen still pointing here.
    # That column has no ON DELETE rule, so SQLite would otherwise block the
    # delete; the many-to-many specimen_sites associations cascade on their own.
    db.query(Specimen).filter(Specimen.site_id == site.id).update(
        {Specimen.site_id: None}, synchronize_session=False
    )
    db.flush()
    db.expire(site)
    db.delete(site)
    db.commit()
