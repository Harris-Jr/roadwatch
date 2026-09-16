from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from geoalchemy2.shape import to_shape
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user_optional, require_government
from app.models import AppSettings, Report, ReportSource, ReportStatus, Severity, User, UserRole
from app.schemas import ReportOut, ReportUpdate
from app.services.geocoding import reverse_geocode_road_name
from ai.inference import ClassificationResult, classifier
from ai.frames import extract_frames
from ai.location import resolve_from_exif, resolve_from_ocr, resolve_from_video_metadata
from app.services.storage import absolute_path, save_pil_image, save_upload

# How much of a Quick Report video clip to actually scan. This is meant to
# be a short clip filmed on the spot, not a survey recording — capping both
# the time window and frame count keeps the request fast.
QUICK_VIDEO_MAX_SECONDS = 8
QUICK_VIDEO_FRAME_INTERVAL = 0.5

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings_row = db.query(AppSettings).first()
    if not settings_row:
        settings_row = AppSettings(id=1)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("", response_model=list[ReportOut])
def list_reports(
    severity: Severity | None = None,
    status_filter: ReportStatus | None = None,
    source: ReportSource | None = None,
    council: str | None = None,
    confirmed_only: bool = True,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    # The public map only ever needs confirmed reports and requires no
    # login. Seeing unconfirmed reports (Quick Reports and video-survey
    # detections still in the review queue) is admin-only — without this
    # check, anyone could call ?confirmed_only=false directly and read the
    # review queue without authenticating, bypassing the confirm/reject
    # workflow entirely.
    if not confirmed_only and (user is None or user.role != UserRole.government):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewing unconfirmed reports requires a government account.",
        )

    query = db.query(Report)
    if confirmed_only:
        query = query.filter(Report.confirmed.is_(True))
    if severity:
        query = query.filter(Report.severity == severity)
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if source:
        query = query.filter(Report.source == source)
    if council:
        query = query.filter(Report.assigned_council == council)

    reports = query.order_by(Report.reported_at.desc()).all()
    return [ReportOut.from_orm_with_point(r) for r in reports]


@router.get("/{report_id}", response_model=ReportOut)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    # Same boundary as list_reports: an unconfirmed report (still in the
    # review queue) shouldn't be individually fetchable by guessing/
    # enumerating IDs either, not just hidden from the list view.
    if not report.confirmed and (user is None or user.role != UserRole.government):
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut.from_orm_with_point(report)


@router.post("/quick-report", response_model=ReportOut)
def submit_quick_report(
    photo: UploadFile | None = File(None),
    video: UploadFile | None = File(None),
    latitude: float | None = Form(None),
    longitude: float | None = Form(None),
    severity: Severity | None = Form(None),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
):
    if not photo and not video:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attach a photo or a short video clip.",
        )
    if photo and video:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Attach either a photo or a video, not both.",
        )

    app_settings = _get_or_create_settings(db)
    thresholds = dict(
        minor_threshold=app_settings.minor_threshold,
        moderate_threshold=app_settings.moderate_threshold,
        severe_threshold=app_settings.severe_threshold,
    )

    video_path: str | None = None

    if photo:
        representative_image = Image.open(photo.file)
        result = classifier.classify(representative_image, **thresholds)
        photo.file.seek(0)
        saved_path = save_upload(photo, subdir="quick_reports")
    else:
        # Video path: save it, sample a handful of frames from the first
        # few seconds, classify each, and use whichever frame the model was
        # most confident about as the representative detection — same
        # classifier, same preprocessing, just applied per-frame instead of
        # to a single upload.
        video_path = save_upload(video, subdir="quick_reports")
        representative_image: Image.Image | None = None
        result: ClassificationResult | None = None

        for frame, ts in extract_frames(
            absolute_path(video_path), QUICK_VIDEO_FRAME_INTERVAL
        ):
            if ts > QUICK_VIDEO_MAX_SECONDS:
                break
            frame_result = classifier.classify(frame, **thresholds)
            if frame_result.is_pothole and (
                result is None or frame_result.confidence > result.confidence
            ):
                result = frame_result
                representative_image = frame

        if result is None:
            # No frame was classified as a pothole. Keep going only if the
            # submitter set a severity manually — same rule as the photo
            # path — using the first frame (if any) as the reference image.
            result = ClassificationResult(is_pothole=False, confidence=0.0, severity=None)

        saved_path = (
            save_pil_image(representative_image, subdir="quick_reports")
            if representative_image
            else video_path
        )

    if not result.is_pothole and severity is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Couldn't confirm a pothole. Try a clearer photo or video, "
                "or set a severity manually to submit anyway for review."
            ),
        )

    # Location resolution — the goal is that the person never has to think
    # about this. Try, in order:
    #   1. Real device GPS, if the browser provided it.
    #   2. EXIF metadata (photo) or container metadata (video) — most
    #      phones embed this automatically and invisibly, no special app
    #      needed. This covers the common case.
    #   3. OCR — coordinates visibly burned into the image as text, which
    #      only GPS-camera-overlay apps produce. Narrower case, but still
    #      worth trying before giving up.
    if latitude is None or longitude is None:
        metadata_coords = (
            resolve_from_exif(representative_image)
            if photo and representative_image is not None
            else resolve_from_video_metadata(absolute_path(video_path))
            if video_path
            else None
        )
        if metadata_coords:
            latitude, longitude = metadata_coords

    if (latitude is None or longitude is None) and representative_image is not None:
        ocr_coords = resolve_from_ocr(representative_image)
        if ocr_coords:
            latitude, longitude = ocr_coords

    if latitude is None or longitude is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No location available. Enable location access in your "
                "browser, or make sure location is turned on for your "
                "camera app before taking the photo/video."
            ),
        )

    # Trust the person on the ground over the model when they've stated a
    # severity — but keep the model's confidence score for the record.
    final_severity = severity or Severity(result.severity)
    confirmed = result.is_pothole  # manual overrides go to the review queue

    road_name = reverse_geocode_road_name(latitude, longitude)

    report = Report(
        road_name=road_name,
        severity=final_severity,
        confidence=result.confidence,
        status=ReportStatus.reported,
        source=ReportSource.quick_report,
        location=ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
        photo_url=saved_path,
        note=note,
        confirmed=confirmed,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportOut.from_orm_with_point(report)


@router.patch("/{report_id}", response_model=ReportOut)
def update_report(
    report_id: int,
    payload: ReportUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    if payload.status is not None:
        report.status = payload.status
    if payload.assigned_council is not None:
        report.assigned_council = payload.assigned_council

    db.commit()
    db.refresh(report)
    return ReportOut.from_orm_with_point(report)


@router.post("/{report_id}/confirm", response_model=ReportOut)
def confirm_report(
    report_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.confirmed = True
    if report.road_name in (None, "", "Unnamed road"):
        point = to_shape(report.location)
        report.road_name = reverse_geocode_road_name(point.y, point.x)
    db.commit()
    db.refresh(report)
    return ReportOut.from_orm_with_point(report)


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
def reject_report(
    report_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
