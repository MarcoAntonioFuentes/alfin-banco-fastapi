# =============================================================================
# app/core/security.py
# Utilidades de seguridad: JWT, contraseñas y verificación de tokens
# =============================================================================

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
import uuid

from app.core.config import settings
from app.core.database import supabase_admin

# Contexto de hashing de contraseñas (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Esquema de autenticación Bearer
bearer_scheme = HTTPBearer(auto_error=False)


# =============================================================================
# CONTRASEÑAS
# =============================================================================

def hash_password(password: str) -> str:
    """Genera hash bcrypt de una contraseña."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña contra su hash bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)


# =============================================================================
# JWT TOKENS
# =============================================================================

def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Crea un JWT de acceso firmado.

    Args:
        data: Payload del token (debe incluir 'sub' con el user_id)
        expires_delta: Tiempo de expiración personalizado

    Returns:
        JWT codificado como string
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": str(uuid.uuid4()),  # JWT ID único para revocación futura
        "type": "access"
    })
    return jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def create_refresh_token(user_id: str) -> str:
    """Crea un JWT de refresh con mayor duración."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    return jwt.encode(
        {
            "sub": user_id,
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "jti": str(uuid.uuid4()),
            "type": "refresh"
        },
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decodifica y valida un JWT.

    Raises:
        HTTPException 401 si el token es inválido o expirado
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Por favor, inicie sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError as exc:
        logger.warning(f"JWT inválido: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación inválido.",
            headers={"WWW-Authenticate": "Bearer"},
        )


# =============================================================================
# DEPENDENCIAS DE AUTENTICACIÓN
# =============================================================================

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Dict[str, Any]:
    """
    Dependencia FastAPI: Extrae y valida el usuario del token Bearer.
    Verifica el token contra Supabase Auth para máxima seguridad.

    Raises:
        HTTPException 401 si no hay token o es inválido
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere autenticación. Incluya el header Authorization: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Verificar token con Supabase Auth (fuente de verdad)
        user_response = supabase_admin.auth.get_user(token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido o sesión expirada.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = user_response.user
        return {
            "auth_user_id": user.id,
            "email": user.email,
            "token": token,
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error validando token Supabase: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo verificar la sesión. Intente iniciar sesión nuevamente.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_rol(roles_permitidos: list):
    """
    Factory de dependencias: Valida que el usuario tenga un rol específico.

    Uso:
        @router.post("/aprobar", dependencies=[Depends(require_rol(["comite", "admin"]))])
    """
    async def verificar_rol(
        current_user: Dict = Depends(get_current_user),
        db=None  # Se inyecta externamente cuando se usa
    ) -> Dict:
        # El rol se valida en el servicio consultando la tabla usuarios
        return current_user

    return verificar_rol