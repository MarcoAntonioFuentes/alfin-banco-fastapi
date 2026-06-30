# =============================================================================
# app/api/v1/endpoints/ahorros.py
# Endpoints del Dashboard y Módulo de Ahorros
# =============================================================================

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from loguru import logger

from app.core.database import get_db_session
from app.core.security import get_current_user
from app.services.ahorros_service import AhorrosService
from app.schemas.schemas import (
    DashboardResponse, CuentaResponse, MovimientoResponse,
    DepositoRequest, RetiroRequest, TransferenciaRequest,
    TransaccionExitosaResponse
)

router = APIRouter(prefix="/cuentas", tags=["🏦 Ahorros & Dashboard"])


# =============================================================================
# DASHBOARD
# =============================================================================

@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Dashboard del cliente",
    description="Retorna resumen completo: cuentas, saldos, últimos movimientos y próxima cuota."
)
async def obtener_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Vista principal del Home Banking.
    Incluye todos los datos necesarios para el panel del cliente.
    """
    service = AhorrosService(db)
    return await service.obtener_dashboard(current_user["auth_user_id"])


# =============================================================================
# CUENTAS
# =============================================================================

@router.get(
    "/",
    response_model=list[CuentaResponse],
    summary="Listar mis cuentas",
    description="Retorna todas las cuentas activas del usuario autenticado."
)
async def listar_cuentas(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = AhorrosService(db)
    return await service.obtener_cuentas(current_user["auth_user_id"])


@router.get(
    "/{cuenta_id}/saldo",
    summary="Consultar saldo de una cuenta",
    description="Retorna el saldo actual y datos básicos de una cuenta específica."
)
async def obtener_saldo(
    cuenta_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = AhorrosService(db)
    return await service.obtener_saldo(current_user["auth_user_id"], cuenta_id)


# =============================================================================
# MOVIMIENTOS
# =============================================================================

@router.get(
    "/{cuenta_id}/movimientos",
    summary="Historial de movimientos",
    description="Retorna movimientos paginados de una cuenta. Filtrable por tipo."
)
async def obtener_movimientos(
    cuenta_id: str,
    limite: int = Query(default=20, ge=1, le=100, description="Registros por página"),
    offset: int = Query(default=0, ge=0, description="Registros a saltar"),
    tipo: Optional[str] = Query(
        default=None,
        description="Filtrar por tipo: deposito, retiro, transferencia_salida, etc."
    ),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    service = AhorrosService(db)
    return await service.obtener_movimientos(
        current_user["auth_user_id"], cuenta_id, limite, offset, tipo
    )


# =============================================================================
# TRANSACCIONES
# =============================================================================

@router.post(
    "/depositar",
    response_model=TransaccionExitosaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Realizar depósito",
    description="Acredita un monto a una cuenta del usuario. Máximo S/ 100,000 por operación."
)
async def realizar_deposito(
    data: DepositoRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Depósito a cuenta propia.
    Registra el movimiento y actualiza el saldo de forma atómica.
    """
    ip = request.client.host if request.client else None
    logger.info(f"Depósito: usuario={current_user['email']} | cuenta={data.cuenta_id} | monto={data.monto}")
    service = AhorrosService(db)
    return await service.realizar_deposito(current_user["auth_user_id"], data, ip)


@router.post(
    "/retirar",
    response_model=TransaccionExitosaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Realizar retiro",
    description="Debita un monto de una cuenta del usuario. Sujeto a límite diario."
)
async def realizar_retiro(
    data: RetiroRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    ip = request.client.host if request.client else None
    logger.info(f"Retiro: usuario={current_user['email']} | cuenta={data.cuenta_id} | monto={data.monto}")
    service = AhorrosService(db)
    return await service.realizar_retiro(current_user["auth_user_id"], data, ip)


@router.post(
    "/transferir",
    response_model=TransaccionExitosaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Realizar transferencia",
    description=(
        "Transfiere fondos entre cuentas dentro de Alfin Banco. "
        "La operación es atómica: si algo falla, se revierte completamente."
    )
)
async def realizar_transferencia(
    data: TransferenciaRequest,
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Transferencia intrabancaria entre cuentas.

    - Valida que la cuenta origen pertenezca al usuario
    - Busca la cuenta destino por número de cuenta
    - Aplica límites diarios configurados
    - La transacción es ACID: acredita y debita en una sola operación
    """
    ip = request.client.host if request.client else None
    logger.info(
        f"Transferencia: usuario={current_user['email']} | "
        f"origen={data.cuenta_origen_id} | destino={data.cuenta_destino_numero} | monto={data.monto}"
    )
    service = AhorrosService(db)
    return await service.realizar_transferencia(current_user["auth_user_id"], data, ip)