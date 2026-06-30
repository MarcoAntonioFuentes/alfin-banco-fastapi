# =============================================================================
# app/api/v1/endpoints/auth.py
# Endpoints de Autenticación + Recuperación de contraseña
# =============================================================================

from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from loguru import logger
import re
import os

from app.core.database import get_db_session, supabase_admin, supabase_anon
from app.core.security import get_current_user
from app.services.auth_service import AuthService
from app.schemas.schemas import (
    RegistroRequest, LoginRequest, TokenResponse,
    UsuarioResponse, MensajeResponse
)

router = APIRouter(prefix="/auth", tags=["🔐 Autenticación"])


# ─── Registro ─────────────────────────────────────────────────────────────────
@router.post(
    "/registro",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo usuario",
)
async def registrar_usuario(
    data: RegistroRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"Solicitud de registro: {data.email} | IP: {request.client.host}")
    service = AuthService(db)
    return await service.registrar_usuario(data)


# ─── Login ────────────────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Iniciar sesión",
)
async def iniciar_sesion(
    data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"Intento de login: {data.email} | IP: {request.client.host}")
    service = AuthService(db)
    return await service.iniciar_sesion(data)


# ─── Logout ───────────────────────────────────────────────────────────────────
@router.post(
    "/logout",
    response_model=MensajeResponse,
    summary="Cerrar sesión",
)
async def cerrar_sesion(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = AuthService(db)
    return await service.cerrar_sesion(current_user["token"])


# ─── Perfil propio ────────────────────────────────────────────────────────────
@router.get(
    "/me",
    response_model=UsuarioResponse,
    summary="Obtener perfil propio",
)
async def obtener_perfil(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = AuthService(db)
    return await service.obtener_perfil(current_user["auth_user_id"])


# ─── Resolver DNI → email ─────────────────────────────────────────────────────
@router.get(
    "/resolver-dni",
    summary="Resolver DNI a email",
    description="Permite al frontend buscar el email asociado a un DNI para el login."
)
async def resolver_dni(
    dni: str,
    db: AsyncSession = Depends(get_db_session)
):
    if not dni.isdigit() or len(dni) != 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="DNI inválido. Debe contener 8 dígitos."
        )

    result = await db.execute(
        text("SELECT email FROM usuarios WHERE dni = :dni AND estado = 'activo'"),
        {"dni": dni}
    )
    row = result.fetchone()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró ninguna cuenta activa con ese DNI."
        )

    return {"email": row.email}


# ─── Schemas para recuperación de contraseña ─────────────────────────────────
class RecuperarPasswordRequest(BaseModel):
    email: EmailStr


class NuevaPasswordRequest(BaseModel):
    access_token: str
    nueva_password: str


# ─── Solicitar recuperación ───────────────────────────────────────────────────
@router.post(
    "/recuperar-password",
    summary="Solicitar recuperación de contraseña",
    description=(
        "Envía un email con enlace de recuperación via Supabase Auth. "
        "Siempre responde 200 para no revelar si el email existe (seguridad)."
    )
)
async def recuperar_password(
    data: RecuperarPasswordRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Flujo seguro de recuperación:
    1. Verifica internamente si el email existe
    2. Si existe, envía el email via Supabase
    3. Siempre retorna 200 — nunca revela si el email está registrado

    El enlace redirige a: {FRONTEND_URL}/nueva-password#access_token=...&type=recovery
    Configura FRONTEND_URL en tu .env (default: http://localhost:5173)
    """
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    redirect_to  = f"{frontend_url}/nueva-password"

    try:
        # Verificar existencia (solo para logging interno)
        result = await db.execute(
            text("SELECT id FROM usuarios WHERE email = :email AND estado = 'activo'"),
            {"email": data.email}
        )
        existe = result.fetchone() is not None

        if existe:
            supabase_admin.auth.reset_password_for_email(
                data.email,
                options={"redirect_to": redirect_to}
            )
            logger.info(f"Email de recuperación enviado: {data.email}")
        else:
            logger.info(f"Recuperación solicitada para email no registrado: {data.email}")

    except Exception as exc:
        logger.error(f"Error en recuperar_password: {exc}")
        # No propagar — siempre 200

    return {
        "mensaje": "Si el correo está registrado, recibirás un enlace de recuperación en los próximos minutos."
    }


# ─── Establecer nueva contraseña ─────────────────────────────────────────────
@router.post(
    "/nueva-password",
    summary="Actualizar contraseña con token de recuperación",
    description=(
        "Recibe el access_token del enlace de email y actualiza la contraseña. "
        "El token viene del hash de la URL: /nueva-password#access_token=XXX&type=recovery"
    )
)
async def nueva_password(data: NuevaPasswordRequest):
    """
    Proceso:
    1. Verifica que el access_token sea válido con Supabase
    2. Valida fortaleza de la nueva contraseña
    3. Actualiza via Supabase Admin API
    """
    # Validaciones de fortaleza
    if len(data.nueva_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe tener al menos 8 caracteres."
        )
    if not re.search(r"[A-Za-z]", data.nueva_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos una letra."
        )
    if not re.search(r"\d", data.nueva_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña debe contener al menos un número."
        )

    try:
        # Verificar que el token es válido
        user_response = supabase_admin.auth.get_user(data.access_token)

        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo."
            )

        user_id = str(user_response.user.id)

        # Actualizar contraseña via admin
        supabase_admin.auth.admin.update_user_by_id(
            user_id,
            {"password": data.nueva_password}
        )

        logger.info(f"Contraseña actualizada para usuario: {user_id}")
        return {"mensaje": "Contraseña actualizada exitosamente. Ya puedes iniciar sesión."}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error actualizando contraseña: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El enlace de recuperación es inválido o ha expirado. Solicita uno nuevo desde /recuperar."
        )
