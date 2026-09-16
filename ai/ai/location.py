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
import subprocess

import pytesseract
from PIL import Image

_COORD_PATTERN = re.compile(r"[$]?S?(-?\d+\.\d+)[^E]*E\s?(\d+\.\d+)")
_ISO6709_PATTERN = re.compile(r"([+-]\d+\.?\d*)([+-]\d+\.?\d*)")


def _clean_ocr_text(text: str) -> str:
    text = re.sub(r"(\d)-(\d)", r"\1.\2", text)
    text = re.sub(r"(\d+)\.\s+(\d+)", r"\1.\2", text)
    return text


def _exif_to_degrees(value) -> float | None:
    if not value or len(value) != 3:
        return None
    d, m, s = value
    return float(d) + float(m) / 60 + float(s) / 3600


def resolve_from_exif(image: Image.Image) -> tuple[float, float] | None:
    """Reads GPS coordinates most phone cameras embed automatically in every
    photo, invisibly, via EXIF metadata — no special GPS-camera app needed.
    This covers the common case; resolve_from_ocr below only covers photos
    from apps that stamp coordinates as visible text on the image."""
    try:
        exif = image.getexif()
        gps_ifd = exif.get_ifd(0x8825)  # GPSInfo tag
        if not gps_ifd:
            return None

        lat = _exif_to_degrees(gps_ifd.get(2))
        lon = _exif_to_degrees(gps_ifd.get(4))
        if lat is None or lon is None:
            return None

        if gps_ifd.get(1) == "S":
            lat = -lat
        if gps_ifd.get(3) == "W":
            lon = -lon
        return lat, lon
    except (AttributeError, KeyError, ValueError, TypeError):
        return None


def resolve_from_video_metadata(video_path: str) -> tuple[float, float] | None:
    """Reads GPS coordinates embedded in a video file's own container
    metadata (most phones write this automatically), via ffprobe. Good for
    a short Quick Report clip filmed from one spot — not appropriate for a
    multi-minute survey drive where location actually changes throughout
    the video, which is what the per-frame OCR path below is for."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries",
                "format_tags=location,format_tags=com.apple.quicktime.location.ISO6709",
                "-of", "default=noprint_wrappers=1:nokey=1",
                video_path,
            ],
            capture_output=True, text=True, timeout=10,
        )
        output = result.stdout.strip().splitlines()
        for line in output:
            match = _ISO6709_PATTERN.match(line.strip())
            if match:
                return float(match.group(1)), float(match.group(2))
    except (subprocess.SubprocessError, OSError, ValueError):
        pass
    return None


def resolve_from_ocr(frame: Image.Image) -> tuple[float, float] | None:
    raw_text = pytesseract.image_to_string(frame)
    text = " ".join(raw_text.split())
    text = _clean_ocr_text(text)

    match = _COORD_PATTERN.search(text)
    if not match:
        return None

    lat = match.group(1)
    lon = match.group(2)
    # Only treat a hemisphere marker actually adjacent to the coordinate
    # (captured by the optional `[$]?S?` right before the lat group) as a
    # sign indicator — not the whole OCR string, which false-positives on
    # unrelated overlay text like "GPS" or "SPEED".
    hemisphere_marker = text[match.start(): match.start(1)]
    if "$" in hemisphere_marker or "S" in hemisphere_marker:
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
