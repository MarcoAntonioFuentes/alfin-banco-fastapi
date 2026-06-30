# =============================================================================
# app/main.py
# Punto de entrada principal de la aplicación FastAPI de Alfin Banco
# Configura: middleware, CORS, manejadores de excepciones globales, lifespan
# =============================================================================

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from loguru import logger
import sys
import time

from app.core.config import settings
from app.core.database import check_db_connection
from app.api.v1.router import api_router


# =============================================================================
# CONFIGURACIÓN DE LOGGING
# =============================================================================

def configurar_logging():
    """Configura Loguru para logging estructurado a consola y archivo."""
    logger.remove()  # Eliminar handler por defecto

    # Handler de consola (desarrollo)
    logger.add(
        sys.stdout,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
               "<level>{level: <8}</level> | "
               "<cyan>{name}</cyan>:<cyan>{line}</cyan> - "
               "<level>{message}</level>",
        level=settings.LOG_LEVEL,
        colorize=True
    )

    # Handler de archivo (producción)
    logger.add(
        settings.LOG_FILE,
        rotation="10 MB",         # Rota al llegar a 10MB
        retention="30 days",      # Guarda logs 30 días
        compression="gz",         # Comprime logs antiguos
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{line} | {message}",
        enqueue=True              # Thread-safe
    )


# =============================================================================
# LIFESPAN (Startup / Shutdown)
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Maneja el ciclo de vida de la aplicación.
    - Startup: Verifica conexiones, configura logging
    - Shutdown: Cierra conexiones limpiamente
    """
    # --- STARTUP ---
    configurar_logging()
    logger.info("=" * 60)
    logger.info(f"🏦  {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"🌍  Entorno: {settings.APP_ENV.upper()}")
    logger.info("=" * 60)

    # Verificar conexión a base de datos
    logger.info("Verificando conexión a la base de datos...")
    db_ok = await check_db_connection()
    if db_ok:
        logger.success("✅  Conexión a PostgreSQL/Supabase establecida.")
    else:
        logger.error("❌  No se pudo conectar a la base de datos. Verifique DATABASE_URL.")
        if settings.is_production():
            raise RuntimeError("Fallo crítico: sin conexión a la base de datos en producción.")

    logger.info("✅  Aplicación lista para recibir solicitudes.")
    logger.info(f"📄  Documentación: http://localhost:8000/docs")

    yield  # La aplicación corre aquí

    # --- SHUTDOWN ---
    logger.info("🛑  Cerrando aplicación limpiamente...")
    logger.info("👋  Alfin Banco API detenido.")


# =============================================================================
# INSTANCIA PRINCIPAL DE FastAPI
# =============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="""
## 🏦 Alfin Banco - API del Sistema de Home Banking y Core Bancario

Sistema bancario completo con:

### Para Clientes (Home Banking)
- 🔐 **Autenticación** segura con Supabase Auth
- 💰 **Consulta de saldos** y movimientos
- 📤 **Depósitos y retiros** con validación de límites
- 🔄 **Transferencias** intrabancarias atómicas
- 💳 **Solicitud de créditos** con seguimiento de estado
- 📅 **Cronograma de pagos** (amortización francesa)

### Para el Core Bancario (Staff)
- 📋 **Bandeja de evaluación** para analistas
- 🏛️ **Flujo de comité** para aprobaciones
- 💸 **Desembolso automático** con generación de cronograma
- 📊 **Reportes**: cartera activa, mora, desembolsos del día

