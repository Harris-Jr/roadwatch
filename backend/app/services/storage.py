"""Local-disk file storage for dev. If you deploy across more than one VPS
instance later, or want durability independent of the server's disk, swap
this for an S3-compatible client (e.g. boto3 against Backblaze B2 or
DigitalOcean Spaces) — every call site uses this module, so only this file
needs to change."""

import os
import uuid

from fastapi import UploadFile

from app.config import settings


def _ensure_dir(subdir: str) -> str:
    path = os.path.join(settings.upload_dir, subdir)
    os.makedirs(path, exist_ok=True)
    return path


def save_upload(file: UploadFile, subdir: str) -> str:
    """Saves an uploaded file to disk and returns a path relative to
    UPLOAD_DIR, suitable for building a servable URL from."""
    directory = _ensure_dir(subdir)
    extension = os.path.splitext(file.filename or "")[1]
    filename = f"{uuid.uuid4().hex}{extension}"
    full_path = os.path.join(directory, filename)

    with open(full_path, "wb") as out_file:
        out_file.write(file.file.read())

    return os.path.join(subdir, filename)


def save_pil_image(image, subdir: str) -> str:
    """Saves an in-memory PIL image (e.g. the best frame picked out of a
    Quick Report video) as a JPEG, returning a path relative to
    UPLOAD_DIR — same convention as save_upload."""
    directory = _ensure_dir(subdir)
    filename = f"{uuid.uuid4().hex}.jpg"
    full_path = os.path.join(directory, filename)
    image.convert("RGB").save(full_path, "JPEG", quality=85)
    return os.path.join(subdir, filename)


def absolute_path(relative_path: str) -> str:
    return os.path.join(settings.upload_dir, relative_path)
