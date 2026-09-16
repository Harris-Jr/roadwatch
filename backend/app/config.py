from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Checks the repo-root .env first (the shared one, single source of
    # truth), then a local backend/.env if you want to override just this
    # service. Docker Compose passes env vars directly and doesn't need
    # either file to be present.
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")

    database_url: str = "postgresql+psycopg2://roadwatch:roadwatch@db:5432/roadwatch"

    # --- JWT ---
    # jwt_secret has a dev default so the app still boots locally without a
    # .env, but validate_production_secrets() below refuses to start with
    # this default if ENVIRONMENT=production.
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_issuer: str = "roadwatch-zambia"
    jwt_audience: str = "roadwatch-api"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    # --- Passwords ---
    bcrypt_rounds: int = 12

    # --- Auth rate limiting (per IP, fixed window; see app/rate_limit.py) ---
    auth_rate_limit_login_per_minute: int = 5
    auth_rate_limit_register_per_minute: int = 5
    auth_rate_limit_refresh_per_minute: int = 20

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    upload_dir: str = "uploads"

    osrm_url: str = "http://osrm:5000"

    frame_sample_interval_seconds: float = 1.0

    # Set to "production" to enable startup secret validation below.
    environment: str = "development"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_production_secrets(self) -> None:
        """Called once at startup (see main.py). Fails fast rather than
        silently running an insecure production deployment."""
        if self.environment != "production":
            return
        if self.jwt_secret == "dev-secret-change-me" or len(self.jwt_secret) < 32:
            raise RuntimeError(
                "JWT_SECRET is missing or too weak for production. Generate "
                "one with `openssl rand -hex 32` and set it in your .env."
            )


settings = Settings()
