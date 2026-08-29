from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models import (
    JobStatus,
    Plan,
    ReportSource,
    ReportStatus,
    RoadCategory,
    Severity,
    UserRole,
)


# --- Auth ---


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole
    plan: Plan | None = None
    organization: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: UserRole
    plan: Plan | None
    organization: str | None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# --- Road segments ---


class RoadSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: RoadCategory
    responsible_entity: str


class RoadSegmentCreate(BaseModel):
    name: str
    category: RoadCategory
    responsible_entity: str


# --- Reports ---


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    road_name: str
    severity: Severity
    confidence: float
    status: ReportStatus
    source: ReportSource
    latitude: float
    longitude: float
    photo_url: str | None
    note: str | None
    assigned_council: str | None
    confirmed: bool
    reported_at: datetime
    updated_at: datetime

    @classmethod
    def from_orm_with_point(cls, report):
        """Report.location is a PostGIS point; pull lat/lon out of it."""
        from geoalchemy2.shape import to_shape

        point = to_shape(report.location)
        return cls(
            id=report.id,
            road_name=report.road_name,
            severity=report.severity,
            confidence=report.confidence,
            status=report.status,
            source=report.source,
            latitude=point.y,
            longitude=point.x,
            photo_url=report.photo_url,
            note=report.note,
            assigned_council=report.assigned_council,
            confirmed=report.confirmed,
            reported_at=report.reported_at,
            updated_at=report.updated_at,
        )


class ReportUpdate(BaseModel):
    status: ReportStatus | None = None
    assigned_council: str | None = None


# --- Dashboard ---


class DashboardSummary(BaseModel):
    open_reports: int
    in_progress: int
    fixed_this_month: int
    avg_resolution_days: float
    reports_over_time: list[dict]


# --- Processing jobs ---


class ProcessingJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    filename: str
    status: JobStatus
    frames_processed: int
    detections_found: int
    uploaded_at: datetime
    completed_at: datetime | None
    error_message: str | None


# --- Settings ---


class AppSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    minor_threshold: float
    moderate_threshold: float
    severe_threshold: float
    email_digest_time: str
    sms_for_severe_enabled: bool
    data_retention_days: int


class AppSettingsUpdate(BaseModel):
    minor_threshold: float | None = None
    moderate_threshold: float | None = None
    severe_threshold: float | None = None
    email_digest_time: str | None = None
    sms_for_severe_enabled: bool | None = None
    data_retention_days: int | None = None


# --- routing ---


class RouteRequest(BaseModel):
    from_lat: float
    from_lon: float
    to_lat: float
    to_lon: float


class HazardBreakdownOut(BaseModel):
    minor: int
    moderate: int
    severe: int
    total: int
    score: int


class RouteStepOut(BaseModel):
    instruction: str
    distance_m: float
    lat: float
    lon: float


class RouteOptionOut(BaseModel):
    label: str
    geometry: dict
    distance_km: float
    duration_min: float
    hazards: HazardBreakdownOut
    estimated: bool
    steps: list[RouteStepOut]


class PlaceResult(BaseModel):
    label: str
    latitude: float
    longitude: float


# --- business fleet ---


class VehicleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    plate_number: str | None


class VehicleCreate(BaseModel):
    name: str
    plate_number: str | None = None


class CorridorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float


class CorridorCreate(BaseModel):
    name: str
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float


class CorridorRisk(BaseModel):
    corridor_id: int
    name: str
    distance_km: float
    duration_min: float
    hazards: HazardBreakdownOut
    estimated: bool


class BusinessSummary(BaseModel):
    vehicle_count: int
    corridor_count: int
    severe_hazards_network_wide: int
    repairs_this_week_network_wide: int
