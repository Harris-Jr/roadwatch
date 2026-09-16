"""
Real route computation + real pothole hazard scoring.

Two responsibilities:
1. Get real route alternatives (geometry, distance, duration) from a
   self-hosted OSRM instance — not estimated, not hardcoded.
2. Score each alternative by querying the REAL `reports` table for
   confirmed severe/moderate/minor reports within a buffer of that route's
   actual road-following geometry, using PostGIS ST_DWithin on a geography
   cast (meters, not degrees).

Used by both /routing (Navigate) and business corridor risk — same "real
route + real hazard score between two points" primitive, reused rather
than rebuilt twice.

Degrades gracefully if OSRM isn't reachable (e.g. before you've run the
Zambia extract): falls back to a straight-line estimate, clearly flagged
as such in the response so the frontend can be honest about it rather than
presenting a guess as a real route.
"""

import logging
import math
from dataclasses import dataclass, field

import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings

logger = logging.getLogger(__name__)

# Meters. How close a confirmed report needs to be to a route's geometry to
# count as "along" that route.
HAZARD_BUFFER_METERS = 60

# Wider buffer for the straight-line fallback (no OSRM) — a straight line
# between two points doesn't follow real roads, so a tight buffer would
# miss hazards on the actual road a driver would take.
FALLBACK_HAZARD_BUFFER_METERS = 300

# Assumed average speed (km/h) for the straight-line fallback's duration
# estimate. Used explicitly below rather than folded into a formula that
# only happens to work at this one value.
FALLBACK_SPEED_KMH = 60

# Relative severity weights for ranking routes — severe hazards count for
# more than minor ones when picking the "Safest" option.
SEVERITY_WEIGHT = {"minor": 1, "moderate": 3, "severe": 6}


@dataclass
class HazardBreakdown:
    minor: int = 0
    moderate: int = 0
    severe: int = 0

    @property
    def total(self) -> int:
        return self.minor + self.moderate + self.severe

    @property
    def score(self) -> int:
        return (
            self.minor * SEVERITY_WEIGHT["minor"]
            + self.moderate * SEVERITY_WEIGHT["moderate"]
            + self.severe * SEVERITY_WEIGHT["severe"]
        )


@dataclass
class RouteStep:
    instruction: str
    distance_m: float
    lat: float
    lon: float


@dataclass
class RouteOption:
    geometry: dict  # GeoJSON LineString
    distance_km: float
    duration_min: float
    hazards: HazardBreakdown
    estimated: bool  # True if OSRM was unreachable and this is a straight-line fallback
    steps: list[RouteStep] = field(default_factory=list)
    label: str = ""  # filled in by rank_routes


def _describe_maneuver(step: dict) -> str:
    """Turns an OSRM maneuver object into a plain-language instruction.
    Real, derived from the actual route — not a canned string per route."""
    maneuver = step.get("maneuver", {})
    m_type = maneuver.get("type", "")
    modifier = maneuver.get("modifier", "")
    name = step.get("name") or "the road"

    if m_type == "depart":
        return f"Head out onto {name}" if name != "the road" else "Head out"
    if m_type == "arrive":
        return "You have arrived at your destination"
    if m_type in ("turn", "end of road", "fork", "ramp", "on ramp", "off ramp"):
        direction = modifier.replace("slight ", "").replace("sharp ", "") or "straight"
        if direction == "straight":
            return f"Continue straight onto {name}"
        prefix = "Turn" if m_type == "turn" else "Bear"
        return f"{prefix} {direction} onto {name}"
    if m_type in ("roundabout", "rotary"):
        exit_n = maneuver.get("exit")
        return f"At the roundabout, take exit {exit_n} onto {name}" if exit_n else f"Enter the roundabout onto {name}"
    if m_type in ("continue", "new name"):
        return f"Continue onto {name}"
    if m_type == "merge":
        return f"Merge onto {name}"
    return f"Continue onto {name}"


