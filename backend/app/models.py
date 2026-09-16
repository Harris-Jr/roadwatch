import enum
from datetime import datetime, timezone

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    individual = "individual"
    business = "business"
    government = "government"


class Plan(str, enum.Enum):
    free = "free"
    premium = "premium"
    business = "business"


class RoadCategory(str, enum.Enum):
    inter_territorial = "inter_territorial"
    territorial = "territorial"
    district = "district"
    branch = "branch"
    rural = "rural"
    estate = "estate"


class Severity(str, enum.Enum):
    minor = "minor"
    moderate = "moderate"
    severe = "severe"


class ReportStatus(str, enum.Enum):
    reported = "reported"
    in_progress = "in_progress"
    fixed = "fixed"


class ReportSource(str, enum.Enum):
    quick_report = "quick_report"
    council_survey = "council_survey"


class JobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole))
    plan: Mapped[Plan | None] = mapped_column(Enum(Plan), nullable=True)
    organization: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RoadSegment(Base):
    __tablename__ = "road_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[RoadCategory] = mapped_column(Enum(RoadCategory))
    responsible_entity: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    reports: Mapped[list["Report"]] = relationship(back_populates="road_segment")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(500))
    file_path: Mapped[str] = mapped_column(String(1000))
    gps_log_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), default=JobStatus.queued
    )
    uploaded_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    frames_processed: Mapped[int] = mapped_column(Integer, default=0)
    detections_found: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    reports: Mapped[list["Report"]] = relationship(back_populates="processing_job")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    road_name: Mapped[str] = mapped_column(String(255))
    road_segment_id: Mapped[int | None] = mapped_column(
        ForeignKey("road_segments.id"), nullable=True
    )
    severity: Mapped[Severity] = mapped_column(Enum(Severity))
    confidence: Mapped[float] = mapped_column(Float)
    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus), default=ReportStatus.reported
    )
    source: Mapped[ReportSource] = mapped_column(Enum(ReportSource))

    # PostGIS point, longitude/latitude order (SRID 4326 = WGS84)
    location = mapped_column(Geometry(geometry_type="POINT", srid=4326))

    photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_council: Mapped[str | None] = mapped_column(String(255), nullable=True)

    processing_job_id: Mapped[int | None] = mapped_column(
        ForeignKey("processing_jobs.id"), nullable=True
    )
    frame_timestamp_seconds: Mapped[float | None] = mapped_column(
        Float, nullable=True
    )

    # Video-sourced detections start unconfirmed and need an admin to review
    # them (mirrors the Confirm/X buttons on the Video Upload & Processing
    # page). Quick Report submissions are auto-confirmed since a person
    # deliberately filed them.
    confirmed: Mapped[bool] = mapped_column(Boolean, default=True)

    reported_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    reported_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    road_segment: Mapped["RoadSegment | None"] = relationship(back_populates="reports")
    processing_job: Mapped["ProcessingJob | None"] = relationship(
        back_populates="reports"
    )


class AppSettings(Base):
    """Single-row table backing the admin Settings page."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    minor_threshold: Mapped[float] = mapped_column(Float, default=0.60)
    moderate_threshold: Mapped[float] = mapped_column(Float, default=0.75)
    severe_threshold: Mapped[float] = mapped_column(Float, default=0.85)
    email_digest_time: Mapped[str] = mapped_column(String(10), default="07:00")
    sms_for_severe_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    data_retention_days: Mapped[int] = mapped_column(Integer, default=90)


class Vehicle(Base):
    """A business account's registered fleet vehicle. Real, admin-entered
    data — not a telematics/GPS-tracking integration (that's a materially
    different, much larger system this doesn't attempt to build)."""

    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    plate_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class RefreshSession(Base):
    """One row per issued refresh token. The raw token is never stored —
    only its SHA-256 hash (see app.security.generate_refresh_token). A row
    represents one link in a rotation chain: each successful /auth/refresh
    revokes the presented session and creates a new one, pointed back at
    the old one via replaced_by_id, so a reused/stolen token can be
    detected (see services/auth_service.rotate_refresh_token)."""

    __tablename__ = "refresh_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Points at the session that replaced this one when it was rotated —
    # lets us walk/invalidate the whole chain if a revoked token is reused.
    replaced_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("refresh_sessions.id"), nullable=True
    )

    created_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    last_used_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)

    user: Mapped["User"] = relationship()

    @property
    def is_active(self) -> bool:
        return self.revoked_at is None and self.expires_at > datetime.now(timezone.utc).replace(tzinfo=None)


class Corridor(Base):
    """A business account's saved route corridor — a start/end point pair
    they want hazard risk tracked for. Risk is computed live against real
    routing + real reports, not stored/cached here."""

    __tablename__ = "corridors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(255))
    start_lat: Mapped[float] = mapped_column(Float)
    start_lon: Mapped[float] = mapped_column(Float)
    end_lat: Mapped[float] = mapped_column(Float)
    end_lon: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
