"""
Authentication business logic, kept out of the router so
app/routers/auth.py stays focused on HTTP concerns (request parsing,
status codes, response shaping).

Covers: registration, login, refresh-token rotation (with reuse
detection), and logout. Password hashing and JWT encode/decode live in
app.security; this module is what actually orchestrates them against the
database.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import RefreshSession, User
from app.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)


class AuthError(Exception):
    """Raised for any authentication failure the router should turn into
    a 401/400. Carries a client-safe message only — never wraps a raw DB
    exception or leaks whether a specific email exists."""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def register_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str,
    role,
    plan=None,
    organization: str | None = None,
) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        # Same message shape as a generic failure would be nicer for
        # avoiding account enumeration, but registration inherently
        # reveals this (the client asked to create this exact account) —
        # unlike login, there's no meaningful way to hide it here.
        raise AuthError("Email already registered", status_code=400)

    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        plan=plan,
        organization=organization,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    """Verifies credentials. Deliberately returns the same generic error
    for 'no such user' and 'wrong password' so the response can't be used
    to enumerate registered emails."""
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.hashed_password):
        raise AuthError("Incorrect email or password")
    return user


def issue_tokens(
    db: Session, user: User, *, ip: str | None = None, user_agent: str | None = None
) -> tuple[str, str, int]:
    """Creates a fresh access token + a fresh refresh session for `user`.
    Returns (access_token, raw_refresh_token, expires_in_seconds)."""
    access_token, _jti, expire = create_access_token(user.id, user.role.value)

    raw_refresh, refresh_hash = generate_refresh_token()
    session = RefreshSession(
        user_id=user.id,
        token_hash=refresh_hash,
        jti=_jti,
        expires_at=refresh_token_expiry(),
        created_ip=ip,
        last_used_ip=ip,
        user_agent=user_agent,
    )
    db.add(session)
    db.commit()

    from app.config import settings

    expires_in = settings.access_token_expire_minutes * 60
    return access_token, raw_refresh, expires_in


def rotate_refresh_token(
    db: Session, raw_refresh_token: str, *, ip: str | None = None, user_agent: str | None = None
) -> tuple[str, str, int]:
    """Validates + rotates a refresh token. Returns
    (new_access_token, new_raw_refresh_token, expires_in_seconds).

    Reuse detection: if the presented token hashes to a session that's
    already revoked, that's a signal the token was copied (the legitimate
    client would have moved on to the token that replaced it). Rather than
    just rejecting the request, the entire rotation chain descending from
    that session is revoked too — if an attacker and the real user are
    both holding copies of an old token, this kicks both out and forces a
    fresh login, rather than only closing the door the attacker happened
    to knock on first.
    """
    token_hash = hash_refresh_token(raw_refresh_token)
    session = db.query(RefreshSession).filter(RefreshSession.token_hash == token_hash).first()

    if session is None:
        raise AuthError("Invalid refresh token")

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if session.revoked_at is not None:
        _revoke_chain_from(db, session)
        db.commit()
        raise AuthError("Refresh token has already been used and was revoked. Please log in again.")

    if session.expires_at <= now:
        raise AuthError("Refresh token has expired. Please log in again.")

    user = db.query(User).filter(User.id == session.user_id).first()
    if user is None:
        raise AuthError("Account no longer exists")

    # Rotate: revoke this session, mint a new access token + new session,
    # link them. Both writes happen in one DB transaction (single commit
    # below) so a crash between them can't leave an orphaned revoked
    # session with no replacement.
    session.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    session.last_used_at = session.revoked_at
    if ip:
        session.last_used_ip = ip

    access_token, _jti, _expire = create_access_token(user.id, user.role.value)
    raw_refresh, refresh_hash = generate_refresh_token()
    new_session = RefreshSession(
        user_id=user.id,
        token_hash=refresh_hash,
        jti=_jti,
        expires_at=refresh_token_expiry(),
        created_ip=ip,
        last_used_ip=ip,
        user_agent=user_agent,
    )
    db.add(new_session)
    db.flush()  # need new_session.id before linking
    session.replaced_by_id = new_session.id
    db.commit()

    from app.config import settings

    expires_in = settings.access_token_expire_minutes * 60
    return access_token, raw_refresh, expires_in


def _revoke_chain_from(db: Session, session: RefreshSession) -> None:
    """Walks forward through replaced_by links from an already-revoked
    session and revokes every descendant too, so a stolen-then-reused
    token can't be used to keep the attacker's side of a rotation chain
    alive after the theft is detected."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    current = session
    seen: set[int] = set()
    while current.replaced_by_id and current.replaced_by_id not in seen:
        seen.add(current.replaced_by_id)
        nxt = db.query(RefreshSession).filter(RefreshSession.id == current.replaced_by_id).first()
        if nxt is None:
            break
        if nxt.revoked_at is None:
            nxt.revoked_at = now
        current = nxt


def logout(db: Session, raw_refresh_token: str) -> None:
    """Revokes the session behind this refresh token, if it exists. Never
    raises for an already-invalid/unknown token — logout is idempotent
    from the client's point of view. Note: this does NOT invalidate any
    access token already issued off this session; that JWT remains valid
    (stateless) until its own short expiry. See README's Authentication
    section for the trade-off."""
    token_hash = hash_refresh_token(raw_refresh_token)
    session = db.query(RefreshSession).filter(RefreshSession.token_hash == token_hash).first()
    if session and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
