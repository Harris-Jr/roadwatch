from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import Corridor, Report, ReportStatus, Severity, User, UserRole, Vehicle
from app.schemas import (
    BusinessSummary,
    CorridorCreate,
    CorridorOut,
    CorridorRisk,
    HazardBreakdownOut,
    VehicleCreate,
    VehicleOut,
)
from app.services.routing import get_route_options

router = APIRouter(prefix="/business", tags=["business"])
require_business = require_roles(UserRole.business)


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db), user: User = Depends(require_business)):
    return db.query(Vehicle).filter(Vehicle.business_id == user.id).order_by(Vehicle.name).all()


@router.post("/vehicles", response_model=VehicleOut)
def create_vehicle(
    payload: VehicleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_business),
):
    vehicle = Vehicle(business_id=user.id, **payload.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/vehicles/{vehicle_id}", status_code=204)
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_business),
):
    v = db.query(Vehicle).filter(Vehicle.id == vehicle_id, Vehicle.business_id == user.id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(v)
    db.commit()


@router.get("/corridors", response_model=list[CorridorOut])
def list_corridors(db: Session = Depends(get_db), user: User = Depends(require_business)):
    return db.query(Corridor).filter(Corridor.business_id == user.id).order_by(Corridor.name).all()


@router.post("/corridors", response_model=CorridorOut)
def create_corridor(
    payload: CorridorCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_business),
):
    corridor = Corridor(business_id=user.id, **payload.model_dump())
    db.add(corridor)
    db.commit()
    db.refresh(corridor)
    return corridor


@router.delete("/corridors/{corridor_id}", status_code=204)
def delete_corridor(
    corridor_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_business),
):
    c = (
        db.query(Corridor)
        .filter(Corridor.id == corridor_id, Corridor.business_id == user.id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=404, detail="Corridor not found")
    db.delete(c)
    db.commit()


@router.get("/corridors/{corridor_id}/risk", response_model=CorridorRisk)
def corridor_risk(
    corridor_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_business),
):
    corridor = (
        db.query(Corridor)
        .filter(Corridor.id == corridor_id, Corridor.business_id == user.id)
        .first()
    )
    if not corridor:
        raise HTTPException(status_code=404, detail="Corridor not found")

    # Real route + real hazard count between the corridor's two points —
    # same engine Navigate uses. Take the lowest-hazard alternative as the
    # representative route for this corridor.
    options = get_route_options(
        db, corridor.start_lat, corridor.start_lon, corridor.end_lat, corridor.end_lon
    )
    if not options:
        raise HTTPException(status_code=502, detail="Could not compute a route for this corridor")
    best = options[0]

    return CorridorRisk(
        corridor_id=corridor.id,
        name=corridor.name,
        distance_km=best.distance_km,
        duration_min=best.duration_min,
        hazards=HazardBreakdownOut(
            minor=best.hazards.minor,
            moderate=best.hazards.moderate,
            severe=best.hazards.severe,
            total=best.hazards.total,
            score=best.hazards.score,
        ),
        estimated=best.estimated,
    )


@router.get("/summary", response_model=BusinessSummary)
def business_summary(db: Session = Depends(get_db), user: User = Depends(require_business)):
    vehicle_count = db.query(Vehicle).filter(Vehicle.business_id == user.id).count()
    corridor_count = db.query(Corridor).filter(Corridor.business_id == user.id).count()

    severe_hazards = (
        db.query(Report)
        .filter(Report.severity == Severity.severe, Report.confirmed.is_(True))
        .count()
    )

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    repairs_this_week = (
        db.query(Report)
        .filter(
            Report.status == ReportStatus.fixed,
            Report.confirmed.is_(True),
            Report.updated_at >= week_ago,
        )
        .count()
    )

    return BusinessSummary(
        vehicle_count=vehicle_count,
        corridor_count=corridor_count,
        severe_hazards_network_wide=severe_hazards,
        repairs_this_week_network_wide=repairs_this_week,
    )
