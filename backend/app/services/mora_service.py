# =============================================================================
# app/services/mora_service.py
# Módulo de Recuperaciones: R1 (consulta por bandas), R2 (gestiones),
# R3 (transiciones judicial/castigo) + cálculo de RDS en créditos
# ARCHIVO NUEVO — no modifica ningún servicio existente
# =============================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from fastapi import HTTPException, status
from loguru import logger
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from decimal import Decimal

# ─── Roles que pueden gestionar mora ─────────────────────────────────────────
ROLES_COBRANZA  = ['asesor', 'analista', 'riesgos', 'comite', 'gerencia', 'admin']
ROLES_JUDICIAL  = ['riesgos', 'gerencia', 'admin']
ROLES_CASTIGO   = ['gerencia', 'admin']

# ─── Umbrales de mora por banda (días) ───────────────────────────────────────
UMBRAL_JUDICIAL = 121
UMBRAL_CASTIGO  = 181

# ─── RDS semáforo ─────────────────────────────────────────────────────────────
def calcular_rds_semaforo(rds: float) -> str:
    if rds < 30:   return 'verde'
    if rds < 40:   return 'amarillo'
    return 'rojo'

def calcular_nivel_aprobacion(monto: float, producto: str = 'consumo') -> str:
    """Determina el nivel de aprobación según monto y producto."""
    umbrales = {
        'consumo':      (10_000, 50_000),
        'hipotecario':  (50_000, 200_000),
        'vehicular':    (20_000, 80_000),
        'microempresa': (15_000, 60_000),
    }
    analista_max, comite_max = umbrales.get(producto, (10_000, 50_000))
    if monto <= analista_max:  return 'analista'
    if monto <= comite_max:    return 'comite'
    return 'gerencia'


