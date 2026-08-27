from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Checks the repo-root .env first (the shared one, single source of
    # truth), then a local backend/.env if you want to override just this
    # service. Docker Compose passes env vars directly and doesn't need
    # either file to be present.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+psycopg2://roadwatch:roadwatch@db:5432/roadwatch"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    upload_dir: str = "uploads"

    frame_sample_interval_seconds: float = 1.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
