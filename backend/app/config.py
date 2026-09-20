"""Backend Configuration Settings for MOCS-Cert."""

import os
from typing import Any

from pydantic import BaseModel, Field, field_validator

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_DEFAULT_CORS_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "https://mocs-cert.pages.dev",
    "https://mocs-cert.moalimjaveed.workers.dev",
    "https://mocs-cert.onrender.com",
]


class Settings(BaseModel):
    PROJECT_NAME: str = "MOCS-Cert"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: list(_DEFAULT_CORS_ORIGINS))
    DATA_DIR: str = os.path.join(_PROJECT_ROOT, "data")
    DATA_ROOT: str = os.path.join(_PROJECT_ROOT, "tests", "data")
    INDEX_ROOT: str = os.path.join(_PROJECT_ROOT, "tests", "data", "indices")
    ARRAY_BACKEND: str = "auto"
    DEFAULT_PORT: int = 8000
    DEFAULT_HOST: str = "127.0.0.1"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, str):
            origins = [origin.strip() for origin in value.split(",") if origin.strip()]
        elif isinstance(value, list):
            origins = [str(origin).strip() for origin in value if str(origin).strip()]
        else:
            raise TypeError("CORS_ORIGINS must be a comma-separated string or list")
        if not origins or "*" in origins:
            raise ValueError("CORS_ORIGINS must contain explicit origins and cannot use '*'")
        return origins

    @classmethod
    def from_environment(cls) -> "Settings":
        values: dict[str, Any] = {}
        env_map = {
            "MOCS_PROJECT_NAME": "PROJECT_NAME",
            "MOCS_API_V1_STR": "API_V1_STR",
            "MOCS_CORS_ORIGINS": "CORS_ORIGINS",
            "MOCS_DATA_DIR": "DATA_DIR",
            "MOCS_DATA_ROOT": "DATA_ROOT",
            "MOCS_INDEX_ROOT": "INDEX_ROOT",
            "MOCS_ARRAY_BACKEND": "ARRAY_BACKEND",
            "MOCS_DEFAULT_PORT": "DEFAULT_PORT",
            "MOCS_DEFAULT_HOST": "DEFAULT_HOST",
        }
        for env_name, field_name in env_map.items():
            if (value := os.getenv(env_name)) is not None:
                values[field_name] = value
        return cls(**values)


settings = Settings.from_environment()
os.makedirs(settings.INDEX_ROOT, exist_ok=True)
