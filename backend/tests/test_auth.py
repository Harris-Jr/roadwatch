import time

from app.security import create_access_token, decode_access_token, hash_password, verify_password, TokenError
from app.config import settings

VALID_PASSWORD = "StrongPass123!"


# --- Registration --------------------------------------------------------


def test_signup_valid(client):
    resp = client.post(
        "/auth/signup",
        json={
            "email": "new@example.com",
            "password": VALID_PASSWORD,
            "full_name": "New User",
            "role": "individual",
            "plan": "free",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user"]["email"] == "new@example.com"
    assert "password" not in body["user"]
    assert "hashed_password" not in body["user"]
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["expires_in"] == settings.access_token_expire_minutes * 60


def test_signup_invalid_email(client):
    resp = client.post(
        "/auth/signup",
        json={
            "email": "not-an-email",
            "password": VALID_PASSWORD,
            "full_name": "New User",
            "role": "individual",
        },
    )
    assert resp.status_code == 422


def test_signup_weak_password(client):
    resp = client.post(
        "/auth/signup",
        json={
            "email": "weak@example.com",
            "password": "password",  # no uppercase/number/special
            "full_name": "New User",
            "role": "individual",
        },
    )
    assert resp.status_code == 422


def test_signup_duplicate_email(client, registered_user):
    email, _password, _tokens = registered_user
    resp = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": VALID_PASSWORD,
            "full_name": "Dupe",
            "role": "individual",
        },
    )
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


def test_signup_government_rejects_plan(client):
    resp = client.post(
        "/auth/signup",
        json={
            "email": "gov@example.com",
            "password": VALID_PASSWORD,
            "full_name": "Gov User",
            "role": "government",
            "plan": "free",
        },
    )
    assert resp.status_code == 422


# --- Login -----------------------------------------------------------------


