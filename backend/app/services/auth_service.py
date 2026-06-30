# =============================================================================
# app/services/auth_service.py
# Lógica de negocio para autenticación vinculada a Supabase Auth
# =============================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from fastapi import HTTPException, status
from loguru import logger
from typing import Optional, Dict, Any
from datetime import datetime
import uuid

from app.core.config import settings
from app.core.database import supabase_admin, supabase_anon
from app.schemas.auth import (
    RegistroRequest, LoginRequest, TokenResponse, UsuarioResponse
)


class AuthService:
    """
    Servicio de autenticación.
    Delega el manejo de credenciales a Supabase Auth y sincroniza
    los datos del perfil en nuestra tabla `usuarios`.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # REGISTRO
    # -------------------------------------------------------------------------
    async def registrar_usuario(self, data: RegistroRequest) -> TokenResponse:
        """
        Registra un nuevo usuario en Supabase Auth y crea su perfil en la BD.

        Flujo:
          1. Verificar que el DNI no esté registrado
          2. Crear usuario en Supabase Auth
          3. Insertar perfil en tabla usuarios
          4. Crear cuenta de ahorros inicial
          5. Retornar tokens de sesión
        """
        # 1. Verificar DNI único
        result = await self.db.execute(
            text("SELECT id FROM usuarios WHERE dni = :dni"),
            {"dni": data.dni}
        )
        if result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El DNI {data.dni} ya se encuentra registrado en el sistema."
            )

        # Verificar email único
        result = await self.db.execute(
            text("SELECT id FROM usuarios WHERE email = :email"),
            {"email": data.email}
        )
        if result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este correo electrónico ya está registrado."
            )

        auth_user_id = None
        try:
            # 2. Crear usuario en Supabase Auth
            auth_response = supabase_admin.auth.admin.create_user({
                "email": data.email,
                "password": data.password,
                "email_confirm": True,  # Auto-confirmar en desarrollo
                "user_metadata": {
                    "nombre_completo": data.nombre_completo,
                    "dni": data.dni
                }
            })

            if not auth_response or not auth_response.user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Error al crear usuario en el sistema de autenticación."
                )

            auth_user_id = auth_response.user.id

            # 3. Insertar perfil en tabla usuarios
            usuario_id = str(uuid.uuid4())
            await self.db.execute(
                text("""
                    INSERT INTO usuarios (id, auth_user_id, email, nombre_completo, dni, telefono, rol, estado)
                    VALUES (:id, :auth_user_id, :email, :nombre_completo, :dni, :telefono, 'cliente', 'activo')
                """),
                {
                    "id": usuario_id,
                    "auth_user_id": auth_user_id,
                    "email": data.email,
                    "nombre_completo": data.nombre_completo,
                    "dni": data.dni,
                    "telefono": data.telefono
                }
            )

            # 4. Crear cuenta de ahorros inicial automáticamente
            numero_cuenta = await self.db.scalar(
                text("SELECT fn_generar_numero_cuenta()")
            )
            await self.db.execute(
                text("""
                    INSERT INTO cuentas_ahorros
                        (usuario_id, numero_cuenta, saldo, tipo_cuenta, moneda, tasa_interes_anual)
                    VALUES (:usuario_id, :numero_cuenta, 0.00, 'ahorros_libre', 'PEN', 2.50)
                """),
                {"usuario_id": usuario_id, "numero_cuenta": numero_cuenta}
            )

            await self.db.commit()

            # 5. Iniciar sesión automáticamente y retornar tokens
            return await self._iniciar_sesion_supabase(data.email, data.password)

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            # Rollback en Supabase Auth si hubo error en BD
            if auth_user_id:
                try:
                    supabase_admin.auth.admin.delete_user(str(auth_user_id))
                except Exception:
                    pass
            logger.error(f"Error en registro de usuario: {exc}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error interno al registrar el usuario. Intente nuevamente."
            )

    # -------------------------------------------------------------------------
    # LOGIN
    # -------------------------------------------------------------------------
    async def iniciar_sesion(self, data: LoginRequest) -> TokenResponse:
        """
        Autentica un usuario con email y contraseña via Supabase Auth.
        Verifica que el usuario esté activo en nuestra BD.
        """
        # Verificar que el usuario existe y está activo en nuestra BD
        result = await self.db.execute(
            text("SELECT id, estado, rol FROM usuarios WHERE email = :email"),
            {"email": data.email}
        )
        usuario_db = result.fetchone()

        if not usuario_db:
            # No revelar si el usuario existe o no (seguridad)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas."
            )

        if usuario_db.estado == "bloqueado":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Su cuenta se encuentra bloqueada. Contacte al soporte: 0800-00000."
            )

        if usuario_db.estado == "inactivo":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Su cuenta está inactiva. Contacte al soporte."
            )

        return await self._iniciar_sesion_supabase(data.email, data.password)

    async def _iniciar_sesion_supabase(self, email: str, password: str) -> TokenResponse:
        """Helper interno: autentica en Supabase y construye la respuesta."""
        try:
            auth_response = supabase_anon.auth.sign_in_with_password({
                "email": email,
                "password": password
            })

            if not auth_response or not auth_response.session:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Credenciales incorrectas."
                )

            session = auth_response.session
            user = auth_response.user

            # Obtener perfil completo desde nuestra tabla
            result = await self.db.execute(
                text("""
                    SELECT id, email, nombre_completo, dni, telefono, rol, estado, fecha_registro
                    FROM usuarios WHERE auth_user_id = :auth_id
                """),
                {"auth_id": str(user.id)}
            )
            perfil = result.fetchone()

            if not perfil:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Perfil de usuario no encontrado."
                )

            usuario_response = UsuarioResponse(
                id=perfil.id,
                email=perfil.email,
                nombre_completo=perfil.nombre_completo,
                dni=perfil.dni,
                telefono=perfil.telefono,
                rol=perfil.rol,
                estado=perfil.estado,
                fecha_registro=perfil.fecha_registro
            )

            return TokenResponse(
                access_token=session.access_token,
                refresh_token=session.refresh_token,
                token_type="bearer",
                expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
                usuario=usuario_response
            )

        except HTTPException:
            raise
        except Exception as exc:
            logger.error(f"Error en autenticación Supabase: {exc}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales incorrectas. Verifique su email y contraseña."
            )

    # -------------------------------------------------------------------------
    # CERRAR SESIÓN
    # -------------------------------------------------------------------------
    async def cerrar_sesion(self, token: str) -> Dict[str, str]:
        """Invalida la sesión actual en Supabase Auth."""
        try:
            supabase_admin.auth.admin.sign_out(token)
            return {"mensaje": "Sesión cerrada exitosamente."}
        except Exception as exc:
            logger.warning(f"Error cerrando sesión (puede ya estar expirada): {exc}")
            return {"mensaje": "Sesión cerrada."}

    # -------------------------------------------------------------------------
    # OBTENER PERFIL ACTUAL
    # -------------------------------------------------------------------------
    async def obtener_perfil(self, auth_user_id: str) -> UsuarioResponse:
        """Retorna el perfil del usuario autenticado."""
        result = await self.db.execute(
            text("""
                SELECT id, email, nombre_completo, dni, telefono, rol, estado, fecha_registro
                FROM usuarios WHERE auth_user_id = :auth_id
            """),
            {"auth_id": auth_user_id}
        )
        perfil = result.fetchone()

        if not perfil:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Perfil de usuario no encontrado."
            )

        return UsuarioResponse(
            id=perfil.id,
            email=perfil.email,
            nombre_completo=perfil.nombre_completo,
            dni=perfil.dni,
            telefono=perfil.telefono,
            rol=perfil.rol,
            estado=perfil.estado,
            fecha_registro=perfil.fecha_registro
        )