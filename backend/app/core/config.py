# =============================================================================
# app/core/config.py
# Configuración central de la aplicación usando Pydantic Settings
# Lee variables de entorno desde .env o el sistema operativo
# =============================================================================

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    """
    Configuración global de la aplicación.
    Todas las variables se leen desde .env o variables de entorno del sistema.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # --- Aplicación ---
    APP_NAME: str = "Alfin Banco API"
    APP_VERSION: str = "1.0.0"
    APP_ENV: str = "development"
    DEBUG: bool = False
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # --- Base de datos ---
    DATABASE_URL: str

    # --- JWT ---
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # --- Reglas bancarias ---
    SALDO_MINIMO_CUENTA: float = 0.00
    LIMITE_TRANSFERENCIA_DIARIA: float = 50000.00
    LIMITE_RETIRO_DIARIO: float = 10000.00
    TASA_ITF: float = 0.00005  # 0.005%

    # --- Logging ---
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/alfin_banco.log"

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def parse_cors_origins(cls, v: str) -> str:
        return v

    def get_cors_origins(self) -> List[str]:
        """Retorna lista de orígenes permitidos para CORS."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    def is_development(self) -> bool:
        return self.APP_ENV == "development"


# Instancia global (singleton) de configuración
settings = Settings()