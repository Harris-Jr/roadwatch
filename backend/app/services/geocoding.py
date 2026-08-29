"""Reverse-geocodes a lat/lon into a road name using OSM's free Nominatim
API — consistent with using OpenStreetMap for the map tiles on the frontend.

Nominatim's usage policy caps this at 1 request/second and requires a
descriptive User-Agent; fine for this app's traffic, but if you outgrow it,
self-host Nominatim or switch to a paid geocoder (same call site either way).
"""

import logging

import requests

logger = logging.getLogger(__name__)

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
_NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
_HEADERS = {"User-Agent": "RoadWatchZambia/1.0"}

# Nominatim isn't scoped to Zambia by default — bias results to roughly
# Zambia's bounding box so "Kafue" doesn't return a result in another
# country.
_ZAMBIA_VIEWBOX = "21.9,-8.2,33.7,-18.1"


def reverse_geocode_road_name(lat: float, lon: float) -> str:
    try:
        response = requests.get(
            _NOMINATIM_URL,
            params={"lat": lat, "lon": lon, "format": "jsonv2"},
            headers=_HEADERS,
            timeout=3,
        )
        response.raise_for_status()
        data = response.json()
        address = data.get("address", {})
        road = address.get("road")
        return road or "Unnamed road"
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Reverse geocoding failed for (%s, %s): %s", lat, lon, exc)
        return "Unnamed road"


def search_places(query: str, limit: int = 5) -> list[dict]:
    """Forward-geocodes a typed search string into candidate places, biased
    to Zambia. Used by Navigate's destination search box — real results
    from OpenStreetMap, not a hardcoded list of road names."""
    try:
        response = requests.get(
            _NOMINATIM_SEARCH_URL,
            params={
                "q": query,
                "format": "jsonv2",
                "limit": limit,
                "viewbox": _ZAMBIA_VIEWBOX,
                "bounded": 1,
            },
            headers=_HEADERS,
            timeout=4,
        )
        response.raise_for_status()
        results = response.json()
        return [
            {
                "label": r.get("display_name", query),
                "latitude": float(r["lat"]),
                "longitude": float(r["lon"]),
            }
            for r in results
        ]
    except (requests.RequestException, ValueError, KeyError) as exc:
        logger.warning("Place search failed for %r: %s", query, exc)
        return []
