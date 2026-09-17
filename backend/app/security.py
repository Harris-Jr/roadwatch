"""
Password hashing, JWT access tokens, and opaque refresh tokens.

Two distinct token concepts, deliberately kept separate:

- Access token: a stateless JWT (short-lived, ACCESS_TOKEN_EXPIRE_MINUTES).
  Carries `type: "access"`, `iss`, `aud`, `sub`, `jti`, `iat`, `exp`, plus
  the user's role. Verified without a DB round-trip on every request via
  app.deps.get_current_user. Because it's stateless, an already-issued
  access token remains technically valid until it expires even after
  logout/revocation — that's why it's kept short-lived. There is no
  access-token blacklist in this implementation (see README's
  Authentication section for why, and what a blacklist would cost).

- Refresh token: an opaque, high-entropy random string (NOT a JWT). The
  raw value is returned to the client exactly once, at issuance/rotation.
  Only its SHA-256 hash is ever stored (in the refresh_sessions table via
  app.models.RefreshSession) — a leaked database dump does not hand out
  usable refresh tokens. Every refresh rotates the token (old session
  revoked, new one created) and reuse of an already-revoked refresh token
  is treated as a possible theft event (see auth_service.rotate_refresh_token).
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
import bcrypt

from app.config import settings

# Rounds is read at import time from settings. Using the `bcrypt` library
# directly rather than passlib's CryptContext wrapper: passlib 1.7.4 (its
# last release, 2020) reads an internal `bcrypt.__about__.__version__`
# attribute at import time to detect the backend version, which newer
# `bcrypt` releases (4.1+) removed — a well-known passlib/bcrypt
# compatibility break with no passlib-side fix coming. Calling bcrypt
# directly sidesteps that version-sniffing path entirely.

ACCESS_TOKEN_TYPE = "access"
REFRESH_TOKEN_TYPE = "refresh"

# Raised for any access-token validation failure. app.deps translates this
# into a 401 with a specific, non-leaky detail message.
class TokenError(Exception):
    def __init__(self, reason: str):
        self.reason = reason
        super().__init__(reason)


# --- Passwords ---------------------------------------------------------


def hash_password(password: str) -> str:
    # bcrypt's algorithm only uses the first 72 bytes of the input and
    # raises on longer input in recent versions rather than silently
    # truncating (passlib used to truncate silently) -- truncate
    # ourselves so an unusually long (but otherwise valid) password
    # doesn't 500 instead of hashing.
    pw_bytes = password.encode("utf-8")[:72]
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt(rounds=settings.bcrypt_rounds))
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """bcrypt.checkpw compares in constant time internally."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8")[:72], hashed_password.encode("utf-8")
        )
    except (ValueError, TypeError):
        # Malformed/legacy hash in the DB — treat as a failed verification,
        # not a 500.
        return False


# --- Access tokens (stateless JWT) --------------------------------------


def create_access_token(user_id: int, role: str) -> tuple[str, str, datetime]:
    """Returns (token, jti, expires_at). jti isn't checked against a
    denylist on every request (that would make access tokens stateful,
    defeating the point) — it exists so a specific access token can be
    referenced in logs/audits without logging the token itself."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.access_token_expire_minutes)
    jti = uuid.uuid4().hex
    to_encode = {
        "sub": str(user_id),
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": expire,
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": jti,
    }
    token = jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, jti, expire


def decode_access_token(token: str) -> dict:
    """Validates signature, algorithm, issuer, audience, expiration, and
    token type. Raises TokenError with a specific reason on any failure —
    callers decide how much of that reason is safe to surface to the
    client (app.deps intentionally collapses most of these to a single
    generic 401 message; only "expired" is surfaced distinctly, matching
    the spec's example responses)."""
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],  # explicit allow-list — never "none" or attacker-chosen
            issuer=settings.jwt_issuer,
            audience=settings.jwt_audience,
        )
    except jwt.ExpiredSignatureError:
        raise TokenError("expired")
    except JWTError:
        raise TokenError("invalid")

    if payload.get("type") != ACCESS_TOKEN_TYPE:
        raise TokenError("wrong_type")
    if "sub" not in payload:
        raise TokenError("missing_subject")
    try:
        int(payload["sub"])
    except (TypeError, ValueError):
        raise TokenError("malformed_subject")

    return payload


# --- Refresh tokens (opaque, hashed at rest) ----------------------------


def generate_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, token_hash). raw_token is returned to the
    client and never stored; token_hash (SHA-256 hex digest) is what's
    persisted in RefreshSession.token_hash. SHA-256 (not bcrypt) is
    appropriate here — unlike a user-chosen password, this input is
    already 384 bits of CSPRNG entropy, so a slow KDF adds cost without
    adding security, and refresh/lookup happens on every API call that
    needs a token exchange."""
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def refresh_token_expiry() -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
