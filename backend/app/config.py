from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    SECRET_KEY: str = "changeme-use-a-long-random-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    DATABASE_URL: str = "sqlite:////data/tessera.db"

    FIRST_ADMIN_USERNAME: str = "admin"
    FIRST_ADMIN_PASSWORD: str = "changeme123"
    FIRST_ADMIN_EMAIL: str = "admin@example.com"
    FIRST_ADMIN_FULL_NAME: str = "Administrator"

    APP_VERSION: str = "1.0.0"

    # Comma-separated list of allowed CORS origins.
    # Example: CORS_ORIGINS=https://my-lab.example.com,https://tessera.example.com
    # Leave empty to restrict to localhost only (safe for local Docker deployments).
    CORS_ORIGINS: str = ""

    # Optional URL of a companion Elementa LIMS instance.
    # When set, Mol. Ref values in usage logs will be rendered as clickable links.
    # Example: ELEMENTA_URL=http://your-server:8001
    ELEMENTA_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
