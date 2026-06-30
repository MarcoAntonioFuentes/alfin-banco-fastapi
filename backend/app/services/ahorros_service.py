# =============================================================================
# app/services/ahorros_service.py
# Lógica de negocio para Dashboard y Módulo de Ahorros
# Manejo de saldos, movimientos, depósitos y transferencias
# =============================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fastapi import HTTPException, status
from loguru import logger
from typing import List, Optional
from decimal import Decimal
from datetime import date, timedelta
import uuid

from app.core.config import settings
from app.schemas.schemas import (
    DashboardResponse, CuentaResponse, MovimientoResponse,
    DepositoRequest, RetiroRequest, TransferenciaRequest,
    TransaccionExitosaResponse, ProximaCuotaInfo, UsuarioResponse
)


class AhorrosService:
    """
    Servicio de ahorros y transacciones bancarias.
    Todas las operaciones monetarias usan la función SQL fn_procesar_transaccion
    para garantizar atomicidad y consistencia.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # HELPERS INTERNOS
    # -------------------------------------------------------------------------

    async def _obtener_usuario_por_auth_id(self, auth_user_id: str) -> dict:
        """Obtiene el registro de usuario desde auth_user_id de Supabase."""
        result = await self.db.execute(
            text("""
                SELECT id, email, nombre_completo, dni, telefono, rol, estado, fecha_registro
                FROM usuarios WHERE auth_user_id = :auth_id AND estado = 'activo'
            """),
            {"auth_id": auth_user_id}
        )
        usuario = result.fetchone()
        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Usuario no encontrado o inactivo."
            )
        return usuario

    async def _verificar_propiedad_cuenta(
        self, cuenta_id: str, usuario_id: str
    ) -> dict:
        """Verifica que la cuenta pertenezca al usuario y esté activa."""
        result = await self.db.execute(
            text("""
                SELECT id, numero_cuenta, saldo, tipo_cuenta, moneda, estado
                FROM cuentas_ahorros
                WHERE id = :cuenta_id AND usuario_id = :usuario_id AND estado = 'activa'
            """),
            {"cuenta_id": cuenta_id, "usuario_id": usuario_id}
        )
        cuenta = result.fetchone()
        if not cuenta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Cuenta no encontrada, inactiva o no pertenece al usuario."
            )
        return cuenta

    # -------------------------------------------------------------------------
    # DASHBOARD
    # -------------------------------------------------------------------------

    async def obtener_dashboard(self, auth_user_id: str) -> DashboardResponse:
        """
        Construye los datos completos del dashboard del cliente:
        - Perfil del usuario
        - Todas sus cuentas activas y saldos
        - Últimos 5 movimientos (de todas las cuentas)
        - Próxima cuota a pagar
        """
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        usuario_id = str(usuario.id)

        # Cuentas activas
        cuentas_raw = await self.db.execute(
            text("""
                SELECT id, numero_cuenta, tipo_cuenta, saldo, moneda, estado,
                       tasa_interes_anual, fecha_creacion
                FROM cuentas_ahorros
                WHERE usuario_id = :uid AND estado = 'activa'
                ORDER BY fecha_creacion ASC
            """),
            {"uid": usuario_id}
        )
        cuentas_rows = cuentas_raw.fetchall()

        cuentas = [
            CuentaResponse(
                id=r.id, numero_cuenta=r.numero_cuenta, tipo_cuenta=r.tipo_cuenta,
                saldo=r.saldo, moneda=r.moneda, estado=r.estado,
                tasa_interes_anual=r.tasa_interes_anual, fecha_creacion=r.fecha_creacion
            ) for r in cuentas_rows
        ]

        # Saldos totales por moneda
        saldo_pen = sum(c.saldo for c in cuentas if c.moneda == "PEN")
        saldo_usd = sum(c.saldo for c in cuentas if c.moneda == "USD")

        # IDs de las cuentas del usuario para consultar movimientos
        cuenta_ids = [str(c.id) for c in cuentas]
        ultimos_movimientos: List[MovimientoResponse] = []

        if cuenta_ids:
            # asyncpg no soporta ANY(:param::uuid[]) — usar placeholders dinámicos
            placeholders = ", ".join(f":id_{i}" for i in range(len(cuenta_ids)))
            params = {f"id_{i}": uid for i, uid in enumerate(cuenta_ids)}
            mov_raw = await self.db.execute(
                text(f"""
                    SELECT id, tipo, monto, saldo_anterior, saldo_posterior,
                           descripcion, referencia, canal, fecha
                    FROM movimientos
                    WHERE cuenta_id IN ({placeholders})
                    ORDER BY fecha DESC
                    LIMIT 10
                """),
                params
            )
            ultimos_movimientos = [
                MovimientoResponse(
                    id=r.id, tipo=r.tipo, monto=r.monto,
                    saldo_anterior=r.saldo_anterior, saldo_posterior=r.saldo_posterior,
                    descripcion=r.descripcion, referencia=r.referencia,
                    canal=r.canal, fecha=r.fecha
                ) for r in mov_raw.fetchall()
            ]

        # Créditos activos
        creditos_raw = await self.db.execute(
            text("""
                SELECT COUNT(*) as total FROM creditos
                WHERE usuario_id = :uid AND estado NOT IN ('rechazado', 'cancelado', 'pagado')
            """),
            {"uid": usuario_id}
        )
        creditos_activos = creditos_raw.scalar() or 0

        # Próxima cuota a vencer
        proxima_cuota = await self._obtener_proxima_cuota(usuario_id)

        return DashboardResponse(
            usuario=UsuarioResponse(
                id=usuario.id,
                email=usuario.email,
                nombre_completo=usuario.nombre_completo,
                dni=usuario.dni,
                telefono=usuario.telefono,
                rol=usuario.rol,
                estado=usuario.estado,
                fecha_registro=usuario.fecha_registro
            ),
            cuentas=cuentas,
            saldo_total_pen=saldo_pen,
            saldo_total_usd=saldo_usd,
            ultimos_movimientos=ultimos_movimientos,
            creditos_activos=creditos_activos,
            proxima_cuota=proxima_cuota
        )

    async def _obtener_proxima_cuota(self, usuario_id: str) -> Optional[ProximaCuotaInfo]:
        """Obtiene la próxima cuota pendiente más cercana a vencer."""
        result = await self.db.execute(
            text("""
                SELECT cp.id, cp.numero_cuota, cp.monto_cuota, cp.fecha_vencimiento,
                       c.id as credito_id, c.numero_credito
                FROM cronograma_pagos cp
                JOIN creditos c ON c.id = cp.credito_id
                WHERE c.usuario_id = :uid
                  AND cp.estado = 'pendiente'
                  AND c.estado = 'desembolsado'
                ORDER BY cp.fecha_vencimiento ASC
                LIMIT 1
            """),
            {"uid": usuario_id}
        )
        cuota = result.fetchone()
        if not cuota:
            return None

        dias_para_vencer = (cuota.fecha_vencimiento - date.today()).days

        return ProximaCuotaInfo(
            credito_id=cuota.credito_id,
            numero_credito=cuota.numero_credito,
            numero_cuota=cuota.numero_cuota,
            monto_cuota=cuota.monto_cuota,
            fecha_vencimiento=cuota.fecha_vencimiento,
            dias_para_vencer=dias_para_vencer
        )

    # -------------------------------------------------------------------------
    # CONSULTAS DE CUENTA
    # -------------------------------------------------------------------------

    async def obtener_cuentas(self, auth_user_id: str) -> List[CuentaResponse]:
        """Lista todas las cuentas activas del usuario."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)

        result = await self.db.execute(
            text("""
                SELECT id, numero_cuenta, tipo_cuenta, saldo, moneda, estado,
                       tasa_interes_anual, fecha_creacion
                FROM cuentas_ahorros
                WHERE usuario_id = :uid AND estado != 'cerrada'
                ORDER BY fecha_creacion ASC
            """),
            {"uid": str(usuario.id)}
        )
        return [
            CuentaResponse(
                id=r.id, numero_cuenta=r.numero_cuenta, tipo_cuenta=r.tipo_cuenta,
                saldo=r.saldo, moneda=r.moneda, estado=r.estado,
                tasa_interes_anual=r.tasa_interes_anual, fecha_creacion=r.fecha_creacion
            ) for r in result.fetchall()
        ]

    async def obtener_saldo(self, auth_user_id: str, cuenta_id: str) -> dict:
        """Retorna el saldo actual de una cuenta específica."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        cuenta = await self._verificar_propiedad_cuenta(cuenta_id, str(usuario.id))

        return {
            "cuenta_id": cuenta.id,
            "numero_cuenta": cuenta.numero_cuenta,
            "saldo": float(cuenta.saldo),
            "moneda": cuenta.moneda,
            "tipo_cuenta": cuenta.tipo_cuenta,
            "estado": cuenta.estado
        }

    async def obtener_movimientos(
        self,
        auth_user_id: str,
        cuenta_id: str,
        limite: int = 20,
        offset: int = 0,
        tipo_filtro: Optional[str] = None
    ) -> dict:
        """
        Retorna el historial de movimientos de una cuenta con paginación.
        Opcional: filtrar por tipo de movimiento.
        """
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        await self._verificar_propiedad_cuenta(cuenta_id, str(usuario.id))

        # Construir filtro de tipo dinámicamente (seguro contra SQLi por validación Pydantic)
        tipo_clause = "AND tipo = :tipo" if tipo_filtro else ""

        params: dict = {"cuenta_id": cuenta_id, "limite": limite, "offset": offset}
        if tipo_filtro:
            params["tipo"] = tipo_filtro

        result = await self.db.execute(
            text(f"""
                SELECT id, tipo, monto, saldo_anterior, saldo_posterior,
                       descripcion, referencia, canal, fecha
                FROM movimientos
                WHERE cuenta_id = :cuenta_id {tipo_clause}
                ORDER BY fecha DESC
                LIMIT :limite OFFSET :offset
            """),
            params
        )

        # Total para paginación
        count_result = await self.db.execute(
            text(f"""
                SELECT COUNT(*) FROM movimientos
                WHERE cuenta_id = :cuenta_id {tipo_clause}
            """),
            {k: v for k, v in params.items() if k not in ("limite", "offset")}
        )
        total = count_result.scalar() or 0

        movimientos = [
            MovimientoResponse(
                id=r.id, tipo=r.tipo, monto=r.monto,
                saldo_anterior=r.saldo_anterior, saldo_posterior=r.saldo_posterior,
                descripcion=r.descripcion, referencia=r.referencia,
                canal=r.canal, fecha=r.fecha
            ) for r in result.fetchall()
        ]

        return {
            "movimientos": movimientos,
            "total": total,
            "pagina": (offset // limite) + 1,
            "por_pagina": limite,
            "total_paginas": (total + limite - 1) // limite
        }

    # -------------------------------------------------------------------------
    # TRANSACCIONES
    # -------------------------------------------------------------------------

    async def realizar_deposito(
        self, auth_user_id: str, data: DepositoRequest, ip_origen: Optional[str] = None
    ) -> TransaccionExitosaResponse:
        """
        Realiza un depósito en una cuenta del usuario.
        Usa la función atómica SQL fn_procesar_transaccion.
        """
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        await self._verificar_propiedad_cuenta(str(data.cuenta_id), str(usuario.id))

        try:
            result = await self.db.execute(
                text("""
                    SELECT fn_procesar_transaccion(
                        :cuenta_id, 'deposito', :monto, :descripcion, 'web', :ip
                    ) AS movimiento_id
                """),
                {
                    "cuenta_id": str(data.cuenta_id),
                    "monto": float(data.monto),
                    "descripcion": data.descripcion or "Depósito",
                    "ip": ip_origen
                }
            )
            movimiento_id = result.scalar()
            await self.db.commit()

            return await self._construir_respuesta_transaccion(
                movimiento_id, str(data.cuenta_id), "deposito"
            )

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            msg = str(exc)
            if "SALDO_INSUFICIENTE" in msg:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Saldo insuficiente para la operación.")
            if "CUENTA_NO_ENCONTRADA" in msg:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                    detail="Cuenta no encontrada o inactiva.")
            logger.error(f"Error en depósito: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al procesar el depósito.")

    async def realizar_retiro(
        self, auth_user_id: str, data: RetiroRequest, ip_origen: Optional[str] = None
    ) -> TransaccionExitosaResponse:
        """Realiza un retiro de una cuenta del usuario con validación de límites."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        cuenta = await self._verificar_propiedad_cuenta(str(data.cuenta_id), str(usuario.id))

        # Validar límite diario de retiro
        retiros_hoy = await self.db.execute(
            text("""
                SELECT COALESCE(SUM(monto), 0) as total_hoy
                FROM movimientos
                WHERE cuenta_id = :cid
                  AND tipo = 'retiro'
                  AND DATE(fecha AT TIME ZONE 'America/Lima') = CURRENT_DATE
            """),
            {"cid": str(data.cuenta_id)}
        )
        total_retiros_hoy = Decimal(str(retiros_hoy.scalar() or 0))

        if total_retiros_hoy + data.monto > Decimal(str(settings.LIMITE_RETIRO_DIARIO)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Límite de retiro diario excedido. "
                       f"Disponible: S/ {settings.LIMITE_RETIRO_DIARIO - float(total_retiros_hoy):.2f}"
            )

        try:
            result = await self.db.execute(
                text("""
                    SELECT fn_procesar_transaccion(
                        :cuenta_id, 'retiro', :monto, :descripcion, 'web', :ip
                    ) AS movimiento_id
                """),
                {
                    "cuenta_id": str(data.cuenta_id),
                    "monto": float(data.monto),
                    "descripcion": data.descripcion or "Retiro",
                    "ip": ip_origen
                }
            )
            movimiento_id = result.scalar()
            await self.db.commit()

            return await self._construir_respuesta_transaccion(
                movimiento_id, str(data.cuenta_id), "retiro"
            )

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            msg = str(exc)
            if "SALDO_INSUFICIENTE" in msg:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Saldo insuficiente. Saldo disponible: S/ {float(cuenta.saldo):.2f}")
            logger.error(f"Error en retiro: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al procesar el retiro.")

    async def realizar_transferencia(
        self, auth_user_id: str, data: TransferenciaRequest, ip_origen: Optional[str] = None
    ) -> TransaccionExitosaResponse:
        """
        Transferencia entre cuentas (intra-banco).
        La función SQL garantiza atomicidad: si falla cualquier parte, hace rollback total.
        """
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)

        # Verificar cuenta origen
        await self._verificar_propiedad_cuenta(str(data.cuenta_origen_id), str(usuario.id))

        # Buscar cuenta destino por número
        dest_result = await self.db.execute(
            text("""
                SELECT id, numero_cuenta, estado
                FROM cuentas_ahorros
                WHERE numero_cuenta = :numero AND estado = 'activa'
            """),
            {"numero": data.cuenta_destino_numero}
        )
        cuenta_destino = dest_result.fetchone()

        if not cuenta_destino:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cuenta destino {data.cuenta_destino_numero} no encontrada o inactiva."
            )

        # Evitar transferencia a sí mismo
        if str(cuenta_destino.id) == str(data.cuenta_origen_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puede transferir a la misma cuenta de origen."
            )

        # Validar límite diario de transferencia
        transferencias_hoy = await self.db.execute(
            text("""
                SELECT COALESCE(SUM(monto), 0)
                FROM movimientos
                WHERE cuenta_id = :cid
                  AND tipo = 'transferencia_salida'
                  AND DATE(fecha AT TIME ZONE 'America/Lima') = CURRENT_DATE
            """),
            {"cid": str(data.cuenta_origen_id)}
        )
        total_hoy = Decimal(str(transferencias_hoy.scalar() or 0))

        if total_hoy + data.monto > Decimal(str(settings.LIMITE_TRANSFERENCIA_DIARIA)):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Límite de transferencia diaria excedido. "
                       f"Disponible: S/ {settings.LIMITE_TRANSFERENCIA_DIARIA - float(total_hoy):.2f}"
            )

        try:
            descripcion = data.descripcion or f"Transferencia a {data.cuenta_destino_numero}"
            result = await self.db.execute(
                text("""
                    SELECT fn_procesar_transaccion(
                        :cuenta_id, 'transferencia_salida', :monto,
                        :descripcion, 'web', :ip, :cuenta_destino_id
                    ) AS movimiento_id
                """),
                {
                    "cuenta_id": str(data.cuenta_origen_id),
                    "monto": float(data.monto),
                    "descripcion": descripcion,
                    "ip": ip_origen,
                    "cuenta_destino_id": str(cuenta_destino.id)
                }
            )
            movimiento_id = result.scalar()
            await self.db.commit()

            return await self._construir_respuesta_transaccion(
                movimiento_id, str(data.cuenta_origen_id), "transferencia_salida"
            )

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            msg = str(exc)
            if "SALDO_INSUFICIENTE" in msg:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                    detail="Saldo insuficiente para realizar la transferencia.")
            logger.error(f"Error en transferencia: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al procesar la transferencia.")

    async def _construir_respuesta_transaccion(
        self, movimiento_id: str, cuenta_id: str, tipo: str
    ) -> TransaccionExitosaResponse:
        """Construye la respuesta de una transacción exitosa."""
        result = await self.db.execute(
            text("""
                SELECT m.id, m.tipo, m.monto, m.saldo_posterior, m.referencia, m.fecha,
                       ca.saldo as saldo_actual
                FROM movimientos m
                JOIN cuentas_ahorros ca ON ca.id = m.cuenta_id
                WHERE m.id = :mid
            """),
            {"mid": str(movimiento_id)}
        )
        mov = result.fetchone()

        from datetime import datetime
        return TransaccionExitosaResponse(
            movimiento_id=mov.id,
            referencia=mov.referencia,
            tipo=mov.tipo,
            monto=mov.monto,
            saldo_nuevo=mov.saldo_posterior,
            fecha=mov.fecha
        )
