# =============================================================================
# app/api/v1/router.py  — VERSIÓN ACTUALIZADA
# Agrega el módulo de mora al router existente
# Reemplaza tu router.py actual con este archivo
# =============================================================================

from fastapi import APIRouter
from app.api.v1.endpoints import auth, ahorros, creditos, mora

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(ahorros.router)
api_router.include_router(creditos.router)
api_router.include_router(mora.router)   # ← NUEVO
