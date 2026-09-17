import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, business, dashboard, reports, road_segments, routing, settings as settings_router, uploads, users

settings.validate_production_secrets()  # fails fast rather than booting insecurely

app = FastAPI(title="RoadWatch Zambia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(road_segments.router)
app.include_router(users.router)
app.include_router(uploads.router)
app.include_router(dashboard.router)
app.include_router(settings_router.router)
app.include_router(routing.router)
app.include_router(business.router)

# Registered AFTER include_router(uploads.router) above, deliberately.
# Starlette matches routes/mounts in registration order, and both this
# mount and uploads.router use the "/uploads" path prefix. If this mount
# were registered first (as it originally was), it would catch every
# request under /uploads/* -- including /uploads/jobs and
# /uploads/jobs/{id}/detections -- before uploads.router's own routes
# ever got a chance to match, since StaticFiles doesn't filter by HTTP
# method or path shape, only prefix. A request for a path that doesn't
# correspond to an actual file (e.g. GET /uploads/jobs) would then fail
# with StaticFiles' own "file not found" 404 -- rendered in the same
# {"detail": "Not Found"} JSON shape as a real routing 404, making the
# two indistinguishable from the client's point of view. Keeping this
# mount last means uploads.router's specific routes are checked first;
# only paths that don't match any of them (e.g. GET
# /uploads/quick_reports/<uuid>.jpg, an actual uploaded file) fall
# through to being served as static files.
os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
def health():
    return {"status": "ok"}
