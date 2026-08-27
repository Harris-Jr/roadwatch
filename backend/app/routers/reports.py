from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_government
from app.models import AppSettings, Report, ReportSource, ReportStatus, Severity, User
from app.schemas import ReportOut, ReportUpdate
from app.services.geocoding import reverse_geocode_road_name
from ai.inference import classifier
from app.services.storage import save_upload

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
):
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
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportOut.from_orm_with_point(report)


@router.post("/quick-report", response_model=ReportOut)
def submit_quick_report(
    photo: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    severity: Severity | None = Form(None),
    note: str | None = Form(None),
    db: Session = Depends(get_db),
):
    image = Image.open(photo.file)
    app_settings = _get_or_create_settings(db)

    result = classifier.classify(
        image,
        minor_threshold=app_settings.minor_threshold,
        moderate_threshold=app_settings.moderate_threshold,
        severe_threshold=app_settings.severe_threshold,
    )

    if not result.is_pothole and severity is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Couldn't confirm a pothole in this photo. Try a clearer, "
                "closer photo, or set a severity manually to submit anyway "
                "for review."
            ),
        )

    # Trust the person on the ground over the model when they've stated a
    # severity — but keep the model's confidence score for the record.
    final_severity = severity or Severity(result.severity)
    confirmed = result.is_pothole  # manual overrides go to the review queue

    photo.file.seek(0)
    photo_path = save_upload(photo, subdir="quick_reports")
    road_name = reverse_geocode_road_name(latitude, longitude)

    report = Report(
        road_name=road_name,
        severity=final_severity,
        confidence=result.confidence,
        status=ReportStatus.reported,
        source=ReportSource.quick_report,
        location=ST_SetSRID(ST_MakePoint(longitude, latitude), 4326),
        photo_url=photo_path,
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
