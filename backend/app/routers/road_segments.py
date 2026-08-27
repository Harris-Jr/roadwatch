from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_government
from app.models import RoadSegment, User
from app.schemas import RoadSegmentCreate, RoadSegmentOut

router = APIRouter(prefix="/road-segments", tags=["road-segments"])


@router.get("", response_model=list[RoadSegmentOut])
def list_road_segments(db: Session = Depends(get_db)):
    return db.query(RoadSegment).order_by(RoadSegment.name).all()


@router.post("", response_model=RoadSegmentOut, status_code=status.HTTP_201_CREATED)
def create_road_segment(
    payload: RoadSegmentCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    segment = RoadSegment(**payload.model_dump())
    db.add(segment)
    db.commit()
    db.refresh(segment)
    return segment


@router.delete("/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_road_segment(
    segment_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    segment = db.query(RoadSegment).filter(RoadSegment.id == segment_id).first()
    if not segment:
        raise HTTPException(status_code=404, detail="Road segment not found")
    db.delete(segment)
    db.commit()
