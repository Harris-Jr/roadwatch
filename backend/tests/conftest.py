"""
Test fixtures for the authentication suite.

Deliberately builds a *minimal* FastAPI app containing only app.routers.auth,
rather than importing the full app.main. The full app also mounts
routers that import the ai/ package (TensorFlow, OpenCV, pytesseract) at
module level — none of which auth actually depends on. Scoping tests this
way means `pip install -r requirements.txt` in backend/ (no ai/ install,
no model weights, no OS-level tesseract/ffmpeg) is enough to run this
suite.

Uses an in-memory SQLite DB with only the two tables auth touches
(`users`, `refresh_sessions`) — not the full Base.metadata, since the
`reports` table's PostGIS Geometry column needs SpatiaLite to create on
SQLite, which isn't installed here and isn't needed for these tests.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import RefreshSession, User  # noqa: F401 — registers tables on Base
from app.rate_limit import reset_rate_limits
from app.routers import auth as auth_router_module


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    User.__table__.create(engine)
    RefreshSession.__table__.create(engine)

    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(
            engine, tables=[RefreshSession.__table__, User.__table__]
        )


@pytest.fixture()
def client(db_session):
    app = FastAPI()
    app.include_router(auth_router_module.router)

    def _override_get_db():
        try:
            yield db_session
        finally:
            pass  # db_session fixture owns closing the session

    app.dependency_overrides[get_db] = _override_get_db

    reset_rate_limits()
    with TestClient(app) as c:
        yield c
    reset_rate_limits()


@pytest.fixture()
def registered_user(client):
    """Registers one individual-plan user and returns
    (email, password, tokens_response_json)."""
    email = "driver@example.com"
    password = "StrongPass123!"
    resp = client.post(
        "/auth/signup",
        json={
            "email": email,
            "password": password,
            "full_name": "Test Driver",
            "role": "individual",
            "plan": "free",
        },
    )
    assert resp.status_code == 201, resp.text
    return email, password, resp.json()
