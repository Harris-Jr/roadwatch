# RoadWatch Zambia

AI-assisted pothole detection and road monitoring for Zambian roads. One
repo, three parts, communicating over HTTP and a local Python import:

```
roadwatch-zambia/
├── frontend/   React + TanStack Start — the app itself
├── backend/    FastAPI + PostgreSQL/PostGIS — auth, reports, CRUD
├── ai/         Your CNN classifier, video frame extraction, OCR location
│               resolution — imported directly by backend/, not a network
│               service of its own
└── docker-compose.yml
```

`ai` is a real local Python package, not just a folder — `backend` installs
it with `pip install -e ../ai` and imports it as `import ai.inference`,
`import ai.frames`, `import ai.location`. Nothing is duplicated between the
two; there's exactly one copy of the model-loading and OCR logic.

## Setup

1. **Copy the environment file:**
   ```
   cp .env.example .env
   ```
   Generate a real `JWT_SECRET` (`openssl rand -hex 32`) rather than using
   the placeholder.

2. **Bring everything up:**
   ```
   docker compose up -d
   ```
   This starts Postgres+PostGIS, the API (backend + ai together), and the
   frontend dev server. Prefer running the frontend natively for faster
   hot-reload? Comment out the `frontend` service in `docker-compose.yml`
   and instead run:
   ```
   cd frontend && npm install && npm run dev
   ```

3. **Generate and run the first migration** (there's no hand-written
   initial migration — Alembic autogenerates it correctly against a live
   DB, which is safer than hand-writing PostGIS DDL blind):
   ```
   docker compose exec api alembic revision --autogenerate -m "initial schema"
   docker compose exec api alembic upgrade head
   ```

4. **Seed real data:**
   ```
   docker compose exec api python seed.py
   ```
   Creates 4 users, 9 road segments, default settings, and 24 sample
   pothole reports scattered around Lusaka — see "Login accounts" below.

5. **Drop in your trained model:** put your `.h5` file at
   `ai/ai/model/cct_modelcnn.h5`. No restart needed if you're using the
   `--reload` dev command; otherwise restart the `api` container. Until
   it's there, the API runs on a mock classifier so you can test every
   other part of the app first.

6. **Open the app:**
   - Frontend: `http://localhost:5173`
   - API docs: `http://localhost:8000/docs`

## Login accounts (from `seed.py`)

Password for all of them: `password123`

| Email | Role | Notes |
|---|---|---|
| `rda.admin@roadwatch.zm` | Government | Road Development Agency |
| `council.admin@roadwatch.zm` | Government | Lusaka City Council |
| `driver@roadwatch.zm` | Individual | Free plan |
| `fleet@roadwatch.zm` | Business | Business plan |

Log in at `/auth` on the frontend — the role that comes back from
`/auth/login` decides which dashboard opens (admin / driver / business).
That's a real fix, not a guess: the old frontend-only version of this had
no way to know which dashboard to open on login and always defaulted to
one; now the backend tells it.

## What's real vs. what's still simulated

Everything data-driven reads from Postgres now — the public map, Quick
Report, admin Road Reports (including the status/council dropdowns, which
previously didn't reflect the actual selected report), Map View, Road
Segments, Settings (the "prototype only" banner is gone — it's genuinely
editable and persisted), Users & Roles, and Video Upload & Processing
(real upload, real background processing, real confirm/reject into the
public map).

Two things are deliberately still simulated, because building them for
real is out of scope for this pass, not an oversight:

- **Route planning (`/navigate`)** — there's no routing engine (OSRM /
  GraphHopper / Valhalla) wired up, so route ETAs, distances, and hazard
  counts are illustrative. The map itself now shows real report data.
- **Business fleet analytics** (`/dashboard/business`) — corridor risk
  scores and vehicle counts have no backing data model yet (no
  vehicles/corridors tables exist). The severe-hazard count and map on
  that page are real; the fleet-specific numbers are clearly marked as
  placeholders in the code.

## Decisions worth knowing about, not just assuming

- **Severity comes from one model's confidence score, not a separate
  severity classifier.** You have one `.h5` file — a binary pothole/
  no-pothole classifier. Severity is bucketed from that same confidence
  score using the three thresholds on the admin Settings page (minor 60%
  / moderate 75% / severe 85% by default — genuinely editable now). If you
  later train a dedicated severity model, swap the bucketing logic in
  `ai/ai/inference.py` for a real second `predict()` call.

- **Location resolution for admin video has a fallback chain, not just
  OCR.** `ai/ai/location.py` tries OCR first (for footage with GPS burned
  into the frame), then falls back to a companion GPS log file (CSV:
  `timestamp_seconds,lat,lon`) if one's uploaded alongside the video, and
  skips the detection rather than guessing if neither resolves. Confirm
  with whoever supplies your admin footage whether it actually has a
  burned-in GPS overlay — that determines whether OCR is load-bearing or
  dead weight here.

- **Quick Report's optional severity is a human override, not just a
  label.** If the model isn't confident it's a pothole but the person
  submitting picked a severity anyway, the report still gets created —
  unconfirmed, in the admin review queue, rather than silently rejected.

- **Road names for Quick Report are reverse-geocoded** via OpenStreetMap's
  free Nominatim API (consistent with using OSM tiles on the frontend).
  Video-sourced reports currently store `"Unnamed road"` since geocoding
  happens at submit time and video detections don't have that step yet.

- **`ReportSource` only has `quick_report` and `council_survey`.**
  `drive_mode` was deliberately dropped — Drive Mode is pure navigation now
  and collects nothing, so it's not a valid data source.

- **Quick Report is anonymous** (no login required to file one), so there's
  no `reported_by` link yet between a report and a logged-in individual
  account. The driver dashboard's "my reports" section shows recent public
  activity rather than a true per-user filter until that link exists.

## Deploying to your VPS

Same `docker-compose.yml`, plus Nginx in front for TLS termination and to
serve the frontend's production build instead of the dev server:

```
cd frontend && npm run build
```

Point Nginx at the built output for the frontend and reverse-proxy `/api`
(or your chosen path) to the `api` container. Update `CORS_ORIGINS` and
`VITE_API_URL` in `.env` to your real domain before building.
