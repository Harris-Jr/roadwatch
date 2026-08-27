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
_HEADERS = {"User-Agent": "RoadWatchZambia/1.0"}


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
