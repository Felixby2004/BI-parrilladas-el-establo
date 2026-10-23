from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
from pathlib import Path
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[2] / ".env", env_file_encoding="utf-8", extra="ignore")

    # Proyecto
    PROJECT_NAME: str = "Parrilladas El Establo — IMPULSE API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    API_PREFIX: str = "/api/v1"

    # Base de datos
    DATABASE_URL: str = "postgresql+asyncpg://establo_user:establo_pass@127.0.0.1:5432/establo_db"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return make_url(self.DATABASE_URL).set(drivername="postgresql+psycopg2").render_as_string(hide_password=False)

    # Mercado Pago
    MP_ACCESS_TOKEN: str = "TEST-0000000000000000-000000-00000000000000000000000000000000-000000000"
    MP_PUBLIC_KEY: Optional[str] = None
    MP_WEBHOOK_URL: str = "http://localhost:8000/api/v1/pagos/webhook"

    # Seguridad (para futuras fases)
    SECRET_KEY: str = "cambiar-en-produccion-usar-openssl-rand-hex-32"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480


settings = Settings()