### Seguridad
- JWT via Supabase Auth
- Row Level Security (RLS) en base de datos
- Transacciones ACID para operaciones monetarias
    """,
    openapi_url="/api/openapi.json" if not settings.is_production() else None,
    docs_url="/docs" if not settings.is_production() else None,
    redoc_url="/redoc" if not settings.is_production() else None,
    lifespan=lifespan,
    contact={
        "name": "Alfin Banco - Tecnología",
        "url": "https://alfinbanco.pe",
        "email": "tecnologia@alfinbanco.pe"
    },
    license_info={
        "name": "Privado - Uso exclusivo Alfin Banco",
    }
)


# =============================================================================
# MIDDLEWARE
# =============================================================================

# CORS - Controla orígenes permitidos
# CORS - Controla orígenes permitidos (Forzado para producción y local)
origenes_permitidos = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://alfin-banco-fastapi-six.vercel.app",
    "https://alfin-banco-fastapi-7uj6andbl-marcoantoniofuentes-projects.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes_permitidos,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hosts de confianza (solo en producción)
if settings.is_production():
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["alfinbanco.pe", "*.alfinbanco.pe", "api.alfinbanco.pe"]
    )


@app.middleware("http")
async def middleware_logging_tiempo(request: Request, call_next):
    """
    Middleware de logging con manejo de excepciones.
    CRÍTICO: el try/except evita que excepciones internas cierren la conexión
    HTTP abruptamente (lo que el browser interpreta como error de red).
    """
    from fastapi.responses import JSONResponse as _JSONResponse
    inicio = time.time()

    try:
        response = await call_next(request)
    except Exception as exc:
        # Captura excepciones que escapan del stack de FastAPI
        # y devuelve un JSON 500 en lugar de cerrar la conexión
        duracion_ms = round((time.time() - inicio) * 1000, 2)
        logger.exception(
            f"Excepción no capturada en middleware | "
            f"{request.method} {request.url.path} | {duracion_ms}ms | {exc}"
        )
        return _JSONResponse(
            status_code=500,
            content={
                "error": "Error interno del servidor",
                "detalle": str(exc),
                "codigo": "MIDDLEWARE_ERROR"
            }
        )

    duracion_ms = round((time.time() - inicio) * 1000, 2)

    # No loguear health checks para no saturar los logs
    if request.url.path not in ("/health", "/"):
        log_level = "WARNING" if duracion_ms > 2000 else "INFO"
        logger.log(
            log_level,
            f"{request.method} {request.url.path} | "
            f"Status: {response.status_code} | "
            f"Tiempo: {duracion_ms}ms | "
            f"IP: {request.client.host if request.client else 'N/A'}"
        )

    response.headers["X-Process-Time"] = f"{duracion_ms}ms"
    return response


# =============================================================================
# MANEJADORES GLOBALES DE EXCEPCIONES
# Garantizan respuestas JSON consistentes sin crashear el servidor
# =============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    HTTP 422: Error de validación de Pydantic.
    Transforma los errores técnicos en mensajes amigables para el cliente.
    """
    errores = []
    for error in exc.errors():
        campo = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errores.append({
            "campo": campo or "body",
            "mensaje": error["msg"].replace("Value error, ", ""),
            "tipo": error["type"]
        })

    logger.warning(f"Error de validación en {request.url.path}: {errores}")

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": "Datos de entrada inválidos",
            "detalle": errores,
            "codigo": "VALIDATION_ERROR"
        }
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """HTTP 404: Ruta o recurso no encontrado."""
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={
            "error": "Recurso no encontrado",
            "detalle": f"La ruta '{request.url.path}' no existe en esta API.",
            "codigo": "NOT_FOUND"
        }
    )


@app.exception_handler(405)
async def method_not_allowed_handler(request: Request, exc):
    """HTTP 405: Método HTTP no permitido."""
    return JSONResponse(
        status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
        content={
            "error": "Método no permitido",
            "detalle": f"El método {request.method} no está permitido en esta ruta.",
            "codigo": "METHOD_NOT_ALLOWED"
        }
    )


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc: Exception):
    """HTTP 500: Error interno inesperado. Registra el error completo en logs."""
    logger.exception(f"Error interno en {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Error interno del servidor",
            "detalle": "Ocurrió un error inesperado. El equipo técnico ha sido notificado.",
            "codigo": "INTERNAL_SERVER_ERROR"
        }
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Captura cualquier excepción no manejada para evitar caídas del servidor."""
    logger.exception(f"Excepción no manejada en {request.url.path}: {type(exc).__name__}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Error inesperado",
            "detalle": "Por favor intente nuevamente o contacte a soporte.",
            "codigo": "UNHANDLED_ERROR"
        }
    )


# =============================================================================
# RUTAS BASE
# =============================================================================

@app.get("/", tags=["🏠 Sistema"], summary="Bienvenida")
async def root():
    """Endpoint raíz de verificación."""
    return {
        "sistema": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "estado": "operativo",
        "documentacion": "/docs",
        "entorno": settings.APP_ENV
    }


@app.get("/health", tags=["🏠 Sistema"], summary="Health Check")
async def health_check():
    """
    Health check para load balancers y monitoreo.
    Verifica el estado de la base de datos.
    """
    db_status = await check_db_connection()
    estado_general = "healthy" if db_status else "degraded"

    return JSONResponse(
        status_code=200 if db_status else 503,
        content={
            "status": estado_general,
            "version": settings.APP_VERSION,
            "entorno": settings.APP_ENV,
            "servicios": {
                "base_de_datos": "ok" if db_status else "error",
                "supabase_auth": "ok"
            }
        }
    )


# =============================================================================
# INCLUIR ROUTERS
# =============================================================================

app.include_router(api_router)


# =============================================================================
# PUNTO DE ENTRADA PARA DESARROLLO LOCAL
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.is_development(),
        log_level=settings.LOG_LEVEL.lower(),
        access_log=False  # Usamos nuestro propio middleware de logging
    )
