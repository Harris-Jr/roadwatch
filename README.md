# RoadWatch Zambia
### AI Road Intelligence Platform

A full-stack web platform for AI-assisted pothole detection and road
condition monitoring on Zambian roads — built as a final-year capstone
project for the **Road Development Agency (RDA)** and **city/municipal
councils**, with a subscription layer for individual motorists and
fleet/logistics businesses.

**Live Demo:** _not yet deployed — see [Deployment](#deployment)_
**Staff Portal:** `/admin` (Government accounts only)
**API Docs:** `http://localhost:8000/docs` (once running locally)
**Origin:** University of Zambia, Department of Library and Information
Science — Automated Pothole Detection and Classification System

---

## Overview

Road monitoring in Zambia is currently a manual process — physical
inspections by RDA and council staff, with no systematic way to detect,
classify, or track potholes at scale. RoadWatch Zambia automates this with
a CNN-based image classifier, a crowdsourced public reporting flow, and an
institutional video-ingestion pipeline for council road surveys, all
surfaced on a single live map.

The system is split into three parts that together act as one
application: a React frontend, a FastAPI backend, and a standalone `ai`
package (your trained classifier, video frame extraction, and OCR-based
location resolution) that the backend imports directly.

---

## Role Structure

| Role | Plan tiers | Access |
|------|-----------|--------|
| `government` | — | Full admin dashboard — reports, video ingestion, road segments, users, settings. Scoped to the account's `organization` (RDA or a specific council) |
| `business` | `free` / `business` | Fleet-facing dashboard — hazard map, severe-hazard tracking. Corridor risk analytics planned, not yet backed by data |
| `individual` | `free` / `premium` | Personal dashboard — recent activity, route planning (simulated pending a routing engine) |
| _(anonymous)_ | — | Public map, Quick Report submission — no account required |

All roles log in through the same `/auth` page. There's one login, not
three — the backend returns the account's real `role` on login/signup, and
the frontend routes to the correct dashboard from that, rather than
guessing or asking the user to pick a portal.

---

## Features

### Public (No Login Required)
- **Live map** — every confirmed report plotted on OpenStreetMap tiles via Leaflet, color-coded by severity (minor / moderate / severe)
- **Filters** — severity, status, council/area
- **Quick Report** — 3-step guided flow (capture → confirm location → submitted). Uses the browser's real Geolocation API, not a placeholder pin
- **Pothole detail pages** — full metadata, status, and (simplified) history for any confirmed report

### For Motorists (Individual accounts)
- **Driver dashboard** — recent public activity (see [Known Limitations](#known-limitations) — not yet filtered to "my reports" specifically)
- **Navigate** — real destination search, real OSRM routing, real PostGIS hazard scoring (see Real Routing Flow below)
- Free / Premium plan selection at signup

### For Businesses / Fleet Accounts
- **Business dashboard** — severe-hazard count and live map, both real
- Corridor risk table and vehicle tracking — real `vehicles`/`corridors` tables, risk computed live via the same routing + hazard-scoring engine as Navigate (see Corridor Risk Flow below; vehicles are registered records, not live GPS telematics — see Known Limitations)

### For Government Staff (RDA / Council)
- **Dashboard** — open / in-progress / fixed-this-month counts, average resolution time, 12-month reports chart, live map — all computed from real data
- **Road Reports** — sortable, filterable table across every report; per-report status and council-assignment editing, both persisted
- **Map View** — full live map with marker detail panel
- **Video Upload & Processing** — upload pre-recorded dash-cam/survey footage; frames are sampled, classified, and geolocated in the background; results land in a review queue with Confirm / Reject actions that publish (or discard) each detection
- **Road Segments** — add/remove segments with category (per the Roads and Road Traffic Act's six-way classification) and responsible entity
- **Users & Roles** — every registered account, role, and plan
- **Settings** — auto-publish confidence thresholds per severity tier, notification routing, footage retention period — genuinely editable and persisted

---

## Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 + TanStack Start | UI framework, file-based routing, SSR |
| TanStack Router / Query | Client-side routing, data fetching & caching |
| Tailwind CSS v4 | Styling |
| Leaflet + OpenStreetMap | Map rendering (no Google Maps dependency, no API key) |
| Vite | Build tooling |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI | REST API |
| SQLAlchemy 2.0 + GeoAlchemy2 | ORM, PostGIS geometry support |
| Alembic | Schema migrations |
| python-jose + passlib | JWT auth, password hashing |

### AI (`ai/` package)
| Technology | Purpose |
|-----------|---------|
| TensorFlow / Keras | Loads the trained `.h5` binary pothole classifier |
| OpenCV | Video frame sampling |
| Tesseract OCR (pytesseract) | Reads GPS coordinates burned into dash-cam frame overlays |

### Infrastructure
| Service | Purpose |
|---------|---------|
| PostgreSQL + PostGIS | Database — real spatial queries on report/segment/route geometry, not just lat/lon floats |
| OSRM (self-hosted) | Real route computation — actual road-following geometry, distance, duration, and turn-by-turn maneuvers, not estimates |
| Docker Compose | Local dev and VPS deployment — db, osrm, api, frontend as one stack |
| Nginx + Let's Encrypt | Reverse proxy and TLS on the VPS (deployment-time addition, not in this repo) |
| OpenStreetMap Nominatim | Free forward and reverse geocoding — destination search and Quick Report road names |

> **Payment gateway:** not yet integrated. Given the userbase, a mobile
> money gateway (MTN/Airtel Money) is a better fit than card-only
> processors for the Individual/Business subscription tiers — pending
> merchant setup.

---

## Database Schema

### users
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| email | string | Unique, used for login |
| hashed_password | string | bcrypt hash |
| full_name | string | Display name |
| role | enum | `individual` / `business` / `government` |
| plan | enum, nullable | `free` / `premium` (individual) or `free` / `business` (business); null for government |
| organization | string, nullable | e.g. "Road Development Agency", "Lusaka City Council" — government accounts only |
| created_at | timestamp | Account creation date |

### road_segments
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| name | string | Road name, e.g. "Kafue Road" |
| category | enum | `inter_territorial` / `territorial` / `district` / `branch` / `rural` / `estate` — per the Roads and Road Traffic Act |
| responsible_entity | string | RDA or the specific council |
| created_at | timestamp | Creation date |

### reports
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| road_name | string | Denormalized road name (reverse-geocoded for Quick Report) |
| road_segment_id | integer, nullable | FK → road_segments |
| severity | enum | `minor` / `moderate` / `severe` — bucketed from the classifier's confidence score |
| confidence | float | Raw classifier confidence, 0.0–1.0 |
| status | enum | `reported` / `in_progress` / `fixed` |
| source | enum | `quick_report` / `council_survey` (`drive_mode` intentionally excluded — see [Key Technical Notes](#key-technical-notes)) |
| location | geometry(Point, 4326) | Real PostGIS point, not separate lat/lon floats |
| photo_url | string, nullable | Relative path under the uploads directory |
| note | text, nullable | Optional note from a Quick Report submitter |
| assigned_council | string, nullable | Which council/RDA is responsible for repair |
| processing_job_id | integer, nullable | FK → processing_jobs, for video-sourced detections |
| frame_timestamp_seconds | float, nullable | Timestamp within the source video, if applicable |
| confirmed | boolean | Quick Reports auto-confirm; video detections start `false` pending admin review |
| reported_by_id | integer, nullable | FK → users — null for anonymous Quick Reports |
| reported_at | timestamp | Creation date |
| updated_at | timestamp | Last status change |

### processing_jobs
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| filename | string | Original uploaded filename |
| file_path | string | Path under the uploads directory |
| gps_log_path | string, nullable | Optional companion GPS log (CSV) uploaded alongside the video |
| status | enum | `queued` / `processing` / `completed` / `failed` |
| uploaded_by_id | integer, nullable | FK → users |
| frames_processed | integer | Count of frames sampled and classified |
| detections_found | integer | Count of positive detections from this job |
| error_message | text, nullable | Populated if the background job fails |
| uploaded_at | timestamp | Upload time |
| completed_at | timestamp, nullable | Processing completion time |

### app_settings
Single-row table backing the admin Settings page.

| Column | Type | Description |
|--------|------|--------------|
| minor_threshold | float | Min. confidence to auto-publish as "minor" (default 0.60) |
| moderate_threshold | float | Default 0.75 |
| severe_threshold | float | Default 0.85 |
| email_digest_time | string | e.g. "07:00" |
| sms_for_severe_enabled | boolean | Whether severe detections trigger SMS |
| data_retention_days | integer | How long raw footage is kept (default 90) |

### vehicles
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| business_id | integer | FK → users (a `business` role account) |
| name | string | e.g. "Truck 01" |
| plate_number | string, nullable | |
| created_at | timestamp | |

Real, admin-entered records — not a telematics/live-GPS-tracking
integration. That's a materially larger, separate system.

### corridors
| Column | Type | Description |
|--------|------|--------------|
| id | integer | Primary key |
| business_id | integer | FK → users |
| name | string | e.g. "Lusaka CBD → Kafue Road" |
| start_lat / start_lon | float | Corridor start point |
| end_lat / end_lon | float | Corridor end point |
| created_at | timestamp | |

Risk for a corridor is computed live against the real routing engine and
real `reports` table — nothing about "risk" is stored here, only the two
endpoints a business wants tracked.

---

## API Endpoints

| Router | Endpoints | Notes |
|--------|-----------|-------|
| `auth` | `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` | Returns a JWT + the real role on login/signup |
| `reports` | `GET /reports`, `GET /reports/{id}`, `POST /reports/quick-report`, `PATCH /reports/{id}`, `POST /reports/{id}/confirm`, `DELETE /reports/{id}` | Quick Report is unauthenticated by design |
| `road-segments` | `GET`, `POST`, `DELETE /road-segments/{id}` | Mutations require `government` role |
| `users` | `GET /users` | `government` role only |
| `uploads` | `POST /uploads/video`, `GET /uploads/jobs`, `GET /uploads/jobs/{id}/detections` | Video processing runs as a FastAPI background task |
| `dashboard` | `GET /dashboard/summary` | Powers the admin Dashboard's stat cards and chart |
| `settings` | `GET /settings`, `PATCH /settings` | Read is public (thresholds are not sensitive); write requires `government` role |
| `routing` | `GET /routing/search`, `POST /routing/routes` | Real destination search (Nominatim) and real route options (OSRM + live hazard scoring) |
| `business` | `GET/POST /business/vehicles`, `DELETE /business/vehicles/{id}`, `GET/POST /business/corridors`, `DELETE /business/corridors/{id}`, `GET /business/corridors/{id}/risk`, `GET /business/summary` | `business` role only |

Full interactive docs at `/docs` once the API is running.

---

## Key Flows

### Quick Report Flow
1. Motorist taps **Report a pothole** on the public map
2. Captures a **photo or a short video clip** (video: the first 8 seconds are sampled and classified frame-by-frame; the highest-confidence frame becomes the report's representative image) and picks a severity (optional)
3. Browser's Geolocation API supplies real coordinates. If that's unavailable or denied, the backend falls back to **OCR**, reading GPS coordinates burned into the photo/frame itself (for photos taken with a GPS-camera app) — only if neither resolves does submission get rejected
4. Backend runs the CNN classifier; severity comes from the confidence-threshold bucket, or from the submitter's manual choice if they set one
5. Report is reverse-geocoded (OpenStreetMap Nominatim) and saved — auto-confirmed if the model was confident, otherwise queued for admin review

### Real Routing Flow (Navigate)
1. Person searches a destination — real results from OpenStreetMap Nominatim, biased to Zambia, not a hardcoded list
2. Backend requests real route alternatives from a self-hosted **OSRM** instance (actual road-following geometry, distance, duration, turn-by-turn maneuvers)
3. Each alternative is scored by a **real PostGIS query** — confirmed severe/moderate/minor reports within 60m of that route's actual geometry — and labeled Safest / Balanced / Fastest based on that real score, not fixed numbers
4. During active navigation, the browser's live GPS (`watchPosition`) tracks real position on the map alongside the real route line; the "next" instruction is whichever real maneuver step is currently closest ahead, generated from OSRM's actual maneuver data
5. If OSRM isn't reachable (e.g. the Zambia map data hasn't been set up yet), routing falls back to a straight-line estimate — clearly labeled `estimated: true` in the response and shown as such in the UI, never presented as if it were real

### Corridor Risk Flow (Business accounts)
1. Business account adds a corridor — a named start/end point pair, picked via the same real place search as Navigate
2. Requesting that corridor's risk reuses the exact same "real route + real hazard score" engine Navigate uses
3. Risk (Low/Moderate/High) is computed live from the real hazard score every time it's requested — nothing is cached or hardcoded

### Video Upload & Review Flow
1. Government staff upload dash-cam/survey footage on **Video Upload & Processing**
2. A background task samples frames (interval configurable via `.env`), runs each through the classifier
3. For frames above the confidence floor, location is resolved: OCR reads GPS burned into the frame first, falling back to a companion GPS log file if uploaded, or skipped if neither resolves
4. Detections land in a per-job review queue, `confirmed = false`
5. Staff **Confirm** (publishes to the public map) or **Reject** (deletes) each one — or **Confirm all**

### Login & Role Routing Flow
1. Person logs in or signs up at `/auth`, picking `Individual` / `Business` / `Government` on signup
2. Backend validates and returns a JWT plus the account's real `role`
3. Frontend routes based on that returned role — `government` → `/admin`, `business` → `/dashboard/business`, `individual` → `/dashboard/driver`
4. This replaced an earlier frontend-only version that had no way to know which dashboard to open on login and always guessed

---

## Key Technical Notes

- **`ReportSource` has no `drive_mode` value.** Drive Mode was originally a passive background-recording feature; it was redesigned to be pure navigation (destination input, route options) because ordinary phones aren't reliably mounted well enough for usable detection data. It collects nothing now, so it was removed as a valid source rather than left as dead data.
- **Severity is bucketed from one model's confidence score, not a second classifier.** There's one trained `.h5` file (binary pothole/no-pothole). The three Settings thresholds (minor/moderate/severe) double as the severity cutoffs — that page is this logic's live config, not a separate concept.
- **Location resolution has a fallback chain, not just OCR.** `ai/ai/location.py` tries OCR first, then a companion GPS log CSV, then gives up rather than guessing. Confirm with your actual footage source whether it reliably burns GPS into frames before assuming OCR alone is sufficient.
- **Quick Report's severity field is a human override, not just a label.** A submitter-selected severity lets a report through to the review queue even if the model wasn't confident, rather than silently rejecting it.
- **The `ai` package has zero dependency on `backend`.** It reads its own environment variables and resolves its model path relative to its own file location (`Path(__file__).parent`), not the process's working directory — this avoids breakage when the same code runs from Docker vs. a local `backend/` shell vs. the repo root.
- **Frontend has no Lovable dependency.** The project was prototyped in Lovable; `vite.config.ts` has since been rebuilt directly on `@tanstack/react-start`, `@vitejs/plugin-react`, `@tailwindcss/vite`, and `vite-tsconfig-paths` with the platform wrapper and its error-reporting hook fully removed.
- **Admin Road Reports' status/council dropdowns are bound to the actual selected report's state**, not left showing the first option regardless of what's real — a real bug from an earlier prototype pass, now backed by a genuine `PATCH /reports/{id}`.

---

## Database Setup (Step by Step)

Schema is managed with Alembic, not hand-written SQL — but here's the
equivalent DDL for reference if you want to understand the shape of the
database without reading the SQLAlchemy models:

```sql
create extension if not exists postgis;

create table users (
  id serial primary key,
  email varchar(255) unique not null,
  hashed_password varchar(255) not null,
  full_name varchar(255) not null,
  role varchar(20) not null check (role in ('individual','business','government')),
  plan varchar(20) check (plan in ('free','premium','business')),
  organization varchar(255),
  created_at timestamp default now()
);

create table road_segments (
  id serial primary key,
  name varchar(255) not null,
  category varchar(30) not null check (category in
    ('inter_territorial','territorial','district','branch','rural','estate')),
  responsible_entity varchar(255) not null,
  created_at timestamp default now()
);

create table processing_jobs (
  id serial primary key,
  filename varchar(500) not null,
  file_path varchar(1000) not null,
  gps_log_path varchar(1000),
  status varchar(20) default 'queued' check (status in
    ('queued','processing','completed','failed')),
  uploaded_by_id integer references users(id),
  frames_processed integer default 0,
  detections_found integer default 0,
  error_message text,
  uploaded_at timestamp default now(),
  completed_at timestamp
);

create table reports (
  id serial primary key,
  road_name varchar(255) not null,
  road_segment_id integer references road_segments(id),
  severity varchar(10) not null check (severity in ('minor','moderate','severe')),
  confidence float not null,
  status varchar(20) default 'reported' check (status in ('reported','in_progress','fixed')),
  source varchar(20) not null check (source in ('quick_report','council_survey')),
  location geometry(Point, 4326) not null,
  photo_url varchar(1000),
  note text,
  assigned_council varchar(255),
  processing_job_id integer references processing_jobs(id),
  frame_timestamp_seconds float,
  confirmed boolean default true,
  reported_by_id integer references users(id),
  reported_at timestamp default now(),
  updated_at timestamp default now()
);

create table app_settings (
  id integer primary key default 1,
  minor_threshold float default 0.60,
  moderate_threshold float default 0.75,
  severe_threshold float default 0.85,
  email_digest_time varchar(10) default '07:00',
  sms_for_severe_enabled boolean default true,
  data_retention_days integer default 90
);

create index idx_reports_location on reports using gist (location);
```

**In practice, don't run this by hand** — use the real workflow:

```bash
cp .env.example .env               # then set a real JWT_SECRET
docker compose up -d
docker compose exec api alembic revision --autogenerate -m "initial schema"
docker compose exec api alembic upgrade head
docker compose exec api python seed.py
```

`seed.py` creates 4 users, 9 road segments, default settings, and 24
sample reports scattered around Lusaka — see the table below.

### Seeded accounts

Password for all of them: `password123`

| Email | Role | Notes |
|---|---|---|
| `rda.admin@roadwatch.zm` | Government | Road Development Agency |
| `council.admin@roadwatch.zm` | Government | Lusaka City Council |
| `driver@roadwatch.zm` | Individual | Free plan |
| `fleet@roadwatch.zm` | Business | Business plan |

---

## Project Structure

```
roadwatch-zambia/
├── frontend/
│   └── src/
│       ├── routes/              # File-based routing (TanStack Start)
│       │   ├── index.tsx        # Public map
│       │   ├── report.tsx       # Quick Report (3-step flow)
│       │   ├── navigate.tsx     # Route planning (simulated)
│       │   ├── auth.tsx         # Login / Signup
│       │   ├── pothole.$id.tsx  # Report detail
│       │   ├── admin.tsx        # Admin layout + auth guard
│       │   ├── admin.index.tsx  # Dashboard
│       │   ├── admin.reports.tsx
│       │   ├── admin.map.tsx
│       │   ├── admin.video.tsx  # Upload & Processing
│       │   ├── admin.segments.tsx
│       │   ├── admin.settings.tsx
│       │   ├── admin.users.tsx
│       │   ├── dashboard.tsx    # Individual/Business layout + auth guard
│       │   ├── dashboard.driver.tsx
│       │   └── dashboard.business.tsx
│       ├── components/
│       │   ├── roadwatch/       # LeafletMap, badges, StatCard, PotholeCard
│       │   └── site/            # Header, brand lockup
│       └── lib/
│           ├── api.ts           # Every backend call lives here
│           ├── auth.tsx         # Auth context (JWT + user, from real login)
│           └── types.ts         # Shared frontend types
├── backend/
│   └── app/
│       ├── routers/             # auth, reports, road_segments, users, uploads, dashboard, settings, routing, business
│       ├── models.py            # SQLAlchemy models
│       ├── schemas.py           # Pydantic request/response schemas
│       ├── security.py          # JWT + password hashing
│       ├── deps.py              # Auth dependencies, role guards
│       └── services/            # geocoding.py, storage.py, routing.py (non-ML only)
├── ai/
│   └── ai/
│       ├── inference.py         # Classifier wrapper — exact training-time preprocessing
│       ├── frames.py            # Video frame sampling
│       ├── location.py          # OCR + GPS-log location resolver
│       └── model/                # Drop your trained .h5 here
└── docker-compose.yml
```

---

## Environment Variables Checklist

Copy `.env.example` to `.env` at the repo root — one file, read by both
`backend` and `ai`.

- [ ] `DATABASE_URL`
- [ ] `JWT_SECRET` — generate with `openssl rand -hex 32`, don't ship the placeholder
- [ ] `CORS_ORIGINS` — add your real domain before deploying
- [ ] `OSRM_URL` — defaults to the docker-compose `osrm` service; see [Setting Up Real Routing](#setting-up-real-routing)
- [ ] `MODEL_INPUT_SIZE` — leave at 224 unless you retrain against a different input size
- [ ] `VITE_API_URL` — the frontend's view of the backend

---

## Login Portal

| Portal | URL | Who Uses It |
|--------|-----|--------------|
| Unified login | `/auth` | Individual, Business, and Government accounts alike — role decides the redirect |

---

## Setting Up Real Routing

Navigate and corridor risk both need a self-hosted OSRM instance with
actual Zambia road data. This is a one-time setup, and it has to happen on
your machine or VPS — **downloading real OpenStreetMap data isn't
possible from within an AI sandbox**, so this section is written from
OSRM's documented workflow, not verified end-to-end against live Zambia
data. If a step behaves differently than described, check
[OSRM's own docs](https://github.com/Project-OSRM/osrm-backend) against
whatever version the `osrm/osrm-backend` image pulls.

```bash
mkdir -p osrm-data && cd osrm-data

# Zambia extract from Geofabrik (~50-100MB)
curl -O https://download.geofabrik.de/africa/zambia-latest.osm.pbf

# One-time preprocessing — extract, partition, customize (MLD algorithm)
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/zambia-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/zambia-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/zambia-latest.osrm

cd ..
docker compose up -d osrm
```

Until this is done, `osrm` will fail to start (it has no data to serve) —
that's expected, and the rest of the app keeps working: `routing.py`
detects OSRM is unreachable and falls back to straight-line estimates,
clearly flagged as `estimated: true` end to end, frontend included.

Verify it's working: `curl http://localhost:5000/route/v1/driving/28.28,-15.41;28.19,-15.50` should return a real route, not an error.

## Known Limitations

- **Quick Report is anonymous** — no `reported_by` link between a report and a logged-in individual account yet, so the driver dashboard shows recent public activity rather than a true per-user filter
- **OSRM needs a one-time real-data setup** (above) before routing/corridor-risk return real routes instead of straight-line estimates — this can't be pre-verified in a sandboxed environment, only wired correctly per OSRM's documented API
- **Turn-by-turn is maneuver-based, not voice-guided** — real instructions derived from OSRM's actual maneuver data, shown as text tied to live GPS proximity, but there's no spoken audio guidance or automatic rerouting if you go off-route
- **No live vehicle/GPS fleet tracking** — `vehicles` are real registered records (name, plate), not telematics hardware integration; "active" isn't a tracked live state
- **No marker clustering** — fine at seed-data volume, will need `react-leaflet-cluster` or similar once report volume grows
- **Tile provider is dev-only** — `tile.openstreetmap.org` is not licensed for production traffic; switch to CARTO, MapTiler, or Stadia Maps before real deployment
- **Nominatim rate limits** — the free tier caps at 1 request/second; destination search and corridor-endpoint search both hit it directly. Fine for testing, worth revisiting (self-hosted Nominatim, or a paid geocoder) before real traffic.

---

## Deployment

Same `docker-compose.yml`, plus Nginx in front for TLS termination and to
serve the frontend's production build instead of the dev server:

```bash
cd frontend && npm run build
```

Point Nginx at the built output for the frontend and reverse-proxy API
requests to the `api` container. Update `CORS_ORIGINS` and `VITE_API_URL`
in `.env` to your real domain before building.

---

## Roadmap

- **Mobile money integration** — MTN/Airtel Money for Individual Premium and Business subscriptions
- **Voice-guided turn-by-turn + auto-reroute** — current navigation shows real text instructions tied to live position; spoken guidance and automatic rerouting on a missed turn are the next step up
- **Report-to-account linking** — so Individual accounts can see their actual submission history
- **Single-image bulk import for admin** — a dedicated tool for staff to bulk-upload already GPS-stamped photos (e.g. from a GPS camera app), beyond Quick Report's per-submission OCR fallback
- **Marker clustering** — for map legibility at production report volumes
- **Dedicated severity classifier** — replacing confidence-threshold bucketing, if/when a labeled severity dataset exists
- **Self-hosted Nominatim or a paid geocoder** — once traffic outgrows the free 1 req/sec public instance

---

## Author

Originally developed by **Peter Daka** and team, Department of Library and
Information Science, University of Zambia — final-year capstone project,
in consultation with the Road Development Agency and Lusaka City Council.