def test_login_correct_credentials(client, registered_user):
    email, password, _tokens = registered_user
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, registered_user):
    email, _password, _tokens = registered_user
    resp = client.post("/auth/login", json={"email": email, "password": "WrongPass123!"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password"


def test_login_unknown_email_same_error_as_wrong_password(client):
    """Login must not reveal whether the email exists."""
    resp = client.post("/auth/login", json={"email": "ghost@example.com", "password": "whatever123!A"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Incorrect email or password"


# --- Access tokens -----------------------------------------------------------


def test_me_with_valid_token(client, registered_user):
    _email, _password, tokens = registered_user
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "driver@example.com"


def test_me_missing_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_malformed_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert resp.status_code == 401


def test_expired_access_token_rejected():
    token, _jti, _exp = create_access_token(user_id=1, role="individual")
    # Forge an already-expired token using the real signing key, rather
    # than sleeping in a test — same effect, doesn't slow the suite down.
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    expired_payload = {
        "sub": "1",
        "role": "individual",
        "type": "access",
        "iat": datetime.now(timezone.utc) - timedelta(hours=1),
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": "expired-test",
    }
    expired_token = jose_jwt.encode(expired_payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

    try:
        decode_access_token(expired_token)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "expired"


def test_invalid_signature_rejected():
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    payload = {
        "sub": "1",
        "role": "individual",
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": "bad-sig-test",
    }
    tampered = jose_jwt.encode(payload, "wrong-secret-entirely", algorithm=settings.jwt_algorithm)
    try:
        decode_access_token(tampered)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "invalid"


def test_invalid_issuer_rejected():
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    payload = {
        "sub": "1",
        "role": "individual",
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": "someone-elses-issuer",
        "aud": settings.jwt_audience,
        "jti": "bad-iss-test",
    }
    token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    try:
        decode_access_token(token)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "invalid"


def test_invalid_audience_rejected():
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    payload = {
        "sub": "1",
        "role": "individual",
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": settings.jwt_issuer,
        "aud": "someone-elses-api",
        "jti": "bad-aud-test",
    }
    token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    try:
        decode_access_token(token)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "invalid"


def test_missing_subject_rejected():
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    payload = {
        "role": "individual",
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": "no-sub-test",
    }
    token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    try:
        decode_access_token(token)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "missing_subject"


def test_wrong_token_type_rejected():
    """A refresh token (or anything not type=access) must never work as
    an access token."""
    import jose.jwt as jose_jwt
    from datetime import datetime, timedelta, timezone

    payload = {
        "sub": "1",
        "role": "individual",
        "type": "refresh",  # wrong type
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "jti": "wrong-type-test",
    }
    token = jose_jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    try:
        decode_access_token(token)
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "wrong_type"


def test_malformed_jwt_rejected():
    try:
        decode_access_token("this.is.not-a-valid-jwt")
        assert False, "expected TokenError"
    except TokenError as exc:
        assert exc.reason == "invalid"


# --- Refresh tokens ----------------------------------------------------------


def test_refresh_valid(client, registered_user):
    _email, _password, tokens = registered_user
    resp = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["access_token"] != tokens["access_token"]
    assert body["refresh_token"] != tokens["refresh_token"]


def test_refresh_invalid_token(client):
    resp = client.post("/auth/refresh", json={"refresh_token": "totally-made-up-token"})
    assert resp.status_code == 401


def test_refresh_rotation_old_token_cannot_be_reused(client, registered_user):
    """Core rotation guarantee: once a refresh token has been used, it's
    dead — reusing it must fail even though it hasn't expired."""
    _email, _password, tokens = registered_user
    old_refresh = tokens["refresh_token"]

    first = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert first.status_code == 200

    second = client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert second.status_code == 401


def test_refresh_reuse_revokes_descendant_chain(client, registered_user):
    """If a *stale* (already-rotated-past) token is replayed, the session
    it rotated into should also be revoked (reuse-detection blast radius),
    so an attacker replaying an old token can't ride on the legitimate
    session that succeeded it."""
    _email, _password, tokens = registered_user
    token_v1 = tokens["refresh_token"]

    r2 = client.post("/auth/refresh", json={"refresh_token": token_v1})
    token_v2 = r2.json()["refresh_token"]

    # Replay the now-stale v1 token — should fail and burn the v2 session too.
    replay = client.post("/auth/refresh", json={"refresh_token": token_v1})
    assert replay.status_code == 401

    # v2, which was still valid a moment ago, should now also be dead.
    r3 = client.post("/auth/refresh", json={"refresh_token": token_v2})
    assert r3.status_code == 401


# --- Logout --------------------------------------------------------------


def test_logout_revokes_refresh_session(client, registered_user):
    _email, _password, tokens = registered_user
    logout_resp = client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert logout_resp.status_code == 204

    refresh_resp = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh_resp.status_code == 401


def test_logout_is_idempotent_on_unknown_token(client):
    resp = client.post("/auth/logout", json={"refresh_token": "never-issued"})
    assert resp.status_code == 204


# --- Password hashing --------------------------------------------------------


def test_password_hash_is_not_plaintext():
    hashed = hash_password(VALID_PASSWORD)
    assert hashed != VALID_PASSWORD
    assert hashed.startswith("$2")  # bcrypt hash prefix


def test_password_verify_correct():
    hashed = hash_password(VALID_PASSWORD)
    assert verify_password(VALID_PASSWORD, hashed) is True


def test_password_verify_incorrect():
    hashed = hash_password(VALID_PASSWORD)
    assert verify_password("SomethingElse123!", hashed) is False


# --- Rate limiting -------------------------------------------------------------


def test_login_rate_limited_after_threshold(client, registered_user):
    email, _password, _tokens = registered_user
    limit = settings.auth_rate_limit_login_per_minute

    for _ in range(limit):
        resp = client.post("/auth/login", json={"email": email, "password": "WrongPass123!"})
        assert resp.status_code == 401  # wrong password, but under the limit

    over_limit_resp = client.post("/auth/login", json={"email": email, "password": "WrongPass123!"})
    assert over_limit_resp.status_code == 429
    assert "Retry-After" in over_limit_resp.headers
