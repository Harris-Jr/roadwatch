"""
Resolves a lat/lon for a detected pothole frame from admin-uploaded video.

Three strategies, tried in order:

1. OCR — reads GPS coordinates burned into the frame as visible text
   (ported from the original Web_Map_Application/app.py prototype, which
   targets footage from dashcams/GPS-camera apps that stamp coordinates
   onto the image). This only works if the footage actually has that
   overlay — confirm with whoever supplies your admin footage whether this
   is reliably true before leaning on it.

2. GPS log fallback — if a companion GPS log file (CSV: timestamp_seconds,
   lat, lon) is uploaded alongside the video, look up the reading closest
   to the frame's timestamp. Adjust `parse_gps_log` if your actual log
   format differs (GPX, different columns, etc).

3. None — if neither resolves, the caller should still create the report
   but leave it unconfirmed with no location, so an admin can drop a pin
   manually in the review queue rather than silently losing the detection.
"""

import csv
import re

import pytesseract
from PIL import Image

_COORD_PATTERN = re.compile(r"[$]?S?(-?\d+\.\d+)[^E]*E\s?(\d+\.\d+)")


def _clean_ocr_text(text: str) -> str:
    text = re.sub(r"(\d)-(\d)", r"\1.\2", text)
    text = re.sub(r"(\d+)\.\s+(\d+)", r"\1.\2", text)
    return text


def resolve_from_ocr(frame: Image.Image) -> tuple[float, float] | None:
    raw_text = pytesseract.image_to_string(frame)
    text = " ".join(raw_text.split())
    text = _clean_ocr_text(text)

    match = _COORD_PATTERN.search(text)
    if not match:
        return None

    lat = match.group(1)
    lon = match.group(2)
    if "$" in text or "S" in text:
        lat = f"-{lat.lstrip('-')}"

    return float(lat), float(lon)


def parse_gps_log(gps_log_path: str) -> list[tuple[float, float, float]]:
    """Expects a CSV with header: timestamp_seconds,lat,lon"""
    rows: list[tuple[float, float, float]] = []
    with open(gps_log_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(
                (float(row["timestamp_seconds"]), float(row["lat"]), float(row["lon"]))
            )
    rows.sort(key=lambda r: r[0])
    return rows


def resolve_from_gps_log(
    timestamp_seconds: float, gps_log_rows: list[tuple[float, float, float]]
) -> tuple[float, float] | None:
    if not gps_log_rows:
        return None
    closest = min(gps_log_rows, key=lambda r: abs(r[0] - timestamp_seconds))
    return closest[1], closest[2]


def resolve_location(
    frame: Image.Image,
    timestamp_seconds: float,
    gps_log_rows: list[tuple[float, float, float]] | None = None,
) -> tuple[float, float] | None:
    coords = resolve_from_ocr(frame)
    if coords:
        return coords

    if gps_log_rows:
        coords = resolve_from_gps_log(timestamp_seconds, gps_log_rows)
        if coords:
            return coords

    return None
