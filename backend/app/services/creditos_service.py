# =============================================================================
# app/services/creditos_service.py
# Core Bancario: Ciclo de vida de créditos, flujo de aprobación y reportes
# Incluye cálculo de amortización francesa (cuota fija)
# =============================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fastapi import HTTPException, status
from loguru import logger
from typing import List, Optional, Dict, Any
from decimal import Decimal, ROUND_HALF_UP
from datetime import date, datetime, timedelta
import math
import uuid

from app.schemas.schemas import (
    SolicitudCreditoRequest, CreditoResponse, CuotaResponse,
    AsignarAnalistaRequest, EvaluacionCreditoRequest, DecisionComiteRequest,
    DesembolsoRequest, ResumenCarteraResponse, CreditoCarteraItem,
    PaginatedResponse
)

# Tasas de interés por defecto según producto (TEA en %)
TASAS_DEFAULT = {
    "Capital de trabajo": 18.0,
    "Vehicular": 14.5,
    "Hipotecario": 9.5,
    "Consumo personal": 22.0,
    "Educativo": 12.0,
}
TASA_DEFAULT_GENERAL = 20.0


def calcular_cuota_mensual(monto: float, tea: float, plazo_meses: int) -> float:
    """
    Calcula la cuota mensual bajo el sistema francés (cuota fija).
    Convierte TEA (Tasa Efectiva Anual) a TEM (Tasa Efectiva Mensual).

    Fórmula: C = PV * [TEM * (1+TEM)^n] / [(1+TEM)^n - 1]
    """
    if plazo_meses <= 0 or monto <= 0:
        return 0.0
    tem = (1 + tea / 100) ** (1 / 12) - 1
    if tem == 0:
        return monto / plazo_meses
    factor = tem * (1 + tem) ** plazo_meses
    divisor = (1 + tem) ** plazo_meses - 1
    return monto * factor / divisor


def generar_cronograma(
    monto: float, tea: float, plazo_meses: int, fecha_desembolso: date
) -> List[Dict]:
    """
    Genera el cronograma de amortización completo (tabla de cuotas).
    Sistema francés: cuota fija, amortización de capital creciente.
    """
    tem = (1 + tea / 100) ** (1 / 12) - 1
    cuota_mensual = calcular_cuota_mensual(monto, tea, plazo_meses)
    saldo_capital = monto
    cronograma = []

    for n in range(1, plazo_meses + 1):
        interes_periodo = saldo_capital * tem
        capital_periodo = cuota_mensual - interes_periodo

        # Ajuste en última cuota para eliminar diferencias por redondeo
        if n == plazo_meses:
            capital_periodo = saldo_capital
            cuota_real = capital_periodo + interes_periodo
        else:
            cuota_real = cuota_mensual

        saldo_capital -= capital_periodo

        # Fecha de vencimiento: mismo día del mes siguiente
        mes_venc = fecha_desembolso.month + n
        anio_venc = fecha_desembolso.year + (mes_venc - 1) // 12
        mes_venc = ((mes_venc - 1) % 12) + 1
        try:
            fecha_venc = date(anio_venc, mes_venc, fecha_desembolso.day)
        except ValueError:
            # Fin de mes (ej: 31 de febrero → 28/29)
            fecha_venc = date(anio_venc, mes_venc, 1) + timedelta(days=-1)

        cronograma.append({
            "numero_cuota": n,
            "monto_cuota": round(cuota_real, 2),
            "monto_capital": round(capital_periodo, 2),
            "monto_interes": round(interes_periodo, 2),
            "saldo_capital": round(max(saldo_capital, 0), 2),
            "fecha_vencimiento": fecha_venc,
            "estado": "pendiente"
        })

    return cronograma


