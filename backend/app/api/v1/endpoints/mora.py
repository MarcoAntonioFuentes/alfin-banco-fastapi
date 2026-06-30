# =============================================================================
# app/api/v1/endpoints/mora.py
# Endpoints del Módulo de Recuperaciones / Mora
# R1: KPIs por banda | R2: Gestiones | R3: Judicial / Castigo
# ARCHIVO NUEVO — agregar al router existente
# =============================================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field
from datetime import date
from loguru import logger

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.services.mora_service import MoraService

router = APIRouter(prefix="/mora", tags=["🔴 Recuperaciones / Mora"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class GestionRequest(BaseModel):
    tipo_gestion:      str = Field(..., description="llamada_telefonica | visita_domiciliaria | whatsapp | carta_notarial | acuerdo_pago | promesa_pago | refinanciamiento")
    resultado:         str = Field(..., description="contactado_compromiso | contactado_sin_compromiso | no_contactado | acuerdo_alcanzado | rechazo_pago | promesa_incumplida")
    observaciones:     Optional[str]  = Field(None, max_length=1000)
    monto_comprometido:Optional[float]= Field(None, gt=0)
    fecha_compromiso:  Optional[date] = None
    proxima_gestion:   Optional[date] = None

    model_config = {"json_schema_extra": {"example": {
        "tipo_gestion":       "llamada_telefonica",
        "resultado":          "contactado_compromiso",
        "observaciones":      "Cliente indica que realizará el pago esta semana.",
        "monto_comprometido": 450.00,
        "fecha_compromiso":   "2025-06-15",
        "proxima_gestion":    "2025-06-20"
    }}}


class TransicionRequest(BaseModel):
    observaciones: Optional[str] = Field(None, max_length=500,
                                         description="Motivo de la transición")


class RDSRequest(BaseModel):
    ingreso_mensual:      float = Field(..., gt=0, description="Ingreso mensual verificado del cliente")
    deuda_mensual_actual: float = Field(default=0.0, ge=0, description="Cuotas mensuales de deudas existentes")
    monto_nuevo:          float = Field(..., gt=0, description="Monto del crédito a evaluar")
    tasa_tea:             float = Field(..., gt=0, le=200, description="TEA del nuevo crédito")
    plazo_meses:          int   = Field(..., ge=1, le=240, description="Plazo en meses")

    model_config = {"json_schema_extra": {"example": {
        "ingreso_mensual":      3500.00,
        "deuda_mensual_actual": 200.00,
        "monto_nuevo":          15000.00,
        "tasa_tea":             20.0,
        "plazo_meses":          24
    }}}


# ─── R1: KPIs de mora ─────────────────────────────────────────────────────────

@router.get(
    "/kpis",
    summary="R1 — KPIs de mora por banda",
    description=(
        "Panel de indicadores de recuperaciones. "
        "Retorna KPIs globales y desglose por banda: "
        "Preventiva / Temprana / Tardía / Judicial / Castigo."
    )
)
async def kpis_mora(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Actualiza automáticamente los días de mora antes de retornar los datos.
    Incluye: cantidad, montos, porcentaje y semáforo por cada banda.
    """
    service = MoraService(db)
    return await service.obtener_kpis_mora(current_user["auth_user_id"])


@router.get(
    "/banda/{banda}",
    summary="R1 — Créditos de una banda específica",
    description="Listado detallado de créditos en mora de una banda: preventiva, temprana, tardia, judicial, castigo."
)
async def creditos_por_banda(
    banda:      str,
    pagina:     int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = MoraService(db)
    return await service.obtener_creditos_por_banda(
        current_user["auth_user_id"], banda, pagina, por_pagina
    )


@router.post(
    "/actualizar",
    summary="Actualizar mora de toda la cartera",
    description="Ejecuta fn_actualizar_mora_cartera(): recalcula días de mora y banda para todos los créditos desembolsados."
)
async def actualizar_mora(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = MoraService(db)
    return await service.actualizar_mora(current_user["auth_user_id"])


# ─── R2: Gestiones de cobranza ────────────────────────────────────────────────

@router.get(
    "/{credito_id}/gestiones",
    summary="R2 — Historial de gestiones de un crédito",
    description="Retorna todas las gestiones de cobranza registradas para un crédito."
)
async def listar_gestiones(
    credito_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = MoraService(db)
    return await service.listar_gestiones(current_user["auth_user_id"], credito_id)


@router.post(
    "/{credito_id}/gestiones",
    status_code=status.HTTP_201_CREATED,
    summary="R2 — Registrar gestión de cobranza",
    description=(
        "Registra una nueva gestión (llamada, visita, carta, acuerdo) "
        "sobre un crédito moroso. Requiere rol asesor o superior."
    )
)
async def registrar_gestion(
    credito_id: str,
    data: GestionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    logger.info(f"Nueva gestión: crédito={credito_id} | tipo={data.tipo_gestion} | por={current_user['email']}")
    service = MoraService(db)
    return await service.registrar_gestion(
        current_user["auth_user_id"], credito_id, data.model_dump()
    )


# ─── R3: Transiciones de estado ───────────────────────────────────────────────

@router.post(
    "/{credito_id}/derivar-judicial",
    summary="R3 — Derivar a cobranza judicial",
    description=(
        "Marca el crédito como derivado a vía judicial. "
        "Requiere: rol riesgos/gerencia/admin + mínimo 121 días de mora."
    )
)
async def derivar_judicial(
    credito_id: str,
    data: TransicionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    logger.warning(f"DERIVAR JUDICIAL: crédito={credito_id} | por={current_user['email']}")
    service = MoraService(db)
    return await service.derivar_judicial(
        current_user["auth_user_id"], credito_id, data.observaciones or ""
    )


@router.post(
    "/{credito_id}/castigar",
    summary="R3 — Castigo de cartera (write-off)",
    description=(
        "Castiga un crédito irrecuperable. "
        "Requiere: rol gerencia/admin + mínimo 181 días de mora. "
        "⚠️ Operación contable irreversible."
    )
)
async def castigar_credito(
    credito_id: str,
    data: TransicionRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    logger.warning(f"CASTIGO CARTERA: crédito={credito_id} | por={current_user['email']}")
    service = MoraService(db)
    return await service.castigar_credito(
        current_user["auth_user_id"], credito_id, data.observaciones or ""
    )


# ─── RDS: Calculadora pública ─────────────────────────────────────────────────

@router.post(
    "/calcular-rds",
    summary="Calcular RDS (Ratio Deuda/Salario)",
    description=(
        "Calcula el ratio deuda/salario y el nivel de aprobación requerido. "
        "Verde: RDS<30% | Amarillo: 30-40% | Rojo: >40%"
    ),
    tags=["🔴 Recuperaciones / Mora", "💳 Core Bancario - Créditos"]
)
async def calcular_rds(data: RDSRequest):
    """
    Calculadora de elegibilidad crediticia basada en RDS.
    No requiere autenticación — disponible en el formulario de solicitud.
    """
    try:
        return MoraService.calcular_rds(
            ingreso_mensual      = data.ingreso_mensual,
            deuda_mensual_actual = data.deuda_mensual_actual,
            monto_nuevo          = data.monto_nuevo,
            tasa_tea             = data.tasa_tea,
            plazo_meses          = data.plazo_meses,
        )
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))
