# =============================================================================
# PARCHE: schemas/schemas.py — SolicitudCreditoRequest ACTUALIZADO
# Agrega: ingreso_mensual, deuda_mensual_actual, producto
#
# INSTRUCCIÓN: En tu schemas.py, REEMPLAZA la clase SolicitudCreditoRequest
# =============================================================================

from pydantic import BaseModel, Field
from typing import Optional, Literal
from decimal import Decimal
from uuid import UUID


class SolicitudCreditoRequest(BaseModel):
    """
    Schema actualizado para solicitud de crédito.
    Incluye campos para el cálculo de RDS (Ratio Deuda/Salario).
    """
    # Datos del crédito
    monto_solicitado: Decimal = Field(
        ..., gt=0, le=500000,
        description="Monto en soles o dólares"
    )
    moneda: Literal["PEN", "USD"] = "PEN"

    plazo_meses: int = Field(
        ..., ge=3, le=240,
        description="Plazo entre 3 y 240 meses según el producto"
    )

    # Tipo de producto — define las reglas aplicables
    producto: Literal[
        "consumo", "hipotecario", "vehicular", "microempresa"
    ] = Field(
        default="consumo",
        description="Producto: consumo | hipotecario | vehicular | microempresa"
    )

    proposito: str = Field(
        ..., min_length=5, max_length=100,
        description="Descripción del destino del crédito"
    )

    # Cuenta donde se abonará el desembolso
    cuenta_desembolso_id: UUID = Field(
        ...,
        description="ID de la cuenta del cliente donde se depositará el crédito"
    )

    # ── Campos para cálculo de RDS ────────────────────────────────────────────
    ingreso_mensual: Optional[Decimal] = Field(
        None, gt=0,
        description="Ingreso mensual verificado del solicitante (para calcular RDS)"
    )

    deuda_mensual_actual: Optional[Decimal] = Field(
        default=Decimal("0"),
        ge=0,
        description="Suma de cuotas mensuales de otras deudas vigentes"
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "monto_solicitado":   15000.00,
                "moneda":             "PEN",
                "plazo_meses":        24,
                "producto":           "consumo",
                "proposito":          "Capital de trabajo para negocio familiar",
                "cuenta_desembolso_id": "550e8400-e29b-41d4-a716-446655440000",
                "ingreso_mensual":    3500.00,
                "deuda_mensual_actual": 200.00
            }
        }
    }


class CreditoResponse(BaseModel):
    """Respuesta extendida con campos de RDS y producto."""
    id: UUID
    numero_credito: str
    monto_solicitado: Decimal
    monto_aprobado: Optional[Decimal]
    moneda: str
    estado: str
    producto: Optional[str]
    tasa_interes: Decimal
    tasa_tipo: str
    plazo_meses: int
    proposito: Optional[str]
    observaciones: Optional[str]
    # Campos RDS — nuevos
    ingreso_mensual: Optional[Decimal]
    rds_calculado: Optional[Decimal]
    rds_semaforo: Optional[str]
    nivel_aprobacion: Optional[str]
    # Timestamps
    fecha_solicitud: object   # datetime
    fecha_decision: Optional[object]
    fecha_desembolso: Optional[object]

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: float(v)}
    }