def _extract_steps(osrm_route: dict) -> list[RouteStep]:
    steps: list[RouteStep] = []
    for leg in osrm_route.get("legs", []):
        for step in leg.get("steps", []):
            location = step.get("maneuver", {}).get("location", [None, None])
            lon, lat = location if len(location) == 2 else (None, None)
            if lat is None or lon is None:
                continue
            steps.append(
                RouteStep(
                    instruction=_describe_maneuver(step),
                    distance_m=step.get("distance", 0.0),
                    lat=lat,
                    lon=lon,
                )
            )
    return steps


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _fetch_osrm_alternatives(
    from_lat: float, from_lon: float, to_lat: float, to_lon: float
) -> list[dict] | None:
    """Returns raw OSRM route objects, or None if OSRM isn't reachable."""
    url = (
        f"{settings.osrm_url}/route/v1/driving/"
        f"{from_lon},{from_lat};{to_lon},{to_lat}"
    )
    try:
        resp = requests.get(
            url,
            params={
                "alternatives": "true",
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
            },
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok":
            logger.warning("OSRM returned non-Ok code: %s", data.get("code"))
            return None
        return data["routes"]
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning(
            "OSRM unreachable at %s (%s) — falling back to straight-line "
            "estimate. Set up the Zambia OSRM data if this persists.",
            settings.osrm_url,
            exc,
        )
        return None


def _score_route(
    db: Session, geojson_linestring: dict, buffer_meters: float = HAZARD_BUFFER_METERS
) -> HazardBreakdown:
    import json

    result = db.execute(
        text(
            """
            SELECT severity, count(*) as n
            FROM reports
            WHERE confirmed = true
              AND ST_DWithin(
                    location::geography,
                    ST_GeomFromGeoJSON(:geom)::geography,
                    :buffer
                  )
            GROUP BY severity
            """
        ),
        {"geom": json.dumps(geojson_linestring), "buffer": buffer_meters},
    )
    breakdown = HazardBreakdown()
    for row in result:
        setattr(breakdown, row.severity, row.n)
    return breakdown


def get_route_options(
    db: Session, from_lat: float, from_lon: float, to_lat: float, to_lon: float
) -> list[RouteOption]:
    osrm_routes = _fetch_osrm_alternatives(from_lat, from_lon, to_lat, to_lon)

    options: list[RouteOption] = []

    if osrm_routes:
        for r in osrm_routes:
            geometry = r["geometry"]
            hazards = _score_route(db, geometry)
            options.append(
                RouteOption(
                    geometry=geometry,
                    distance_km=round(r["distance"] / 1000, 1),
                    duration_min=round(r["duration"] / 60),
                    hazards=hazards,
                    estimated=False,
                    steps=_extract_steps(r),
                )
            )
    else:
        # Fallback: straight line between the two points. Distance/duration
        # are estimates (60 km/h assumed); hazard count uses a wider buffer
        # since a straight line doesn't follow real roads.
        geometry = {
            "type": "LineString",
            "coordinates": [[from_lon, from_lat], [to_lon, to_lat]],
        }
        dist = _haversine_km(from_lat, from_lon, to_lat, to_lon)
        hazards = _score_route(db, geometry, buffer_meters=FALLBACK_HAZARD_BUFFER_METERS)
        options.append(
            RouteOption(
                geometry=geometry,
                distance_km=round(dist, 1),
                duration_min=round(dist / FALLBACK_SPEED_KMH * 60),
                hazards=hazards,
                estimated=True,
                steps=[
                    RouteStep(instruction="Head toward your destination", distance_m=dist * 1000, lat=from_lat, lon=from_lon),
                    RouteStep(instruction="You have arrived at your destination", distance_m=0, lat=to_lat, lon=to_lon),
                ],
            )
        )

    return rank_routes(options)


def rank_routes(options: list[RouteOption]) -> list[RouteOption]:
    if not options:
        return options

    by_hazard = sorted(options, key=lambda o: o.hazards.score)
    by_duration = sorted(options, key=lambda o: o.duration_min)

    safest = by_hazard[0]
    fastest = by_duration[0]

    for o in options:
        if o is safest and o is fastest:
            o.label = "Safest & fastest"
        elif o is safest:
            o.label = "Safest"
        elif o is fastest:
            o.label = "Fastest"
        else:
            o.label = "Alternative"

    # Balanced: lowest combined normalized rank of hazard score + duration,
    # excluding whichever route is already the clear safest/fastest.
    if len(options) > 2:
        candidates = [o for o in options if o.label == "Alternative"]
        if candidates:
            max_hazard = max(o.hazards.score for o in options) or 1
            max_duration = max(o.duration_min for o in options) or 1
            best = min(
                candidates,
                key=lambda o: o.hazards.score / max_hazard + o.duration_min / max_duration,
            )
            best.label = "Balanced"

    # Sort for display: safest first, then balanced, then fastest/others.
    order = {"Safest & fastest": 0, "Safest": 0, "Balanced": 1, "Fastest": 2, "Alternative": 3}
    return sorted(options, key=lambda o: order.get(o.label, 3))