class CreditosService:
    """
    Servicio del Core Bancario.
    Gestiona el ciclo completo de solicitudes de crédito:
    enviado → en_evaluacion → en_comite → aprobado/rechazado → desembolsado → pagado
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # -------------------------------------------------------------------------
    # HELPERS INTERNOS
    # -------------------------------------------------------------------------

    async def _obtener_usuario_por_auth_id(self, auth_user_id: str) -> Any:
        result = await self.db.execute(
            text("SELECT id, rol, estado, nombre_completo FROM usuarios WHERE auth_user_id = :aid"),
            {"aid": auth_user_id}
        )
        usuario = result.fetchone()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Usuario no encontrado.")
        if usuario.estado != "activo":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Usuario inactivo o bloqueado.")
        return usuario

    async def _requerir_rol(self, auth_user_id: str, roles: List[str]) -> Any:
        """Valida que el usuario tenga uno de los roles permitidos."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Se requiere rol: {', '.join(roles)}."
            )
        return usuario

    async def _obtener_credito_o_404(self, credito_id: str) -> Any:
        result = await self.db.execute(
            text("SELECT * FROM creditos WHERE id = :id"),
            {"id": credito_id}
        )
        credito = result.fetchone()
        if not credito:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"Crédito {credito_id} no encontrado.")
        return credito

    def _row_to_credito_response(self, r: Any) -> CreditoResponse:
        return CreditoResponse(
            id=r.id, numero_credito=r.numero_credito,
            monto_solicitado=r.monto_solicitado, monto_aprobado=r.monto_aprobado,
            moneda=r.moneda, estado=r.estado, tasa_interes=r.tasa_interes,
            tasa_tipo=r.tasa_tipo, plazo_meses=r.plazo_meses, proposito=r.proposito,
            observaciones=r.observaciones, fecha_solicitud=r.fecha_solicitud,
            fecha_decision=r.fecha_decision, fecha_desembolso=r.fecha_desembolso
        )

    # =========================================================================
    # HOME BANKING - Endpoints del cliente
    # =========================================================================

    async def solicitar_credito(
        self, auth_user_id: str, data: SolicitudCreditoRequest
    ) -> CreditoResponse:
        """
        El cliente solicita un crédito desde el home banking.
        Se asigna tasa tentativa según propósito y entra en estado 'enviado'.
        """
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)
        usuario_id = str(usuario.id)

        # Verificar que la cuenta de desembolso pertenece al cliente
        cuenta_result = await self.db.execute(
            text("""
                SELECT id FROM cuentas_ahorros
                WHERE id = :cid AND usuario_id = :uid AND estado = 'activa'
            """),
            {"cid": str(data.cuenta_desembolso_id), "uid": usuario_id}
        )
        if not cuenta_result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La cuenta de desembolso no existe o no le pertenece."
            )

        # Verificar que no tenga solicitudes pendientes en proceso
        pendientes = await self.db.execute(
            text("""
                SELECT COUNT(*) FROM creditos
                WHERE usuario_id = :uid AND estado IN ('enviado', 'en_evaluacion', 'en_comite')
            """),
            {"uid": usuario_id}
        )
        if (pendientes.scalar() or 0) >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya tiene solicitudes de crédito en proceso. Máximo 2 simultáneas."
            )

        # Tasa tentativa según propósito
        tasa_tentativa = TASAS_DEFAULT.get(data.proposito, TASA_DEFAULT_GENERAL)

        try:
            result = await self.db.execute(
                text("""
                    INSERT INTO creditos
                        (usuario_id, cuenta_desembolso_id, monto_solicitado, moneda,
                         plazo_meses, proposito, tasa_interes, tasa_tipo, estado)
                    VALUES
                        (:uid, :cuenta_id, :monto, :moneda,
                         :plazo, :proposito, :tasa, 'TEA', 'enviado')
                    RETURNING *
                """),
                {
                    "uid": usuario_id,
                    "cuenta_id": str(data.cuenta_desembolso_id),
                    "monto": float(data.monto_solicitado),
                    "moneda": data.moneda,
                    "plazo": data.plazo_meses,
                    "proposito": data.proposito,
                    "tasa": tasa_tentativa
                }
            )
            credito = result.fetchone()
            await self.db.commit()

            logger.info(f"Nueva solicitud de crédito: {credito.numero_credito} - "
                        f"Cliente: {usuario.nombre_completo} - Monto: {data.monto_solicitado}")

            return self._row_to_credito_response(credito)

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error al crear solicitud de crédito: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al registrar la solicitud de crédito.")

    async def obtener_mis_creditos(
        self, auth_user_id: str
    ) -> List[CreditoResponse]:
        """Lista todos los créditos del cliente autenticado."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)

        result = await self.db.execute(
            text("""
                SELECT * FROM creditos
                WHERE usuario_id = :uid
                ORDER BY fecha_solicitud DESC
            """),
            {"uid": str(usuario.id)}
        )
        return [self._row_to_credito_response(r) for r in result.fetchall()]

    async def obtener_cronograma(
        self, auth_user_id: str, credito_id: str
    ) -> List[CuotaResponse]:
        """Retorna el cronograma de pagos de un crédito del cliente."""
        usuario = await self._obtener_usuario_por_auth_id(auth_user_id)

        # Verificar que el crédito pertenece al cliente
        credito = await self.db.execute(
            text("SELECT id FROM creditos WHERE id = :id AND usuario_id = :uid"),
            {"id": credito_id, "uid": str(usuario.id)}
        )
        if not credito.fetchone():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Crédito no encontrado.")

        result = await self.db.execute(
            text("""
                SELECT id, numero_cuota, monto_cuota, monto_capital, monto_interes,
                       saldo_capital, fecha_vencimiento, fecha_pago, monto_pagado, estado
                FROM cronograma_pagos
                WHERE credito_id = :cid
                ORDER BY numero_cuota ASC
            """),
            {"cid": credito_id}
        )
        return [
            CuotaResponse(
                id=r.id, numero_cuota=r.numero_cuota, monto_cuota=r.monto_cuota,
                monto_capital=r.monto_capital, monto_interes=r.monto_interes,
                saldo_capital=r.saldo_capital, fecha_vencimiento=r.fecha_vencimiento,
                fecha_pago=r.fecha_pago, monto_pagado=r.monto_pagado, estado=r.estado
            ) for r in result.fetchall()
        ]

    # =========================================================================
    # CORE BANCARIO - Flujo de Aprobación (Analista)
    # =========================================================================

    async def obtener_bandeja_solicitudes(
        self,
        auth_user_id: str,
        estado: Optional[str] = None,
        pagina: int = 1,
        por_pagina: int = 20
    ) -> PaginatedResponse:
        """
        Bandeja de trabajo para analistas y comité.
        Analistas ven: enviado, en_evaluacion
        Comité ve: en_comite
        Admin ve: todo
        """
        usuario = await self._requerir_rol(
            auth_user_id, ["analista", "comite", "admin"]
        )

        # Filtros según rol
        if usuario.rol == "analista" and not estado:
            estados_filtro = ("enviado", "en_evaluacion")
        elif usuario.rol == "comite" and not estado:
            estados_filtro = ("en_comite",)
        elif estado:
            estados_filtro = (estado,)
        else:
            estados_filtro = None

        where_clause = ""
        params: dict = {"limit": por_pagina, "offset": (pagina - 1) * por_pagina}
        filter_params: dict = {}

        if estados_filtro:
            # asyncpg no soporta ANY(:param) con listas — usar IN con placeholders dinamicos
            placeholders = ", ".join(f":estado_{i}" for i in range(len(estados_filtro)))
            where_clause = f"WHERE c.estado IN ({placeholders})"
            filter_params = {f"estado_{i}": e for i, e in enumerate(estados_filtro)}
            params.update(filter_params)

        result = await self.db.execute(
            text(f"""
                SELECT
                    c.id, c.numero_credito, c.monto_solicitado, c.monto_aprobado,
                    c.moneda, c.estado, c.tasa_interes, c.tasa_tipo, c.plazo_meses,
                    c.proposito, c.score_crediticio, c.fecha_solicitud, c.fecha_evaluacion,
                    c.fecha_decision, c.fecha_desembolso, c.observaciones,
                    u.nombre_completo as cliente_nombre, u.dni as cliente_dni,
                    an.nombre_completo as analista_nombre
                FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                LEFT JOIN usuarios an ON an.id = c.analista_id
                {where_clause}
                ORDER BY c.fecha_solicitud ASC
                LIMIT :limit OFFSET :offset
            """),
            params
        )

        count_result = await self.db.execute(
            text(f"""
                SELECT COUNT(*) FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                {where_clause}
            """),
            filter_params
        )
        total = count_result.scalar() or 0

        items = []
        for r in result.fetchall():
            items.append({
                "id": str(r.id),
                "numero_credito": r.numero_credito,
                "cliente": r.cliente_nombre,
                "dni": r.cliente_dni,
                "monto_solicitado": float(r.monto_solicitado),
                "monto_aprobado": float(r.monto_aprobado) if r.monto_aprobado else None,
                "moneda": r.moneda,
                "estado": r.estado,
                "tasa_interes": float(r.tasa_interes),
                "plazo_meses": r.plazo_meses,
                "proposito": r.proposito,
                "score_crediticio": r.score_crediticio,
                "analista": r.analista_nombre,
                "fecha_solicitud": r.fecha_solicitud.isoformat(),
                "observaciones": r.observaciones
            })

        return PaginatedResponse(
            items=items,
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
            total_paginas=math.ceil(total / por_pagina)
        )

    async def asignar_analista(
        self, auth_user_id: str, credito_id: str, data: AsignarAnalistaRequest
    ) -> CreditoResponse:
        """
        Admin o supervisor asigna un analista a una solicitud.
        Cambia estado a 'en_evaluacion'.
        """
        await self._requerir_rol(auth_user_id, ["admin", "analista"])
        credito = await self._obtener_credito_o_404(credito_id)

        if credito.estado not in ("enviado", "en_evaluacion"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No se puede asignar analista a un crédito en estado '{credito.estado}'."
            )

        # Verificar que el analista asignado exista y tenga el rol correcto
        analista_result = await self.db.execute(
            text("SELECT id, nombre_completo, rol FROM usuarios WHERE id = :id AND rol = 'analista'"),
            {"id": str(data.analista_id)}
        )
        if not analista_result.fetchone():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Analista no encontrado o usuario no tiene rol de analista."
            )

        try:
            result = await self.db.execute(
                text("""
                    UPDATE creditos
                    SET estado = 'en_evaluacion',
                        analista_id = :analista_id,
                        observaciones = :obs,
                        fecha_evaluacion = NOW()
                    WHERE id = :id
                    RETURNING *
                """),
                {
                    "id": credito_id,
                    "analista_id": str(data.analista_id),
                    "obs": data.observaciones
                }
            )
            credito_actualizado = result.fetchone()
            await self.db.commit()
            return self._row_to_credito_response(credito_actualizado)

        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error asignando analista: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al asignar el analista.")

    async def registrar_evaluacion(
        self, auth_user_id: str, credito_id: str, data: EvaluacionCreditoRequest
    ) -> CreditoResponse:
        """
        El analista registra su evaluación crediticia.
        Según recomendación: puede aprobar directamente, rechazar, o escalar al comité.
        """
        analista = await self._requerir_rol(auth_user_id, ["analista", "admin"])
        credito = await self._obtener_credito_o_404(credito_id)

        if credito.estado != "en_evaluacion":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El crédito debe estar 'en_evaluacion'. Estado actual: '{credito.estado}'."
            )

        # Determinar nuevo estado según recomendación
        mapa_estados = {
            "aprobar": "aprobado",
            "rechazar": "rechazado",
            "escalar_comite": "en_comite"
        }
        nuevo_estado = mapa_estados[data.recomendacion]

        monto_aprobado = float(data.monto_aprobado_propuesto or credito.monto_solicitado)
        plazo_final = data.plazo_meses_propuesto or credito.plazo_meses
        tasa_final = float(data.tasa_interes_propuesta)

        params: dict = {
            "id": credito_id,
            "estado": nuevo_estado,
            "score": data.score_crediticio,
            "tasa": tasa_final,
            "monto_aprobado": monto_aprobado if nuevo_estado == "aprobado" else None,
            "plazo": plazo_final,
            "obs": data.observaciones,
            "fecha_decision": datetime.now() if nuevo_estado in ("aprobado", "rechazado") else None
        }

        try:
            result = await self.db.execute(
                text("""
                    UPDATE creditos SET
                        estado = :estado,
                        score_crediticio = :score,
                        tasa_interes = :tasa,
                        monto_aprobado = :monto_aprobado,
                        plazo_meses = :plazo,
                        observaciones = :obs,
                        fecha_decision = :fecha_decision
                    WHERE id = :id
                    RETURNING *
                """),
                params
            )
            credito_actualizado = result.fetchone()
            await self.db.commit()

            logger.info(f"Evaluación registrada: Crédito {credito.numero_credito} → {nuevo_estado} "
                        f"por analista {analista.nombre_completo}")

            return self._row_to_credito_response(credito_actualizado)

        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error registrando evaluación: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al registrar la evaluación.")

    # =========================================================================
    # CORE BANCARIO - Comité de Créditos
    # =========================================================================

    async def decision_comite(
        self, auth_user_id: str, credito_id: str, data: DecisionComiteRequest
    ) -> CreditoResponse:
        """
        El comité toma la decisión final: aprobado o rechazado.
        Solo opera sobre créditos en estado 'en_comite' o 'en_evaluacion'.
        """
        comite_usuario = await self._requerir_rol(auth_user_id, ["comite", "admin"])
        credito = await self._obtener_credito_o_404(credito_id)

        if credito.estado not in ("en_comite", "en_evaluacion"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"El crédito no está en etapa de decisión. Estado: '{credito.estado}'."
            )

        if data.decision == "aprobado" and not data.monto_aprobado:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar el monto aprobado al aprobar un crédito."
            )

        if data.decision == "rechazado" and not data.motivo_rechazo:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe especificar el motivo de rechazo."
            )

        tasa_final = float(data.tasa_interes_final or credito.tasa_interes)
        plazo_final = data.plazo_meses_final or credito.plazo_meses

        try:
            result = await self.db.execute(
                text("""
                    UPDATE creditos SET
                        estado = :decision,
                        comite_aprobador_id = :comite_id,
                        monto_aprobado = :monto_aprobado,
                        tasa_interes = :tasa,
                        plazo_meses = :plazo,
                        motivo_rechazo = :motivo_rechazo,
                        observaciones = :obs,
                        fecha_decision = NOW()
                    WHERE id = :id
                    RETURNING *
                """),
                {
                    "id": credito_id,
                    "decision": data.decision,
                    "comite_id": str(comite_usuario.id),
                    "monto_aprobado": float(data.monto_aprobado) if data.monto_aprobado else None,
                    "tasa": tasa_final,
                    "plazo": plazo_final,
                    "motivo_rechazo": data.motivo_rechazo,
                    "obs": data.observaciones
                }
            )
            credito_actualizado = result.fetchone()
            await self.db.commit()

            logger.info(f"Decisión comité: Crédito {credito.numero_credito} → {data.decision} "
                        f"por {comite_usuario.nombre_completo}")

            return self._row_to_credito_response(credito_actualizado)

        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error en decisión comité: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error al registrar la decisión del comité.")

    # =========================================================================
    # CORE BANCARIO - Desembolso
    # =========================================================================

    async def ejecutar_desembolso(
        self, auth_user_id: str, credito_id: str, data: DesembolsoRequest
    ) -> CreditoResponse:
        """
        Ejecuta el desembolso de un crédito aprobado:
        1. Valida estado 'aprobado'
        2. Acredita el monto a la cuenta del cliente (fn_procesar_transaccion)
        3. Genera el cronograma de pagos
        4. Cambia estado a 'desembolsado'
        Todo en una transacción atómica.
        """
        await self._requerir_rol(auth_user_id, ["admin", "comite"])
        credito = await self._obtener_credito_o_404(credito_id)

        if credito.estado != "aprobado":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Solo se pueden desembolsar créditos aprobados. Estado actual: '{credito.estado}'."
            )

        if not data.confirmar:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debe confirmar el desembolso (confirmar: true)."
            )

        monto_desembolso = float(credito.monto_aprobado)
        tea = float(credito.tasa_interes)
        plazo = credito.plazo_meses
        fecha_hoy = date.today()

        try:
            # 1. Acreditar monto a la cuenta del cliente (atómico via función SQL)
            mov_result = await self.db.execute(
                text("""
                    SELECT fn_procesar_transaccion(
                        :cuenta_id, 'desembolso_credito', :monto,
                        :descripcion, 'sistema', NULL, NULL
                    ) AS movimiento_id
                """),
                {
                    "cuenta_id": str(credito.cuenta_desembolso_id),
                    "monto": monto_desembolso,
                    "descripcion": f"Desembolso crédito {credito.numero_credito}"
                }
            )
            movimiento_id = mov_result.scalar()

            # 2. Generar cronograma de amortización
            cronograma = generar_cronograma(monto_desembolso, tea, plazo, fecha_hoy)

            for cuota in cronograma:
                await self.db.execute(
                    text("""
                        INSERT INTO cronograma_pagos
                            (credito_id, numero_cuota, monto_cuota, monto_capital,
                             monto_interes, saldo_capital, fecha_vencimiento, estado)
                        VALUES
                            (:cid, :num, :monto, :capital,
                             :interes, :saldo, :fecha_venc, 'pendiente')
                    """),
                    {
                        "cid": credito_id,
                        "num": cuota["numero_cuota"],
                        "monto": cuota["monto_cuota"],
                        "capital": cuota["monto_capital"],
                        "interes": cuota["monto_interes"],
                        "saldo": cuota["saldo_capital"],
                        "fecha_venc": cuota["fecha_vencimiento"]
                    }
                )

            # 3. Actualizar estado del crédito
            result = await self.db.execute(
                text("""
                    UPDATE creditos SET
                        estado = 'desembolsado',
                        fecha_desembolso = NOW()
                    WHERE id = :id
                    RETURNING *
                """),
                {"id": credito_id}
            )
            credito_actualizado = result.fetchone()
            await self.db.commit()

            cuota_mensual = calcular_cuota_mensual(monto_desembolso, tea, plazo)
            logger.info(
                f"Desembolso ejecutado: {credito.numero_credito} | "
                f"Monto: {monto_desembolso} | TEA: {tea}% | "
                f"Cuota: {cuota_mensual:.2f} | Plazo: {plazo} meses"
            )

            return self._row_to_credito_response(credito_actualizado)

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error en desembolso: {exc}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                                detail="Error crítico al ejecutar el desembolso. Operación revertida.")

    # =========================================================================
    # REPORTES DEL CORE BANCARIO
    # =========================================================================

    async def obtener_resumen_cartera(self, auth_user_id: str) -> ResumenCarteraResponse:
        """KPIs de la cartera de créditos activa para el dashboard del core bancario."""
        await self._requerir_rol(auth_user_id, ["analista", "comite", "admin"])

        # Totales desembolsados
        totales = await self.db.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE estado = 'desembolsado') AS activos,
                COALESCE(SUM(monto_aprobado) FILTER (WHERE estado = 'desembolsado'), 0) AS total_desembolsado,
                COUNT(*) FILTER (WHERE estado IN ('enviado', 'en_evaluacion', 'en_comite')) AS en_evaluacion
            FROM creditos
        """))
        t = totales.fetchone()

        # Monto pendiente de cobro (suma de cuotas pendientes)
        pendiente_cobro = await self.db.execute(text("""
            SELECT COALESCE(SUM(cp.monto_cuota), 0)
            FROM cronograma_pagos cp
            JOIN creditos c ON c.id = cp.credito_id
            WHERE cp.estado = 'pendiente' AND c.estado = 'desembolsado'
        """))

        # En mora (cuotas vencidas)
        mora = await self.db.execute(text("""
            SELECT COUNT(DISTINCT c.id)
            FROM cronograma_pagos cp
            JOIN creditos c ON c.id = cp.credito_id
            WHERE cp.estado = 'vencido'
              AND c.estado = 'desembolsado'
        """))
        creditos_mora = mora.scalar() or 0
        total_activos = t.activos or 1  # Evitar div/0
        tasa_morosidad = round((creditos_mora / total_activos) * 100, 2)

        # Desembolsos del día
        desembolsos_hoy = await self.db.execute(text("""
            SELECT
                COUNT(*) AS cantidad,
                COALESCE(SUM(monto_aprobado), 0) AS monto
            FROM creditos
            WHERE estado = 'desembolsado'
              AND DATE(fecha_desembolso AT TIME ZONE 'America/Lima') = CURRENT_DATE
        """))
        dh = desembolsos_hoy.fetchone()

        return ResumenCarteraResponse(
            total_creditos_activos=t.activos or 0,
            monto_total_desembolsado=Decimal(str(t.total_desembolsado or 0)),
            monto_total_pendiente_cobro=Decimal(str(pendiente_cobro.scalar() or 0)),
            creditos_en_evaluacion=t.en_evaluacion or 0,
            creditos_en_mora=creditos_mora,
            tasa_morosidad=tasa_morosidad,
            desembolsos_hoy=dh.cantidad or 0,
            monto_desembolsado_hoy=Decimal(str(dh.monto or 0))
        )

    async def obtener_cartera_activa(
        self, auth_user_id: str, pagina: int = 1, por_pagina: int = 20
    ) -> PaginatedResponse:
        """Listado completo de la cartera activa para reportes."""
        await self._requerir_rol(auth_user_id, ["analista", "comite", "admin"])

        result = await self.db.execute(
            text("""
                SELECT
                    c.id, c.numero_credito, u.nombre_completo AS cliente, u.dni,
                    c.monto_aprobado, c.moneda, c.estado, c.tasa_interes,
                    c.plazo_meses, c.fecha_solicitud, c.fecha_desembolso,
                    an.nombre_completo AS analista,
                    (SELECT COUNT(*) FROM cronograma_pagos cp
                     WHERE cp.credito_id = c.id AND cp.estado = 'pendiente') AS cuotas_pendientes,
                    (SELECT COUNT(*) FROM cronograma_pagos cp
                     WHERE cp.credito_id = c.id AND cp.estado = 'vencido') AS cuotas_vencidas
                FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                LEFT JOIN usuarios an ON an.id = c.analista_id
                WHERE c.estado NOT IN ('rechazado', 'cancelado')
                ORDER BY c.fecha_solicitud DESC
                LIMIT :limit OFFSET :offset
            """),
            {"limit": por_pagina, "offset": (pagina - 1) * por_pagina}
        )

        count_result = await self.db.execute(
            text("SELECT COUNT(*) FROM creditos WHERE estado NOT IN ('rechazado', 'cancelado')")
        )
        total = count_result.scalar() or 0

        items = [
            CreditoCarteraItem(
                id=r.id, numero_credito=r.numero_credito, cliente=r.cliente,
                dni=r.dni, monto_aprobado=r.monto_aprobado, moneda=r.moneda,
                estado=r.estado, tasa_interes=r.tasa_interes, plazo_meses=r.plazo_meses,
                fecha_solicitud=r.fecha_solicitud, fecha_desembolso=r.fecha_desembolso,
                cuotas_pendientes=r.cuotas_pendientes, cuotas_vencidas=r.cuotas_vencidas,
                analista=r.analista
            ) for r in result.fetchall()
        ]

        return PaginatedResponse(
            items=items,
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
            total_paginas=math.ceil(total / por_pagina)
        )

    async def obtener_desembolsos_dia(self, auth_user_id: str) -> dict:
        """Reporte de desembolsos del día actual."""
        await self._requerir_rol(auth_user_id, ["analista", "comite", "admin"])

        result = await self.db.execute(text("""
            SELECT
                c.id, c.numero_credito, u.nombre_completo AS cliente, u.dni,
                c.monto_aprobado, c.moneda, c.tasa_interes, c.plazo_meses,
                c.fecha_desembolso, com.nombre_completo AS aprobado_por
            FROM creditos c
            JOIN usuarios u ON u.id = c.usuario_id
            LEFT JOIN usuarios com ON com.id = c.comite_aprobador_id
            WHERE c.estado = 'desembolsado'
              AND DATE(c.fecha_desembolso AT TIME ZONE 'America/Lima') = CURRENT_DATE
            ORDER BY c.fecha_desembolso DESC
        """))

        rows = result.fetchall()
        items = [
            {
                "id": str(r.id),
                "numero_credito": r.numero_credito,
                "cliente": r.cliente,
                "dni": r.dni,
                "monto_aprobado": float(r.monto_aprobado) if r.monto_aprobado else None,
                "moneda": r.moneda,
                "tasa_interes": float(r.tasa_interes),
                "plazo_meses": r.plazo_meses,
                "fecha_desembolso": r.fecha_desembolso.isoformat() if r.fecha_desembolso else None,
                "aprobado_por": r.aprobado_por
            } for r in rows
        ]

        total_pen = sum(
            i["monto_aprobado"] for i in items
            if i["moneda"] == "PEN" and i["monto_aprobado"]
        )
        total_usd = sum(
            i["monto_aprobado"] for i in items
            if i["moneda"] == "USD" and i["monto_aprobado"]
        )

        return {
            "fecha": date.today().isoformat(),
            "total_operaciones": len(items),
            "monto_total_pen": round(total_pen, 2),
            "monto_total_usd": round(total_usd, 2),
            "desembolsos": items
        }

    async def obtener_simulacion_credito(
        self,
        monto: float,
        tea: float,
        plazo_meses: int
    ) -> dict:
        """
        Simulador de crédito público (no requiere autenticación).
        Retorna la cuota estimada y el cronograma completo.
        """
        if monto <= 0 or tea <= 0 or plazo_meses <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Monto, TEA y plazo deben ser mayores a cero."
            )

        cuota = calcular_cuota_mensual(monto, tea, plazo_meses)
        cronograma = generar_cronograma(monto, tea, plazo_meses, date.today())

        total_pagar = sum(c["monto_cuota"] for c in cronograma)
        total_intereses = sum(c["monto_interes"] for c in cronograma)

        return {
            "monto_solicitado": round(monto, 2),
            "tea": tea,
            "tem": round(((1 + tea / 100) ** (1 / 12) - 1) * 100, 4),
            "plazo_meses": plazo_meses,
            "cuota_mensual": round(cuota, 2),
            "total_a_pagar": round(total_pagar, 2),
            "total_intereses": round(total_intereses, 2),
            "cronograma": cronograma
        }
