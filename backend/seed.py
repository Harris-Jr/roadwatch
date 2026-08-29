"""Populates the database with real, queryable rows so you're not staring at
an empty app. Run after migrations: `python seed.py`

Safe to re-run — it checks for existing rows before inserting, so it won't
duplicate data.
"""

import random

from geoalchemy2.functions import ST_MakePoint, ST_SetSRID

from app.database import SessionLocal
from app.models import (
    AppSettings,
    Corridor,
    Plan,
    Report,
    ReportSource,
    ReportStatus,
    RoadCategory,
    RoadSegment,
    Severity,
    User,
    UserRole,
    Vehicle,
)
from app.security import hash_password

# Lusaka, roughly — used to scatter sample report coordinates realistically
LUSAKA_LAT, LUSAKA_LON = -15.3875, 28.3228


def _random_point_near_lusaka():
    lat = LUSAKA_LAT + random.uniform(-0.08, 0.08)
    lon = LUSAKA_LON + random.uniform(-0.08, 0.08)
    return lat, lon


def seed_users(db):
    if db.query(User).count() > 0:
        print("Users already seeded, skipping.")
        return

    users = [
        User(
            email="rda.admin@roadwatch.zm",
            hashed_password=hash_password("password123"),
            full_name="Chanda Mwansa",
            role=UserRole.government,
            organization="Road Development Agency",
        ),
        User(
            email="council.admin@roadwatch.zm",
            hashed_password=hash_password("password123"),
            full_name="Mutale Banda",
            role=UserRole.government,
            organization="Lusaka City Council",
        ),
        User(
            email="driver@roadwatch.zm",
            hashed_password=hash_password("password123"),
            full_name="Kondwani Zulu",
            role=UserRole.individual,
            plan=Plan.free,
        ),
        User(
            email="fleet@roadwatch.zm",
            hashed_password=hash_password("password123"),
            full_name="Musonda Logistics Ltd",
            role=UserRole.business,
            plan=Plan.business,
        ),
    ]
    db.add_all(users)
    db.commit()
    print(f"Seeded {len(users)} users (password for all: 'password123').")


def seed_road_segments(db):
    if db.query(RoadSegment).count() > 0:
        print("Road segments already seeded, skipping.")
        return

    segments = [
        RoadSegment(name="Great East Road", category=RoadCategory.inter_territorial, responsible_entity="RDA"),
        RoadSegment(name="Cairo Road", category=RoadCategory.territorial, responsible_entity="RDA"),
        RoadSegment(name="Kafue Road", category=RoadCategory.inter_territorial, responsible_entity="RDA"),
        RoadSegment(name="Mumbwa Road", category=RoadCategory.territorial, responsible_entity="RDA"),
        RoadSegment(name="Chachacha Road", category=RoadCategory.branch, responsible_entity="Lusaka City Council"),
        RoadSegment(name="Addis Ababa Drive", category=RoadCategory.branch, responsible_entity="Lusaka City Council"),
        RoadSegment(name="President Avenue", category=RoadCategory.district, responsible_entity="Lusaka City Council"),
        RoadSegment(name="Nkana Road", category=RoadCategory.territorial, responsible_entity="Kitwe City Council"),
        RoadSegment(name="Zambia Way", category=RoadCategory.branch, responsible_entity="Ndola City Council"),
    ]
    db.add_all(segments)
    db.commit()
    print(f"Seeded {len(segments)} road segments.")


def seed_settings(db):
    if db.query(AppSettings).count() > 0:
        print("Settings already seeded, skipping.")
        return

    db.add(
        AppSettings(
            id=1,
            minor_threshold=0.60,
            moderate_threshold=0.75,
            severe_threshold=0.85,
            email_digest_time="07:00",
            sms_for_severe_enabled=True,
            data_retention_days=90,
        )
    )
    db.commit()
    print("Seeded settings.")


def seed_reports(db):
    if db.query(Report).count() > 0:
        print("Reports already seeded, skipping.")
        return

    road_segments = db.query(RoadSegment).all()
    if not road_segments:
        print("No road segments found — seed those first.")
        return

    severities = [Severity.minor, Severity.moderate, Severity.severe]
    statuses = [ReportStatus.reported, ReportStatus.in_progress, ReportStatus.fixed]
    # "drive_mode" is intentionally excluded — Drive Mode is navigation-only
    # now and doesn't collect data. Only these two sources are valid going
    # forward.
    sources = [ReportSource.quick_report, ReportSource.council_survey]

    reports = []
    for _ in range(24):
        segment = random.choice(road_segments)
        lat, lon = _random_point_near_lusaka()
        severity = random.choice(severities)
        confidence = {
            Severity.minor: random.uniform(0.60, 0.74),
            Severity.moderate: random.uniform(0.75, 0.84),
            Severity.severe: random.uniform(0.85, 0.99),
        }[severity]

        reports.append(
            Report(
                road_name=segment.name,
                road_segment_id=segment.id,
                severity=severity,
                confidence=confidence,
                status=random.choice(statuses),
                source=random.choice(sources),
                location=ST_SetSRID(ST_MakePoint(lon, lat), 4326),
                assigned_council=segment.responsible_entity,
                confirmed=True,
            )
        )

    db.add_all(reports)
    db.commit()
    print(f"Seeded {len(reports)} reports.")


def seed_business_fleet(db):
    if db.query(Vehicle).count() > 0 or db.query(Corridor).count() > 0:
        print("Fleet data already seeded, skipping.")
        return

    business_user = db.query(User).filter(User.email == "fleet@roadwatch.zm").first()
    if not business_user:
        print("No business user found — seed users first.")
        return

    vehicles = [
        Vehicle(business_id=business_user.id, name="Truck 01", plate_number="ABC 1234"),
        Vehicle(business_id=business_user.id, name="Truck 02", plate_number="ABC 5678"),
        Vehicle(business_id=business_user.id, name="Delivery Van 01", plate_number="ABD 9012"),
    ]
    db.add_all(vehicles)

    # Real coordinates for actual Lusaka-area corridors — risk for these is
    # computed live against the real routing engine + real reports, not
    # stored here.
    corridors = [
        Corridor(
            business_id=business_user.id,
            name="Lusaka CBD → Kafue Road",
            start_lat=-15.4067, start_lon=28.2871,
            end_lat=-15.5011, end_lon=28.1897,
        ),
        Corridor(
            business_id=business_user.id,
            name="Lusaka → Kabwe (Great North Rd)",
            start_lat=-15.4067, start_lon=28.2871,
            end_lat=-14.4469, end_lon=28.4464,
        ),
    ]
    db.add_all(corridors)
    db.commit()
    print(f"Seeded {len(vehicles)} vehicles and {len(corridors)} corridors.")


def main():
    db = SessionLocal()
    try:
        seed_users(db)
        seed_road_segments(db)
        seed_settings(db)
        seed_reports(db)
        seed_business_fleet(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
