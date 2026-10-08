"""Geometry helpers for site boundaries.

Boundaries are stored as GeoJSON geometry (Polygon / MultiPolygon) in WGS84 (EPSG:4326),
[lon, lat] order. Overlap tests are done in a local metre-based projection so distances
and areas are meaningful at site scale.
"""
import io
import json
import math
import zipfile
from typing import Iterable, List, Optional

import shapefile  # pyshp
from shapely import to_wkt
from shapely.geometry import Point, mapping, shape
from shapely.geometry.base import BaseGeometry
from shapely.geometry.polygon import orient
from shapely.ops import transform
from shapely.validation import explain_validity

MAX_VERTICES = 5000
POINT_TOLERANCE_M = 50.0      # a point this close to a boundary counts as "at" the site
OVERLAP_RATIO = 0.5           # polygons conflict when this share of the smaller one overlaps

PRJ_WGS84 = (
    'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],'
    'PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]'
)


def _count_vertices(coords) -> int:
    if coords and isinstance(coords[0], (int, float)):
        return 1
    return sum(_count_vertices(c) for c in coords)


def _round_coords(coords, places: int = 6):
    if coords and isinstance(coords[0], (int, float)):
        return [round(coords[0], places), round(coords[1], places)]
    return [_round_coords(c, places) for c in coords]


def validate_boundary(geom: dict) -> dict:
    """Return a cleaned GeoJSON geometry, or raise ValueError with a user-facing reason."""
    if not isinstance(geom, dict) or geom.get("type") not in ("Polygon", "MultiPolygon"):
        raise ValueError("Boundary must be a GeoJSON Polygon or MultiPolygon")
    coords = geom.get("coordinates")
    if not coords:
        raise ValueError("Boundary has no coordinates")
    if _count_vertices(coords) > MAX_VERTICES:
        raise ValueError(f"Boundary has too many points (limit {MAX_VERTICES}); simplify it first")
    try:
        cleaned = {"type": geom["type"], "coordinates": _round_coords(coords)}
        g = shape(cleaned)
    except Exception:
        raise ValueError("Boundary coordinates are malformed")
    minx, miny, maxx, maxy = g.bounds
    if minx < -180 or maxx > 180 or miny < -90 or maxy > 90:
        raise ValueError("Boundary coordinates must be longitude/latitude in degrees (WGS84)")
    if not g.is_valid:
        raise ValueError(f"Boundary is not a valid shape: {explain_validity(g)}")
    if g.is_empty or g.area == 0:
        raise ValueError("Boundary has no area")
    return cleaned


