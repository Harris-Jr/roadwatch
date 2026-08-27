from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_government
from app.models import Report, ReportStatus, User
from app.schemas import DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    open_reports = (
        db.query(Report)
        .filter(Report.status == ReportStatus.reported, Report.confirmed.is_(True))
        .count()
    )
    in_progress = (
        db.query(Report)
        .filter(Report.status == ReportStatus.in_progress, Report.confirmed.is_(True))
        .count()
    )
    fixed_this_month = (
        db.query(Report)
        .filter(
            Report.status == ReportStatus.fixed,
            Report.confirmed.is_(True),
            Report.updated_at >= month_start,
        )
        .count()
    )

    fixed_reports = (
        db.query(Report)
        .filter(Report.status == ReportStatus.fixed, Report.confirmed.is_(True))
        .all()
    )
    if fixed_reports:
        avg_days = sum(
            (r.updated_at - r.reported_at).total_seconds() / 86400 for r in fixed_reports
        ) / len(fixed_reports)
    else:
        avg_days = 0.0

    twelve_months_ago = now - timedelta(days=365)
    monthly_reported = (
        db.query(
            extract("year", Report.reported_at).label("year"),
            extract("month", Report.reported_at).label("month"),
            func.count(Report.id).label("count"),
        )
        .filter(Report.reported_at >= twelve_months_ago, Report.confirmed.is_(True))
        .group_by("year", "month")
        .all()
    )
    monthly_fixed = (
        db.query(
            extract("year", Report.updated_at).label("year"),
            extract("month", Report.updated_at).label("month"),
            func.count(Report.id).label("count"),
        )
        .filter(
            Report.status == ReportStatus.fixed,
            Report.updated_at >= twelve_months_ago,
            Report.confirmed.is_(True),
        )
        .group_by("year", "month")
        .all()
    )

    reported_map = {(int(r.year), int(r.month)): r.count for r in monthly_reported}
    fixed_map = {(int(r.year), int(r.month)): r.count for r in monthly_fixed}
    all_keys = sorted(set(reported_map) | set(fixed_map))

    reports_over_time = [
        {
            "year": year,
            "month": month,
            "reported": reported_map.get((year, month), 0),
            "fixed": fixed_map.get((year, month), 0),
        }
        for year, month in all_keys
    ]

    return DashboardSummary(
        open_reports=open_reports,
        in_progress=in_progress,
        fixed_this_month=fixed_this_month,
        avg_resolution_days=round(avg_days, 1),
        reports_over_time=reports_over_time,
    )
