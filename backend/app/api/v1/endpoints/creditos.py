# =============================================================================
# app/api/v1/endpoints/creditos.py
# Endpoints del Core Bancario: Créditos, Evaluación, Comité, Desembolso y Reportes
# =============================================================================

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from loguru import logger

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.services.creditos_service import CreditosService
from app.schemas.schemas import (
    SolicitudCreditoRequest, CreditoResponse, CuotaResponse,
    AsignarAnalistaRequest, EvaluacionCreditoRequest, DecisionComiteRequest,
    DesembolsoRequest, ResumenCarteraResponse, PaginatedResponse, MensajeResponse
)

router = APIRouter(prefix="/creditos", tags=["💳 Core Bancario - Créditos"])


# =============================================================================
# HOME BANKING - Endpoints del cliente
# =============================================================================

@router.post(
    "/solicitar",
    response_model=CreditoResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar crédito",
    description="El cliente envía una solicitud de crédito desde el home banking."
)
async def solicitar_credito(
    data: SolicitudCreditoRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Solicitud de crédito por parte del cliente.

    - Valida que la cuenta de desembolso pertenezca al cliente
    - Asigna tasa tentativa según el propósito del crédito
    - Limita a máximo 2 solicitudes en proceso simultáneas
    - Estado inicial: **enviado**
    """
    logger.info(f"Nueva solicitud de crédito | usuario: {current_user['email']} | monto: {data.monto_solicitado}")
    service = CreditosService(db)
    return await service.solicitar_credito(current_user["auth_user_id"], data)


@router.get(
    "/mis-creditos",
    response_model=list[CreditoResponse],
    summary="Listar mis créditos",
    description="Retorna todos los créditos del cliente autenticado, en cualquier estado."
)
async def mis_creditos(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_mis_creditos(current_user["auth_user_id"])


@router.get(
    "/{credito_id}/cronograma",
    response_model=list[CuotaResponse],
    summary="Ver cronograma de pagos",
    description="Retorna la tabla de amortización completa de un crédito desembolsado."
)
async def ver_cronograma(
    credito_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_cronograma(current_user["auth_user_id"], credito_id)


@router.get(
    "/simulador",
    summary="Simulador de crédito",
    description="Calcula la cuota mensual y genera el cronograma estimado. No requiere autenticación.",
    tags=["💳 Core Bancario - Créditos", "🔓 Público"]
)
async def simular_credito(
    monto: float = Query(..., gt=0, description="Monto a solicitar"),
    tea: float = Query(..., gt=0, le=200, description="Tasa Efectiva Anual (%)"),
    plazo_meses: int = Query(..., ge=1, le=120, description="Plazo en meses"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Simulador público de crédito (no requiere login).
    Útil para la página de ventas del banco.
    """
    service = CreditosService(db)
    return await service.obtener_simulacion_credito(monto, tea, plazo_meses)


# =============================================================================
# CORE BANCARIO - Bandeja de trabajo (Analistas y Comité)
# =============================================================================

@router.get(
    "/bandeja",
    response_model=PaginatedResponse,
    summary="Bandeja de solicitudes [STAFF]",
    description=(
        "Listado de solicitudes para gestión interna. "
        "Analistas ven solicitudes 'enviado' y 'en_evaluacion'. "
        "Comité ve solicitudes 'en_comite'. "
        "Admin ve todo."
    )
)
async def bandeja_solicitudes(
    estado: Optional[str] = Query(
        default=None,
        description="Filtrar por estado: enviado, en_evaluacion, en_comite, aprobado, rechazado, desembolsado"
    ),
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_bandeja_solicitudes(
        current_user["auth_user_id"], estado, pagina, por_pagina
    )


@router.patch(
    "/{credito_id}/asignar-analista",
    response_model=CreditoResponse,
    summary="Asignar analista [ADMIN]",
    description="Asigna un analista a una solicitud. Cambia el estado a 'en_evaluacion'."
)
async def asignar_analista(
    credito_id: str,
    data: AsignarAnalistaRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.asignar_analista(current_user["auth_user_id"], credito_id, data)


@router.patch(
    "/{credito_id}/evaluar",
    response_model=CreditoResponse,
    summary="Registrar evaluación crediticia [ANALISTA]",
    description=(
        "El analista registra el resultado de su análisis. "
        "Puede recomendar: aprobar, rechazar, o escalar al comité."
    )
)
async def registrar_evaluacion(
    credito_id: str,
    data: EvaluacionCreditoRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Registro de evaluación del analista.

    Flujos posibles:
    - **aprobar** → Estado cambia a `aprobado`
    - **rechazar** → Estado cambia a `rechazado`
    - **escalar_comite** → Estado cambia a `en_comite`
    """
    logger.info(f"Evaluación de crédito {credito_id} | analista: {current_user['email']}")
    service = CreditosService(db)
    return await service.registrar_evaluacion(current_user["auth_user_id"], credito_id, data)


# =============================================================================
# CORE BANCARIO - Comité de Créditos
# =============================================================================

@router.patch(
    "/{credito_id}/decision-comite",
    response_model=CreditoResponse,
    summary="Decisión del comité [COMITÉ]",
    description=(
        "El comité toma la decisión final sobre solicitudes escaladas. "
        "Puede aprobar (con monto y tasa final) o rechazar (con motivo)."
    )
)
async def decision_comite(
    credito_id: str,
    data: DecisionComiteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Decisión final del comité crediticio.

    - **aprobado**: Requiere `monto_aprobado` y opcionalmente `tasa_interes_final`
    - **rechazado**: Requiere `motivo_rechazo` descriptivo
    """
    logger.info(f"Decisión comité: crédito={credito_id} | decisión={data.decision} | comité={current_user['email']}")
    service = CreditosService(db)
    return await service.decision_comite(current_user["auth_user_id"], credito_id, data)


# =============================================================================
# CORE BANCARIO - Desembolso
# =============================================================================

@router.post(
    "/{credito_id}/desembolsar",
    response_model=CreditoResponse,
    status_code=status.HTTP_200_OK,
    summary="Ejecutar desembolso [ADMIN/COMITÉ]",
    description=(
        "Desembolsa un crédito aprobado: acredita el monto a la cuenta del cliente "
        "y genera automáticamente el cronograma de pagos con sistema francés (cuota fija)."
    )
)
async def ejecutar_desembolso(
    credito_id: str,
    data: DesembolsoRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Desembolso de crédito aprobado.

    Proceso atómico (todo o nada):
    1. Verifica estado `aprobado`
    2. Acredita monto a la cuenta del cliente
    3. Genera tabla de amortización francesa
    4. Actualiza estado a `desembolsado`

    ⚠️ Esta operación no se puede revertir desde la API.
    """
    logger.warning(
        f"DESEMBOLSO INICIADO: crédito={credito_id} | operador={current_user['email']}"
    )
    service = CreditosService(db)
    return await service.ejecutar_desembolso(current_user["auth_user_id"], credito_id, data)


# =============================================================================
# REPORTES DEL CORE BANCARIO
# =============================================================================

@router.get(
    "/reportes/resumen-cartera",
    response_model=ResumenCarteraResponse,
    summary="KPIs de la cartera [STAFF]",
    description="Panel de indicadores clave: total desembolsado, mora, desembolsos del día, etc."
)
async def resumen_cartera(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_resumen_cartera(current_user["auth_user_id"])


@router.get(
    "/reportes/cartera-activa",
    response_model=PaginatedResponse,
    summary="Cartera activa completa [STAFF]",
    description="Listado paginado de todos los créditos activos con estado de cuotas."
)
async def cartera_activa(
    pagina: int = Query(default=1, ge=1),
    por_pagina: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_cartera_activa(
        current_user["auth_user_id"], pagina, por_pagina
    )


@router.get(
    "/reportes/desembolsos-hoy",
    summary="Desembolsos del día [STAFF]",
    description="Reporte de todos los créditos desembolsados en el día actual (hora Lima)."
)
async def desembolsos_hoy(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = CreditosService(db)
    return await service.obtener_desembolsos_dia(current_user["auth_user_id"])