# =============================================================================
# app/schemas/
# Modelos de validación Pydantic para Request/Response de la API
# Separados por dominio funcional
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# app/schemas/auth.py
# Schemas de Autenticación
# ─────────────────────────────────────────────────────────────────────────────
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List, Literal
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
import re


# =============================================================================
# AUTENTICACIÓN
# =============================================================================

class RegistroRequest(BaseModel):
    """Schema para registro de nuevo usuario."""
    email: EmailStr = Field(..., description="Correo electrónico único")
    password: str = Field(..., min_length=8, max_length=100, description="Mínimo 8 caracteres")
    nombre_completo: str = Field(..., min_length=3, max_length=200)
    dni: str = Field(..., min_length=8, max_length=8, description="DNI de 8 dígitos")
    telefono: Optional[str] = Field(None, max_length=15)

    @field_validator("password")
    @classmethod
    def validar_password_segura(cls, v: str) -> str:
        """Valida que la contraseña tenga al menos una letra y un número."""
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("La contraseña debe contener al menos una letra.")
        if not re.search(r"\d", v):
            raise ValueError("La contraseña debe contener al menos un número.")
        return v

    @field_validator("dni")
    @classmethod
    def validar_dni(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 8:
            raise ValueError("El DNI debe contener exactamente 8 dígitos numéricos.")
        return v

    model_config = {"json_schema_extra": {"example": {
        "email": "juan.perez@gmail.com",
        "password": "MiClave123",
        "nombre_completo": "Juan Carlos Pérez López",
        "dni": "45678901",
        "telefono": "987654321"
    }}}


class LoginRequest(BaseModel):
    """Schema para inicio de sesión."""
    email: EmailStr
    password: str = Field(..., min_length=1)

    model_config = {"json_schema_extra": {"example": {
        "email": "juan.perez@gmail.com",
        "password": "MiClave123"
    }}}


class TokenResponse(BaseModel):
    """Respuesta exitosa de autenticación."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int  # segundos
    usuario: "UsuarioResponse"


class RefreshTokenRequest(BaseModel):
    """Para renovar el access token."""
    refresh_token: str


# =============================================================================
# USUARIOS
# =============================================================================

class UsuarioResponse(BaseModel):
    """Datos públicos del usuario (sin información sensible)."""
    id: UUID
    email: str
    nombre_completo: str
    dni: str
    telefono: Optional[str]
    rol: str
    estado: str
    fecha_registro: datetime

    model_config = {"from_attributes": True}


class UsuarioUpdate(BaseModel):
    """Schema para actualización parcial del usuario."""
    nombre_completo: Optional[str] = Field(None, min_length=3, max_length=200)
    telefono: Optional[str] = Field(None, max_length=15)
    direccion: Optional[str] = None


# =============================================================================
# CUENTAS DE AHORRO
# =============================================================================

class CuentaResponse(BaseModel):
    """Información completa de una cuenta de ahorro."""
    id: UUID
    numero_cuenta: str
    tipo_cuenta: str
    saldo: Decimal
    moneda: str
    estado: str
    tasa_interes_anual: Optional[Decimal]
    fecha_creacion: datetime

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: float(v)}
    }


class CrearCuentaRequest(BaseModel):
    """Para que un admin/analista cree una cuenta a un cliente."""
    usuario_id: UUID
    tipo_cuenta: Literal[
        "ahorros_libre",
        "ahorros_plazo_fijo",
        "cuenta_corriente",
        "cuenta_remuneraciones"
    ] = "ahorros_libre"
    moneda: Literal["PEN", "USD"] = "PEN"
    saldo_inicial: Decimal = Field(default=Decimal("0.00"), ge=0)


class DashboardResponse(BaseModel):
    """Datos del dashboard del cliente home banking."""
    usuario: UsuarioResponse
    cuentas: List[CuentaResponse]
    saldo_total_pen: Decimal
    saldo_total_usd: Decimal
    ultimos_movimientos: List["MovimientoResponse"]
    creditos_activos: int
    proxima_cuota: Optional["ProximaCuotaInfo"]

    model_config = {"json_encoders": {Decimal: lambda v: float(v)}}


# =============================================================================
# MOVIMIENTOS / TRANSACCIONES
# =============================================================================

class MovimientoResponse(BaseModel):
    """Respuesta de un movimiento/transacción."""
    id: UUID
    tipo: str
    monto: Decimal
    saldo_anterior: Decimal
    saldo_posterior: Decimal
    descripcion: Optional[str]
    referencia: str
    canal: Optional[str]
    fecha: datetime

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: float(v)}
    }


class DepositoRequest(BaseModel):
    """Solicitud de depósito a una cuenta."""
    cuenta_id: UUID = Field(..., description="ID de la cuenta destino")
    monto: Decimal = Field(..., gt=0, le=100000, description="Monto a depositar (máx 100,000)")
    descripcion: Optional[str] = Field(None, max_length=200)

    model_config = {"json_schema_extra": {"example": {
        "cuenta_id": "550e8400-e29b-41d4-a716-446655440000",
        "monto": 500.00,
        "descripcion": "Depósito en ventanilla"
    }}}


class RetiroRequest(BaseModel):
    """Solicitud de retiro de una cuenta."""
    cuenta_id: UUID
    monto: Decimal = Field(..., gt=0)
    descripcion: Optional[str] = Field(None, max_length=200)


class TransferenciaRequest(BaseModel):
    """Solicitud de transferencia entre cuentas."""
    cuenta_origen_id: UUID = Field(..., description="Cuenta desde donde se transfiere")
    cuenta_destino_numero: str = Field(..., description="Número de cuenta destino")
    monto: Decimal = Field(..., gt=0, le=50000)
    descripcion: Optional[str] = Field(None, max_length=200)

    model_config = {"json_schema_extra": {"example": {
        "cuenta_origen_id": "550e8400-e29b-41d4-a716-446655440000",
        "cuenta_destino_numero": "0110-1234-56789012",
        "monto": 1500.00,
        "descripcion": "Pago de alquiler"
    }}}


class TransaccionExitosaResponse(BaseModel):
    """Respuesta exitosa de cualquier transacción."""
    movimiento_id: UUID
    referencia: str
    tipo: str
    monto: Decimal
    saldo_nuevo: Decimal
    fecha: datetime
    mensaje: str = "Operación realizada exitosamente"

    model_config = {"json_encoders": {Decimal: lambda v: float(v)}}


# =============================================================================
# CRÉDITOS - HOME BANKING (Vista cliente)
# =============================================================================

class SolicitudCreditoRequest(BaseModel):
    """Schema para que un cliente solicite un crédito."""
    monto_solicitado: Decimal = Field(..., gt=0, le=500000, description="Monto en PEN o USD")
    moneda: Literal["PEN", "USD"] = "PEN"
    plazo_meses: int = Field(..., ge=3, le=84, description="Plazo entre 3 y 84 meses")
    proposito: str = Field(..., min_length=10, max_length=100,
                           description="Propósito del crédito (ej: Capital de trabajo, Vehicular)")
    cuenta_desembolso_id: UUID = Field(..., description="Cuenta donde se depositará el crédito")

    model_config = {"json_schema_extra": {"example": {
        "monto_solicitado": 20000.00,
        "moneda": "PEN",
        "plazo_meses": 24,
        "proposito": "Capital de trabajo para negocio",
        "cuenta_desembolso_id": "550e8400-e29b-41d4-a716-446655440000"
    }}}


class CreditoResponse(BaseModel):
    """Respuesta con datos de un crédito."""
    id: UUID
    numero_credito: str
    monto_solicitado: Decimal
    monto_aprobado: Optional[Decimal]
    moneda: str
    estado: str
    tasa_interes: Decimal
    tasa_tipo: str
    plazo_meses: int
    proposito: Optional[str]
    observaciones: Optional[str]
    fecha_solicitud: datetime
    fecha_decision: Optional[datetime]
    fecha_desembolso: Optional[datetime]

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: float(v)}
    }


class CuotaResponse(BaseModel):
    """Información de una cuota del cronograma de pagos."""
    id: UUID
    numero_cuota: int
    monto_cuota: Decimal
    monto_capital: Decimal
    monto_interes: Decimal
    saldo_capital: Decimal
    fecha_vencimiento: date
    fecha_pago: Optional[datetime]
    monto_pagado: Optional[Decimal]
    estado: str

    model_config = {
        "from_attributes": True,
        "json_encoders": {Decimal: lambda v: float(v)}
    }


class ProximaCuotaInfo(BaseModel):
    """Resumen de próxima cuota a pagar (para dashboard)."""
    credito_id: UUID
    numero_credito: str
    numero_cuota: int
    monto_cuota: Decimal
    fecha_vencimiento: date
    dias_para_vencer: int

    model_config = {"json_encoders": {Decimal: lambda v: float(v)}}


# =============================================================================
# CORE BANCARIO (Vista analista/comité)
# =============================================================================

class AsignarAnalistaRequest(BaseModel):
    """Para asignar un analista a una solicitud."""
    analista_id: UUID
    observaciones: Optional[str] = Field(None, max_length=500)


class EvaluacionCreditoRequest(BaseModel):
    """Resultado de la evaluación del analista."""
    score_crediticio: int = Field(..., ge=0, le=999)
    tasa_interes_propuesta: Decimal = Field(..., gt=0, le=200)
    monto_aprobado_propuesto: Optional[Decimal] = Field(None, gt=0)
    plazo_meses_propuesto: Optional[int] = Field(None, ge=1, le=120)
    recomendacion: Literal["aprobar", "rechazar", "escalar_comite"]
    observaciones: str = Field(..., min_length=20, max_length=1000,
                               description="Análisis detallado del analista")

    model_config = {"json_schema_extra": {"example": {
        "score_crediticio": 720,
        "tasa_interes_propuesta": 18.5,
        "monto_aprobado_propuesto": 18000.00,
        "plazo_meses_propuesto": 24,
        "recomendacion": "aprobar",
        "observaciones": "Cliente con historial crediticio positivo, ingresos estables verificados."
    }}}


class DecisionComiteRequest(BaseModel):
    """Decisión final del comité crediticio."""
    decision: Literal["aprobado", "rechazado"]
    monto_aprobado: Optional[Decimal] = Field(None, gt=0)
    tasa_interes_final: Optional[Decimal] = Field(None, gt=0, le=200)
    plazo_meses_final: Optional[int] = Field(None, ge=1, le=120)
    motivo_rechazo: Optional[str] = Field(None, max_length=500)
    observaciones: Optional[str] = Field(None, max_length=500)

    @field_validator("monto_aprobado")
    @classmethod
    def validar_monto_si_aprobado(cls, v, values):
        return v


class DesembolsoRequest(BaseModel):
    """Para ejecutar el desembolso de un crédito aprobado."""
    confirmar: bool = Field(..., description="Debe ser True para confirmar el desembolso")
    observaciones: Optional[str] = Field(None, max_length=300)


# =============================================================================
# REPORTES DEL CORE BANCARIO
# =============================================================================

class ResumenCarteraResponse(BaseModel):
    """KPIs de la cartera de créditos activa."""
    total_creditos_activos: int
    monto_total_desembolsado: Decimal
    monto_total_pendiente_cobro: Decimal
    creditos_en_evaluacion: int
    creditos_en_mora: int
    tasa_morosidad: float  # Porcentaje
    desembolsos_hoy: int
    monto_desembolsado_hoy: Decimal

    model_config = {"json_encoders": {Decimal: lambda v: float(v)}}


class CreditoCarteraItem(BaseModel):
    """Item de crédito en reporte de cartera."""
    id: UUID
    numero_credito: str
    cliente: str
    dni: str
    monto_aprobado: Optional[Decimal]
    moneda: str
    estado: str
    tasa_interes: Decimal
    plazo_meses: int
    fecha_solicitud: datetime
    fecha_desembolso: Optional[datetime]
    cuotas_pendientes: Optional[int]
    cuotas_vencidas: Optional[int]
    analista: Optional[str]

    model_config = {"json_encoders": {Decimal: lambda v: float(v)}}


class PaginatedResponse(BaseModel):
    """Wrapper genérico para respuestas paginadas."""
    items: list
    total: int
    pagina: int
    por_pagina: int
    total_paginas: int


# =============================================================================
# RESPUESTAS GENÉRICAS
# =============================================================================

class MensajeResponse(BaseModel):
    """Respuesta simple de confirmación."""
    mensaje: str
    codigo: Optional[str] = None


class ErrorResponse(BaseModel):
    """Estructura estándar de errores de la API."""
    error: str
    detalle: Optional[str] = None
    codigo: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)