import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import auth, business, dashboard, reports, road_segments, routing, settings as settings_router, uploads, users

app = FastAPI(title="RoadWatch Zambia API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs(settings.upload_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(road_segments.router)
app.include_router(users.router)
app.include_router(uploads.router)
app.include_router(dashboard.router)
app.include_router(settings_router.router)
app.include_router(routing.router)
app.include_router(business.router)


@app.get("/health")
def health():
    return {"status": "ok"}
