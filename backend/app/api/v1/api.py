# app/api/v1/api.py
from fastapi import APIRouter
from app.api.v1.endpoints import auth, ahorros, creditos  # Importamos los tres módulos

api_router = APIRouter()

# 1. Rutas de Autenticación (Prefijo: /auth)
api_router.include_router(auth.router)

# 2. Rutas de Ahorros y Dashboard (Prefijo: /cuentas)
api_router.include_router(ahorros.router)

# 3. Rutas del Core Bancario - Créditos (Prefijo: /creditos)
api_router.include_router(creditos.router)