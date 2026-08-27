import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from geoalchemy2.functions import ST_MakePoint, ST_SetSRID
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal, get_db
from app.deps import require_government
from app.models import (
    AppSettings,
    JobStatus,
    ProcessingJob,
    Report,
    ReportSource,
    ReportStatus,
    User,
)
from app.schemas import ProcessingJobOut, ReportOut
from ai.frames import extract_frames
from ai.inference import classifier
from ai.location import parse_gps_log, resolve_location
from app.services.storage import absolute_path, save_upload

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/uploads", tags=["uploads"])


def _process_video_job(job_id: int):
    """Runs in a background task: extract frames, classify each one, resolve
    location for detections, write Report rows. Uses its own DB session since
    the request's session is closed by the time this runs."""
    db = SessionLocal()
    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            return

        job.status = JobStatus.processing
        db.commit()

        app_settings = db.query(AppSettings).first()
        if not app_settings:
            app_settings = AppSettings(id=1)
            db.add(app_settings)
            db.commit()
            db.refresh(app_settings)

        gps_log_rows = []
        if job.gps_log_path:
            try:
                gps_log_rows = parse_gps_log(absolute_path(job.gps_log_path))
            except (OSError, ValueError, KeyError) as exc:
                logger.warning("Could not parse GPS log for job %s: %s", job.id, exc)

        video_full_path = absolute_path(job.file_path)
        frames_processed = 0
        detections_found = 0

        for frame, timestamp in extract_frames(
            video_full_path, settings.frame_sample_interval_seconds
        ):
            frames_processed += 1
            result = classifier.classify(
                frame,
                minor_threshold=app_settings.minor_threshold,
                moderate_threshold=app_settings.moderate_threshold,
                severe_threshold=app_settings.severe_threshold,
            )

            if not result.is_pothole:
                continue

            coords = resolve_location(frame, timestamp, gps_log_rows)
            if coords is None:
                # No location could be resolved — skip rather than write a
                # report with a fabricated location. Consider logging these
                # for manual review if this happens often.
                logger.info(
                    "Job %s: detection at %.1fs had no resolvable location, skipped",
                    job.id,
                    timestamp,
                )
                continue

            lat, lon = coords
            report = Report(
                road_name="Unnamed road",  # reverse geocoded lazily on confirm
                severity=result.severity,
                confidence=result.confidence,
                status=ReportStatus.reported,
                source=ReportSource.council_survey,
                location=ST_SetSRID(ST_MakePoint(lon, lat), 4326),
                processing_job_id=job.id,
                frame_timestamp_seconds=timestamp,
                confirmed=False,
                assigned_council=None,
            )
            db.add(report)
            detections_found += 1

        job.frames_processed = frames_processed
        job.detections_found = detections_found
        job.status = JobStatus.completed
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

    except Exception as exc:  # noqa: BLE001 — surface any failure on the job
        logger.exception("Video processing job %s failed", job_id)
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if job:
            job.status = JobStatus.failed
            job.error_message = str(exc)
            db.commit()
    finally:
        db.close()


@router.post("/video", response_model=ProcessingJobOut)
def upload_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    gps_log: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_government),
):
    video_path = save_upload(video, subdir="videos")
    gps_log_path = save_upload(gps_log, subdir="gps_logs") if gps_log else None

    job = ProcessingJob(
        filename=video.filename or "upload.mp4",
        file_path=video_path,
        gps_log_path=gps_log_path,
        status=JobStatus.queued,
        uploaded_by_id=admin.id,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_process_video_job, job.id)
    return job


@router.get("/jobs", response_model=list[ProcessingJobOut])
def list_jobs(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    return db.query(ProcessingJob).order_by(ProcessingJob.uploaded_at.desc()).all()


@router.get("/jobs/{job_id}/detections", response_model=list[ReportOut])
def list_job_detections(
    job_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    reports = (
        db.query(Report)
        .filter(Report.processing_job_id == job_id, Report.confirmed.is_(False))
        .all()
    )
    return [ReportOut.from_orm_with_point(r) for r in reports]
