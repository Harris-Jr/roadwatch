from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_government
from app.models import AppSettings, User
from app.schemas import AppSettingsOut, AppSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create(db: Session) -> AppSettings:
    settings_row = db.query(AppSettings).first()
    if not settings_row:
        settings_row = AppSettings(id=1)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.get("", response_model=AppSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.patch("", response_model=AppSettingsOut)
def update_settings(
    payload: AppSettingsUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_government),
):
    settings_row = _get_or_create(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row