def parse_boundary(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return None


def boundary_centroid(boundary: dict) -> tuple:
    c = shape(boundary).centroid
    return round(c.y, 6), round(c.x, 6)  # lat, lon


def _local_transform(lat0: float):
    kx = 111320.0 * math.cos(math.radians(lat0))
    ky = 110540.0
    return lambda x, y, z=None: (x * kx, y * ky)


def to_local(geom: BaseGeometry, lat0: float) -> BaseGeometry:
    """Project lon/lat degrees to approximate metres around lat0 (equirectangular)."""
    return transform(_local_transform(lat0), geom)


def local_footprint(
    boundary: Optional[dict], lat: Optional[float], lon: Optional[float], radius_m: Optional[float], lat0: float
) -> Optional[BaseGeometry]:
    """A site's extent in local metres: its polygon, else its circle, else its point."""
    if boundary:
        return to_local(shape(boundary), lat0)
    if lat is None or lon is None:
        return None
    pt = to_local(Point(lon, lat), lat0)
    return pt.buffer(radius_m) if radius_m else pt


def footprints_conflict(a: BaseGeometry, b: BaseGeometry) -> bool:
    """True when two footprints (local metres) overlap enough to be the same place."""
    if a.is_empty or b.is_empty:
        return False
    if a.area == 0 or b.area == 0:  # one is a bare point
        return a.distance(b) <= POINT_TOLERANCE_M
    return a.intersection(b).area / min(a.area, b.area) >= OVERLAP_RATIO


def area_ha(boundary: dict) -> float:
    g = shape(boundary)
    return round(to_local(g, g.centroid.y).area / 10000.0, 2)


def footprint_wkt(boundary: dict) -> str:
    return to_wkt(shape(boundary), rounding_precision=6)


def point_in_site(site, lat: float, lon: float) -> bool:
    """Does the point fall in the site's boundary (or, lacking one, within its radius circle)?"""
    boundary = parse_boundary(site.boundary)
    if boundary:
        return shape(boundary).covers(Point(lon, lat))
    if site.lat is not None and site.lon is not None and site.radius_m:
        a = to_local(Point(site.lon, site.lat), lat)
        b = to_local(Point(lon, lat), lat)
        return a.distance(b) <= site.radius_m
    return False


def site_area_m2(site) -> float:
    boundary = parse_boundary(site.boundary)
    if boundary:
        return area_ha(boundary) * 10000.0
    return math.pi * (site.radius_m or 0) ** 2


# ---------------------------------------------------------------- exports

def _properties(site) -> dict:
    boundary = parse_boundary(site.boundary)
    return {
        "site_id": site.id,
        "name": site.name,
        "path": site.path,
        "level": site.level,
        "country": site.country,
        "state": site.state_province,
        "habitat": site.habitat_type,
        "radius_m": site.radius_m,
        "area_ha": area_ha(boundary) if boundary else None,
        "projects": ", ".join(p.code for p in site.projects),
    }


def sites_to_geojson(sites: Iterable) -> dict:
    features = []
    for site in sites:
        boundary = parse_boundary(site.boundary)
        if boundary:
            geometry = boundary
        elif site.lat is not None and site.lon is not None:
            geometry = {"type": "Point", "coordinates": [site.lon, site.lat]}
        else:
            continue
        features.append({"type": "Feature", "properties": _properties(site), "geometry": geometry})
    return {
        "type": "FeatureCollection",
        "name": "tessera_sites",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }


# Shapefile attribute names are limited to 10 characters
_DBF_FIELDS = [
    ("SITE_ID", "N", 10, 0),
    ("NAME", "C", 200, 0),
    ("PATH", "C", 254, 0),
    ("LEVEL", "C", 50, 0),
    ("COUNTRY", "C", 100, 0),
    ("STATE", "C", 100, 0),
    ("HABITAT", "C", 100, 0),
    ("RADIUS_M", "N", 14, 2),
    ("AREA_HA", "N", 14, 2),
    ("PROJECTS", "C", 254, 0),
]
_README = """Tessera site export (Shapefile)

Coordinate system: WGS 84 (EPSG:4326), longitude/latitude in decimal degrees.
Text encoding: UTF-8 (see the .cpg files).

sites_polygons.*  Sites with a drawn boundary (polygons).
sites_points.*    Sites that only have a point location (RADIUS_M is the uncertainty/extent in metres).

Fields: SITE_ID, NAME, PATH (full hierarchy, e.g. 'Victoria > Lakes Entrance > Jemmys Point'),
LEVEL, COUNTRY, STATE, HABITAT, RADIUS_M, AREA_HA (hectares, polygons only), PROJECTS (project codes).
Shapefile field names are limited to 10 characters, hence the abbreviations.
"""


def _write_shapefile(name: str, shape_type: int, rows: List[tuple], zf: zipfile.ZipFile) -> None:
    shp, shx, dbf = io.BytesIO(), io.BytesIO(), io.BytesIO()
    w = shapefile.Writer(shp=shp, shx=shx, dbf=dbf, shapeType=shape_type, encoding="utf-8")
    for fname, ftype, size, dec in _DBF_FIELDS:
        w.field(fname, ftype, size, dec)
    for geometry, props in rows:
        w.shape(geometry)
        w.record(
            props["site_id"], (props["name"] or "")[:200], (props["path"] or "")[:254], props["level"] or "",
            props["country"] or "", props["state"] or "", props["habitat"] or "",
            props["radius_m"], props["area_ha"], (props["projects"] or "")[:254],
        )
    w.close()
    zf.writestr(f"{name}.shp", shp.getvalue())
    zf.writestr(f"{name}.shx", shx.getvalue())
    zf.writestr(f"{name}.dbf", dbf.getvalue())
    zf.writestr(f"{name}.prj", PRJ_WGS84)
    zf.writestr(f"{name}.cpg", "UTF-8")


def sites_to_shapefile_zip(sites: Iterable) -> bytes:
    polygons, points = [], []
    for site in sites:
        boundary = parse_boundary(site.boundary)
        props = _properties(site)
        if boundary:
            # Shapefiles want exterior rings clockwise and holes counter-clockwise (opposite of GeoJSON)
            g = shape(boundary)
            polys = [orient(p, sign=-1.0) for p in (g.geoms if g.geom_type == "MultiPolygon" else [g])]
            geom = polys[0] if len(polys) == 1 else type(g)(polys)
            polygons.append((mapping(geom), props))
        elif site.lat is not None and site.lon is not None:
            points.append(({"type": "Point", "coordinates": [site.lon, site.lat]}, props))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        if polygons:
            _write_shapefile("sites_polygons", shapefile.POLYGON, polygons, zf)
        if points:
            _write_shapefile("sites_points", shapefile.POINT, points, zf)
        zf.writestr("README.txt", _README)
    return buf.getvalue()
