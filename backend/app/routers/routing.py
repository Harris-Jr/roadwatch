from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import HazardBreakdownOut, PlaceResult, RouteOptionOut, RouteRequest, RouteStepOut
from app.services.geocoding import search_places
from app.services.routing import get_route_options

router = APIRouter(prefix="/routing", tags=["routing"])


@router.get("/search", response_model=list[PlaceResult])
def search(q: str):
    if len(q.strip()) < 2:
        return []
    return search_places(q)


@router.post("/routes", response_model=list[RouteOptionOut])
def routes(payload: RouteRequest, db: Session = Depends(get_db)):
    options = get_route_options(
        db, payload.from_lat, payload.from_lon, payload.to_lat, payload.to_lon
    )
    return [
        RouteOptionOut(
            label=o.label,
            geometry=o.geometry,
            distance_km=o.distance_km,
            duration_min=o.duration_min,
            hazards=HazardBreakdownOut(
                minor=o.hazards.minor,
                moderate=o.hazards.moderate,
                severe=o.hazards.severe,
                total=o.hazards.total,
                score=o.hazards.score,
            ),
            estimated=o.estimated,
            steps=[
                RouteStepOut(instruction=s.instruction, distance_m=s.distance_m, lat=s.lat, lon=s.lon)
                for s in o.steps
            ],
        )
        for o in options
    ]
