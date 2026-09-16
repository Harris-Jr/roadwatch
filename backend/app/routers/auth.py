from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.rate_limit import check_rate_limit
from app.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RefreshResponse,
    SignupRequest,
    TokenResponse,
    UserOut,
)
from app.services import auth_service
from app.services.auth_service import AuthError
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


# NOTE ON ENDPOINT NAMING: the implementation spec this was built from
# uses /auth/register; this codebase's existing frontend (frontend/src/lib/api.ts)
# already calls /auth/signup, and the two are otherwise identical in
# behavior. Renaming would silently break every existing signup call
# across the app for no security benefit, so the existing path is kept.


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, "register", settings.auth_rate_limit_register_per_minute)

    try:
        user = auth_service.register_user(
            db,
            email=payload.email,
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
            plan=payload.plan,
            organization=payload.organization,
        )
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    access_token, refresh_token, expires_in = auth_service.issue_tokens(
        db, user, ip=_client_ip(request), user_agent=request.headers.get("user-agent")
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    # Login gets the tightest limit of the three auth endpoints — it's
    # the one a credential-stuffing / brute-force attack actually targets.
    check_rate_limit(request, "login", settings.auth_rate_limit_login_per_minute)

    try:
        user = auth_service.authenticate_user(db, email=payload.email, password=payload.password)
    except AuthError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    access_token, refresh_token, expires_in = auth_service.issue_tokens(
        db, user, ip=_client_ip(request), user_agent=request.headers.get("user-agent")
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=expires_in,
        user=UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, "refresh", settings.auth_rate_limit_refresh_per_minute)

    try:
        access_token, new_refresh_token, expires_in = auth_service.rotate_refresh_token(
            db,
            payload.refresh_token,
            ip=_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except AuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=exc.message)

    return RefreshResponse(
        access_token=access_token, refresh_token=new_refresh_token, expires_in=expires_in
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    # Idempotent and doesn't require a valid access token — a client that
    # already lost its access token (expired) should still be able to
    # revoke the refresh session it's holding. Revoking the refresh
    # session stops future /auth/refresh calls; it does NOT invalidate an
    # already-issued access JWT, which remains valid (stateless) until it
    # expires on its own — see README's Authentication section.
    auth_service.logout(db, payload.refresh_token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
