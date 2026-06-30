# =============================================================================
# app/core/database.py
# Configuración de conexiones: SQLAlchemy (async) + Supabase client
# Proporciona sesiones de base de datos y cliente Supabase como dependencias
# =============================================================================

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from supabase import create_client, Client
from loguru import logger
from typing import AsyncGenerator

from app.core.config import settings


# =============================================================================
# SQLALCHEMY - Motor Asíncrono
# Usado para consultas complejas y operaciones transaccionales críticas
# =============================================================================

def _build_async_db_url(url: str) -> str:
    """Convierte URL de postgres a asyncpg compatible."""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


# Motor asíncrono con pool de conexiones configurado
engine = create_async_engine(
    settings.DATABASE_URL,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0
    }
)

# Factory de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,        # Evita lazy loading post-commit
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Clase base para modelos SQLAlchemy (si se usan en el futuro)."""
    pass


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependencia FastAPI: Provee una sesión de base de datos asíncrona.
    Garantiza cierre correcto de la sesión con rollback en caso de error.

    Uso:
        @router.get("/ejemplo")
        async def endpoint(db: AsyncSession = Depends(get_db_session)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(f"Error en sesión de base de datos: {exc}")
            raise
        finally:
            await session.close()


async def check_db_connection() -> bool:
    """
    Verifica que la conexión a la base de datos esté activa.
    Usado en el health check del servidor.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception as exc:
        logger.error(f"Error verificando conexión a BD: {exc}")
        return False


# =============================================================================
# SUPABASE CLIENT
# Usado para autenticación (Auth) y operaciones específicas de Supabase
# =============================================================================

def get_supabase_admin_client() -> Client:
    """
    Cliente Supabase con SERVICE_ROLE_KEY.
    SOLO para operaciones del backend (crear usuarios, admin, etc.).
    NUNCA exponer este cliente al frontend.
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
    )


def get_supabase_anon_client() -> Client:
    """
    Cliente Supabase con ANON_KEY.
    Para operaciones de autenticación pública (login, registro).
    """
    return create_client(
        supabase_url=settings.SUPABASE_URL,
        supabase_key=settings.SUPABASE_ANON_KEY,
    )


# Instancias singleton (se crean una vez al iniciar)
supabase_admin: Client = get_supabase_admin_client()
supabase_anon: Client = get_supabase_anon_client()


def get_supabase_admin() -> Client:
    """Dependencia FastAPI para el cliente admin de Supabase."""
    return supabase_admin


def get_supabase_anon() -> Client:
    """Dependencia FastAPI para el cliente anon de Supabase."""
    return supabase_anon