class MoraService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─── Helper: verificar rol ────────────────────────────────────────────────
    async def _requerir_rol(self, auth_user_id: str, roles: List[str]) -> Any:
        result = await self.db.execute(
            text("SELECT id, rol, nombre_completo FROM usuarios WHERE auth_user_id = :aid AND estado = 'activo'"),
            {"aid": auth_user_id}
        )
        usuario = result.fetchone()
        if not usuario:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail="Usuario no encontrado.")
        if usuario.rol not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail=f"Acceso denegado. Roles permitidos: {', '.join(roles)}.")
        return usuario

    # =========================================================================
    # R1 — CONSULTA POR BANDAS DE MORA (KPIs)
    # =========================================================================

    async def obtener_kpis_mora(self, auth_user_id: str) -> Dict:
        """
        R1: Panel de indicadores de mora por banda.
        Actualiza los días de mora antes de retornar los datos.
        """
        await self._requerir_rol(auth_user_id, ROLES_COBRANZA)

        # Actualizar mora de toda la cartera
        await self.db.execute(text("SELECT fn_actualizar_mora_cartera()"))
        await self.db.commit()

        # KPIs globales
        global_result = await self.db.execute(text("""
            SELECT
                COUNT(*)                                              AS total_cartera,
                COUNT(*) FILTER (WHERE banda_mora = 'al_dia')        AS al_dia,
                COUNT(*) FILTER (WHERE banda_mora != 'al_dia'
                                   AND banda_mora IS NOT NULL)        AS en_mora,
                COALESCE(SUM(monto_aprobado), 0)                     AS monto_total,
                COALESCE(SUM(monto_aprobado)
                  FILTER (WHERE banda_mora != 'al_dia'
                            AND banda_mora IS NOT NULL), 0)           AS monto_mora,
                COALESCE(AVG(tasa_interes), 0)                       AS tasa_promedio
            FROM creditos
            WHERE estado = 'desembolsado'
        """))
        g = global_result.fetchone()

        tasa_morosidad = round(
            (float(g.en_mora or 0) / max(float(g.total_cartera or 1), 1)) * 100, 2
        )

        # KPIs por banda — LEFT JOIN en lugar de subconsulta correlacionada
        bandas_result = await self.db.execute(text("""
            SELECT
                COALESCE(c.banda_mora, 'al_dia')               AS banda,
                COUNT(DISTINCT c.id)                            AS cantidad,
                COALESCE(SUM(c.monto_aprobado), 0)             AS monto_capital,
                COALESCE(AVG(c.dias_mora), 0)                  AS dias_promedio,
                COUNT(DISTINCT c.id)
                    FILTER (WHERE c.estado_judicial = TRUE)     AS en_judicial,
                COALESCE(SUM(cp.monto_cuota), 0)               AS monto_pendiente
            FROM creditos c
            LEFT JOIN cronograma_pagos cp
                   ON cp.credito_id = c.id
                  AND cp.estado IN ('pendiente', 'vencido')
            WHERE c.estado = 'desembolsado'
            GROUP BY COALESCE(c.banda_mora, 'al_dia')
            ORDER BY
                CASE COALESCE(c.banda_mora, 'al_dia')
                    WHEN 'al_dia'     THEN 1
                    WHEN 'preventiva' THEN 2
                    WHEN 'temprana'   THEN 3
                    WHEN 'tardia'     THEN 4
                    WHEN 'judicial'   THEN 5
                    WHEN 'castigo'    THEN 6
                END
        """))

        bandas = []
        for r in bandas_result.fetchall():
            pct = round((float(r.cantidad) / max(float(g.total_cartera or 1), 1)) * 100, 1)
            semaforo = {
                'al_dia': 'verde', 'preventiva': 'verde',
                'temprana': 'amarillo', 'tardia': 'amarillo',
                'judicial': 'rojo', 'castigo': 'rojo'
            }.get(r.banda, 'gris')

            bandas.append({
                'banda':           r.banda,
                'cantidad':        int(r.cantidad),
                'porcentaje':      pct,
                'monto_capital':   float(r.monto_capital),
                'monto_pendiente': float(r.monto_pendiente),
                'dias_promedio':   round(float(r.dias_promedio), 0),
                'en_judicial':     int(r.en_judicial),
                'semaforo':        semaforo,
            })

        return {
            'resumen': {
                'total_cartera':   int(g.total_cartera or 0),
                'al_dia':          int(g.al_dia or 0),
                'en_mora':         int(g.en_mora or 0),
                'tasa_morosidad':  tasa_morosidad,
                'monto_total':     float(g.monto_total or 0),
                'monto_en_mora':   float(g.monto_mora or 0),
                'tasa_promedio':   round(float(g.tasa_promedio or 0), 2),
            },
            'bandas': bandas,
            'actualizado_en': datetime.now().isoformat(),
        }

    async def obtener_creditos_por_banda(
        self, auth_user_id: str, banda: str,
        pagina: int = 1, por_pagina: int = 20
    ) -> Dict:
        """Listado de créditos de una banda específica con detalle."""
        await self._requerir_rol(auth_user_id, ROLES_COBRANZA)

        bandas_validas = ['al_dia','preventiva','temprana','tardia','judicial','castigo']
        if banda not in bandas_validas:
            raise HTTPException(status_code=400,
                                detail=f"Banda inválida. Opciones: {', '.join(bandas_validas)}")

        offset = (pagina - 1) * por_pagina
        result = await self.db.execute(
            text("""
                SELECT
                    c.id, c.numero_credito, c.banda_mora, c.dias_mora,
                    c.monto_aprobado, c.moneda, c.tasa_interes,
                    c.estado_judicial, c.fecha_judicial, c.fecha_castigo,
                    u.nombre_completo AS cliente, u.dni, u.telefono,
                    -- Cuotas vencidas
                    (SELECT COUNT(*) FROM cronograma_pagos cp
                     WHERE cp.credito_id = c.id AND cp.estado = 'vencido')  AS cuotas_vencidas,
                    -- Monto vencido
                    (SELECT COALESCE(SUM(cp.monto_cuota),0)
                     FROM cronograma_pagos cp
                     WHERE cp.credito_id = c.id AND cp.estado = 'vencido')  AS monto_vencido,
                    -- Última gestión
                    (SELECT gc.fecha_gestion FROM gestiones_cobranza gc
                     WHERE gc.credito_id = c.id
                     ORDER BY gc.fecha_gestion DESC LIMIT 1)                AS ultima_gestion,
                    -- Total gestiones
                    (SELECT COUNT(*) FROM gestiones_cobranza gc
                     WHERE gc.credito_id = c.id)                            AS total_gestiones
                FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.estado = 'desembolsado'
                  AND COALESCE(c.banda_mora, 'al_dia') = :banda
                ORDER BY c.dias_mora DESC
                LIMIT :lim OFFSET :off
            """),
            {"banda": banda, "lim": por_pagina, "off": offset}
        )

        count_r = await self.db.execute(
            text("""
                SELECT COUNT(*) FROM creditos
                WHERE estado = 'desembolsado'
                  AND COALESCE(banda_mora, 'al_dia') = :banda
            """),
            {"banda": banda}
        )
        total = count_r.scalar() or 0

        import math
        items = []
        for r in result.fetchall():
            items.append({
                'id':             str(r.id),
                'numero_credito': r.numero_credito,
                'banda_mora':     r.banda_mora,
                'dias_mora':      r.dias_mora or 0,
                'monto_aprobado': float(r.monto_aprobado or 0),
                'moneda':         r.moneda,
                'tasa_interes':   float(r.tasa_interes),
                'estado_judicial':r.estado_judicial or False,
                'fecha_judicial': r.fecha_judicial.isoformat() if r.fecha_judicial else None,
                'fecha_castigo':  r.fecha_castigo.isoformat() if r.fecha_castigo else None,
                'cliente':        r.cliente,
                'dni':            r.dni,
                'telefono':       r.telefono,
                'cuotas_vencidas':int(r.cuotas_vencidas or 0),
                'monto_vencido':  float(r.monto_vencido or 0),
                'ultima_gestion': r.ultima_gestion.isoformat() if r.ultima_gestion else None,
                'total_gestiones':int(r.total_gestiones or 0),
            })

        return {
            'items': items, 'total': total, 'pagina': pagina,
            'por_pagina': por_pagina,
            'total_paginas': math.ceil(total / por_pagina) if total else 1,
        }

    # =========================================================================
    # R2 — GESTIONES DE COBRANZA
    # =========================================================================

    async def listar_gestiones(
        self, auth_user_id: str, credito_id: str
    ) -> List[Dict]:
        """Historial de gestiones de cobranza de un crédito."""
        await self._requerir_rol(auth_user_id, ROLES_COBRANZA)

        result = await self.db.execute(
            text("""
                SELECT gc.id, gc.tipo_gestion, gc.resultado,
                       gc.monto_comprometido, gc.fecha_compromiso,
                       gc.observaciones, gc.proxima_gestion,
                       gc.banda_mora_momento, gc.dias_mora_momento,
                       gc.fecha_gestion,
                       u.nombre_completo AS gestor, u.rol AS rol_gestor
                FROM gestiones_cobranza gc
                JOIN usuarios u ON u.id = gc.usuario_id
                WHERE gc.credito_id = :cid
                ORDER BY gc.fecha_gestion DESC
            """),
            {"cid": credito_id}
        )

        return [
            {
                'id':                str(r.id),
                'tipo_gestion':      r.tipo_gestion,
                'resultado':         r.resultado,
                'monto_comprometido':float(r.monto_comprometido) if r.monto_comprometido else None,
                'fecha_compromiso':  r.fecha_compromiso.isoformat() if r.fecha_compromiso else None,
                'observaciones':     r.observaciones,
                'proxima_gestion':   r.proxima_gestion.isoformat() if r.proxima_gestion else None,
                'banda_mora_momento':r.banda_mora_momento,
                'dias_mora_momento': r.dias_mora_momento,
                'fecha_gestion':     r.fecha_gestion.isoformat(),
                'gestor':            r.gestor,
                'rol_gestor':        r.rol_gestor,
            }
            for r in result.fetchall()
        ]

    async def registrar_gestion(
        self, auth_user_id: str, credito_id: str, data: Dict
    ) -> Dict:
        """R2: Registra una nueva gestión de cobranza."""
        usuario = await self._requerir_rol(auth_user_id, ROLES_COBRANZA)

        # Verificar que el crédito existe y está desembolsado
        cred = await self.db.execute(
            text("SELECT id, dias_mora, banda_mora FROM creditos WHERE id = :id AND estado = 'desembolsado'"),
            {"id": credito_id}
        )
        credito = cred.fetchone()
        if not credito:
            raise HTTPException(status_code=404,
                                detail="Crédito no encontrado o no está desembolsado.")

        try:
            result = await self.db.execute(
                text("""
                    INSERT INTO gestiones_cobranza (
                        credito_id, usuario_id, tipo_gestion, resultado,
                        monto_comprometido, fecha_compromiso, observaciones,
                        proxima_gestion, banda_mora_momento, dias_mora_momento
                    ) VALUES (
                        :cid, :uid, :tipo, :resultado,
                        :monto, :fecha_comp, :obs,
                        :prox_gestion, :banda, :dias
                    )
                    RETURNING id, fecha_gestion
                """),
                {
                    "cid":         credito_id,
                    "uid":         str(usuario.id),
                    "tipo":        data["tipo_gestion"],
                    "resultado":   data["resultado"],
                    "monto":       data.get("monto_comprometido"),
                    "fecha_comp":  data.get("fecha_compromiso"),
                    "obs":         data.get("observaciones", ""),
                    "prox_gestion":data.get("proxima_gestion"),
                    "banda":       credito.banda_mora,
                    "dias":        credito.dias_mora or 0,
                }
            )
            row = result.fetchone()
            await self.db.commit()

            logger.info(f"Gestión registrada: crédito={credito_id} | "
                        f"tipo={data['tipo_gestion']} | gestor={usuario.nombre_completo}")

            return {"id": str(row.id), "fecha_gestion": row.fecha_gestion.isoformat(),
                    "mensaje": "Gestión registrada exitosamente."}

        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error registrando gestión: {exc}")
            raise HTTPException(status_code=500, detail="Error al registrar la gestión.")

    # =========================================================================
    # R3 — TRANSICIONES: DERIVAR A JUDICIAL / CASTIGAR
    # =========================================================================

    async def derivar_judicial(
        self, auth_user_id: str, credito_id: str, observaciones: str = ""
    ) -> Dict:
        """
        R3: Deriva un crédito a cobranza judicial.
        Requiere: rol riesgos/gerencia/admin + mínimo UMBRAL_JUDICIAL días de mora.
        """
        usuario = await self._requerir_rol(auth_user_id, ROLES_JUDICIAL)

        cred_r = await self.db.execute(
            text("""
                SELECT c.id, c.numero_credito, c.dias_mora, c.banda_mora,
                       c.estado_judicial, u.nombre_completo AS cliente
                FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.id = :id AND c.estado = 'desembolsado'
            """),
            {"id": credito_id}
        )
        credito = cred_r.fetchone()
        if not credito:
            raise HTTPException(status_code=404, detail="Crédito no encontrado.")

        if credito.estado_judicial:
            raise HTTPException(status_code=400, detail="El crédito ya está en estado judicial.")

        dias = credito.dias_mora or 0
        if dias < UMBRAL_JUDICIAL:
            raise HTTPException(
                status_code=400,
                detail=f"Se requieren mínimo {UMBRAL_JUDICIAL} días de mora para derivar a judicial. "
                       f"Días actuales: {dias}."
            )

        try:
            await self.db.execute(
                text("""
                    UPDATE creditos SET
                        estado_judicial     = TRUE,
                        fecha_judicial      = NOW(),
                        usuario_judicial_id = :uid,
                        banda_mora          = 'judicial'
                    WHERE id = :id
                """),
                {"id": credito_id, "uid": str(usuario.id)}
            )

            # Registrar gestión automática
            await self.db.execute(
                text("""
                    INSERT INTO gestiones_cobranza
                        (credito_id, usuario_id, tipo_gestion, resultado,
                         observaciones, banda_mora_momento, dias_mora_momento)
                    VALUES (:cid, :uid, 'carta_notarial', 'rechazo_pago',
                            :obs, 'judicial', :dias)
                """),
                {
                    "cid":  credito_id,
                    "uid":  str(usuario.id),
                    "obs":  observaciones or f"Derivado a cobranza judicial. {observaciones}",
                    "dias": dias,
                }
            )
            await self.db.commit()

            logger.warning(f"JUDICIAL: crédito={credito.numero_credito} | "
                           f"cliente={credito.cliente} | días_mora={dias} | "
                           f"por={usuario.nombre_completo}")

            return {
                "mensaje":        f"Crédito {credito.numero_credito} derivado a cobranza judicial.",
                "numero_credito": credito.numero_credito,
                "dias_mora":      dias,
                "derivado_por":   usuario.nombre_completo,
                "fecha":          datetime.now().isoformat(),
            }

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error derivando a judicial: {exc}")
            raise HTTPException(status_code=500, detail="Error al derivar a cobranza judicial.")

    async def castigar_credito(
        self, auth_user_id: str, credito_id: str, observaciones: str = ""
    ) -> Dict:
        """
        R3: Castiga (write-off) un crédito irrecuperable.
        Requiere: rol gerencia/admin + mínimo UMBRAL_CASTIGO días de mora.
        """
        usuario = await self._requerir_rol(auth_user_id, ROLES_CASTIGO)

        cred_r = await self.db.execute(
            text("""
                SELECT c.id, c.numero_credito, c.dias_mora, c.fecha_castigo,
                       c.monto_aprobado, u.nombre_completo AS cliente
                FROM creditos c
                JOIN usuarios u ON u.id = c.usuario_id
                WHERE c.id = :id AND c.estado = 'desembolsado'
            """),
            {"id": credito_id}
        )
        credito = cred_r.fetchone()
        if not credito:
            raise HTTPException(status_code=404, detail="Crédito no encontrado.")

        if credito.fecha_castigo:
            raise HTTPException(status_code=400, detail="El crédito ya fue castigado.")

        dias = credito.dias_mora or 0
        if dias < UMBRAL_CASTIGO:
            raise HTTPException(
                status_code=400,
                detail=f"Se requieren mínimo {UMBRAL_CASTIGO} días de mora para castigar. "
                       f"Días actuales: {dias}."
            )

        try:
            await self.db.execute(
                text("""
                    UPDATE creditos SET
                        fecha_castigo      = NOW(),
                        usuario_castigo_id = :uid,
                        banda_mora         = 'castigo'
                    WHERE id = :id
                """),
                {"id": credito_id, "uid": str(usuario.id)}
            )

            await self.db.execute(
                text("""
                    INSERT INTO gestiones_cobranza
                        (credito_id, usuario_id, tipo_gestion, resultado,
                         observaciones, banda_mora_momento, dias_mora_momento)
                    VALUES (:cid, :uid, 'carta_notarial', 'rechazo_pago',
                            :obs, 'castigo', :dias)
                """),
                {
                    "cid":  credito_id,
                    "uid":  str(usuario.id),
                    "obs":  f"Crédito castigado (write-off). {observaciones}",
                    "dias": dias,
                }
            )
            await self.db.commit()

            logger.warning(f"CASTIGO: crédito={credito.numero_credito} | "
                           f"cliente={credito.cliente} | "
                           f"monto={credito.monto_aprobado} | "
                           f"por={usuario.nombre_completo}")

            return {
                "mensaje":        f"Crédito {credito.numero_credito} castigado exitosamente.",
                "numero_credito": credito.numero_credito,
                "monto_castigado":float(credito.monto_aprobado or 0),
                "dias_mora":      dias,
                "castigado_por":  usuario.nombre_completo,
                "fecha":          datetime.now().isoformat(),
            }

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error castigando crédito: {exc}")
            raise HTTPException(status_code=500, detail="Error al castigar el crédito.")

    # =========================================================================
    # RDS — Cálculo del Ratio Deuda / Salario
    # Usado al registrar/evaluar un crédito
    # =========================================================================

    @staticmethod
    def calcular_rds(
        ingreso_mensual: float,
        deuda_mensual_actual: float,
        monto_nuevo: float,
        tasa_tea: float,
        plazo_meses: int
    ) -> Dict:
        """
        Calcula el RDS (Ratio Deuda-Salario) y determina el semáforo.
        RDS = (cuota_nueva + deudas_actuales) / ingreso_mensual * 100
        Verde: <30% | Amarillo: 30-40% | Rojo: >40%
        """
        if ingreso_mensual <= 0:
            raise ValueError("El ingreso mensual debe ser mayor a 0.")

        # Calcular cuota del nuevo crédito
        tem = (1 + tasa_tea / 100) ** (1 / 12) - 1
        if tem > 0:
            cuota_nueva = monto_nuevo * (tem * (1 + tem) ** plazo_meses) / ((1 + tem) ** plazo_meses - 1)
        else:
            cuota_nueva = monto_nuevo / plazo_meses

        carga_total = cuota_nueva + deuda_mensual_actual
        rds = (carga_total / ingreso_mensual) * 100

        semaforo = calcular_rds_semaforo(rds)
        nivel    = calcular_nivel_aprobacion(monto_nuevo)

        return {
            "ingreso_mensual":     round(ingreso_mensual, 2),
            "deuda_mensual_actual":round(deuda_mensual_actual, 2),
            "cuota_nueva":         round(cuota_nueva, 2),
            "carga_total":         round(carga_total, 2),
            "rds":                 round(rds, 2),
            "semaforo":            semaforo,
            "nivel_aprobacion":    nivel,
            "elegible":            semaforo in ('verde', 'amarillo'),
            "observacion": (
                "Crédito viable — carga financiera dentro de parámetros normales." if semaforo == 'verde' else
                "Precaución — carga financiera en zona límite. Evaluar capacidad de pago." if semaforo == 'amarillo' else
                "No recomendado — carga financiera supera el 40% del ingreso mensual."
            )
        }

    async def actualizar_mora(self, auth_user_id: str) -> Dict:
        """Ejecuta fn_actualizar_mora_cartera() manualmente desde el panel."""
        await self._requerir_rol(auth_user_id, ['riesgos', 'admin', 'gerencia'])
        result = await self.db.execute(text("SELECT fn_actualizar_mora_cartera() AS actualizados"))
        n = result.scalar() or 0
        await self.db.commit()
        logger.info(f"Mora actualizada manualmente: {n} créditos procesados")
        return {"actualizados": n, "mensaje": f"Mora actualizada: {n} créditos procesados."}
