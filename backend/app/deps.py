from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, UserRole
from app.security import TokenError, decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

# Per-reason messages, matching the spec's example responses. Kept
# deliberately generic beyond "expired" vs "everything else" — the
# distinction between "invalid signature" / "wrong audience" / "wrong
# type" etc. is useful server-side (log it) but not to a client probing
# for information about why a token failed.
_MISSING_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)
_INVALID_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid authentication credentials",
    headers={"WWW-Authenticate": "Bearer"},
)
_EXPIRED_TOKEN = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Access token has expired",
    headers={"WWW-Authenticate": "Bearer"},
)


def _decode_or_raise(token: str) -> dict:
    try:
        return decode_access_token(token)
    except TokenError as exc:
        if exc.reason == "expired":
            raise _EXPIRED_TOKEN from exc
        raise _INVALID_TOKEN from exc


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if token is None:
        raise _MISSING_TOKEN

    payload = _decode_or_raise(token)

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if user is None:
        raise _INVALID_TOKEN
    return user


def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but returns None instead of raising when no
    token is presented or it's invalid. For endpoints that are public by
    default but need to gate specific query params/behavior behind a role
    (e.g. GET /reports?confirmed_only=false)."""
    if token is None:
        return None
    try:
        payload = decode_access_token(token)
    except TokenError:
        return None
    return db.query(User).filter(User.id == int(payload["sub"])).first()


def require_roles(*roles: UserRole):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to do that",
            )
        return user

    return checker


require_government = require_roles(UserRole.government)
