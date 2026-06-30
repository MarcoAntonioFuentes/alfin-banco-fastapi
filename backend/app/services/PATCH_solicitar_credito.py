# =============================================================================
# PARCHE: app/services/creditos_service.py — método solicitar_credito
# Agrega: cálculo automático de RDS, nivel_aprobacion y validación por producto
#
# INSTRUCCIÓN: En tu creditos_service.py actual, REEMPLAZA el método
# solicitar_credito() completo con este código.
# =============================================================================

# ─── Pegar dentro de la clase CreditosService ────────────────────────────────

    async def solicitar_credito(
        self, auth_user_id: str, data  # data es SolicitudCreditoRequest
    ):
        """
        Solicitud de crédito con validación RDS y nivel de aprobación automático.
        Versión actualizada — incluye cálculo de RDS y producto.
        """
        from app.services.mora_service import MoraService, calcular_nivel_aprobacion

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

        # Verificar solicitudes pendientes (máx 2)
        pendientes = await self.db.execute(
            text("""
                SELECT COUNT(*) FROM creditos
                WHERE usuario_id = :uid
                  AND estado IN ('enviado', 'en_evaluacion', 'en_comite')
            """),
            {"uid": usuario_id}
        )
        if (pendientes.scalar() or 0) >= 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya tiene 2 solicitudes en proceso. Espere a que se resuelvan."
            )

        # ── Obtener reglas del producto ────────────────────────────────────
        producto_codigo = getattr(data, 'producto', 'consumo') or 'consumo'

        prod_result = await self.db.execute(
            text("""
                SELECT tasa_default_tea, umbral_analista, umbral_comite,
                       rds_maximo, score_minimo, monto_minimo, monto_maximo,
                       plazo_min_meses, plazo_max_meses
                FROM productos_credito
                WHERE codigo = UPPER(:codigo) AND activo = TRUE
            """),
            {"codigo": producto_codigo}
        )
        producto = prod_result.fetchone()

        # Tasa por defecto según producto o propósito
        if producto:
            tasa_default = float(producto.tasa_default_tea)
            # Validar rango de monto
            if float(data.monto_solicitado) < float(producto.monto_minimo):
                raise HTTPException(status_code=400,
                    detail=f"Monto mínimo para {producto_codigo}: S/ {producto.monto_minimo:,.2f}")
            if float(data.monto_solicitado) > float(producto.monto_maximo):
                raise HTTPException(status_code=400,
                    detail=f"Monto máximo para {producto_codigo}: S/ {producto.monto_maximo:,.2f}")
        else:
            tasa_refs = {
                'consumo': 20.0, 'hipotecario': 10.5,
                'vehicular': 15.0, 'microempresa': 22.0,
            }
            tasa_default = tasa_refs.get(producto_codigo, 20.0)

        # ── Calcular RDS ───────────────────────────────────────────────────
        ingreso_mensual      = float(getattr(data, 'ingreso_mensual', 0) or 0)
        deuda_mensual_actual = float(getattr(data, 'deuda_mensual_actual', 0) or 0)
        monto                = float(data.monto_solicitado)
        plazo                = int(data.plazo_meses)

        rds_calculado = None
        rds_semaforo  = None

        if ingreso_mensual > 0:
            try:
                rds_data = MoraService.calcular_rds(
                    ingreso_mensual=ingreso_mensual,
                    deuda_mensual_actual=deuda_mensual_actual,
                    monto_nuevo=monto,
                    tasa_tea=tasa_default,
                    plazo_meses=plazo
                )
                rds_calculado = rds_data['rds']
                rds_semaforo  = rds_data['semaforo']
            except Exception:
                pass  # RDS no bloquea la solicitud, solo informa

        # ── Nivel de aprobación según monto y producto ─────────────────────
        nivel_aprobacion = calcular_nivel_aprobacion(monto, producto_codigo)

        try:
            result = await self.db.execute(
                text("""
                    INSERT INTO creditos (
                        usuario_id, cuenta_desembolso_id, monto_solicitado, moneda,
                        plazo_meses, proposito, producto,
                        tasa_interes, tasa_tipo, estado,
                        ingreso_mensual, deuda_mensual_actual,
                        rds_calculado, rds_semaforo, nivel_aprobacion
                    ) VALUES (
                        :uid, :cuenta_id, :monto, :moneda,
                        :plazo, :proposito, :producto,
                        :tasa, 'TEA', 'enviado',
                        :ingreso, :deuda,
                        :rds, :semaforo, :nivel
                    )
                    RETURNING *
                """),
                {
                    "uid":        usuario_id,
                    "cuenta_id":  str(data.cuenta_desembolso_id),
                    "monto":      monto,
                    "moneda":     data.moneda,
                    "plazo":      plazo,
                    "proposito":  data.proposito,
                    "producto":   producto_codigo,
                    "tasa":       tasa_default,
                    "ingreso":    ingreso_mensual if ingreso_mensual > 0 else None,
                    "deuda":      deuda_mensual_actual if deuda_mensual_actual > 0 else None,
                    "rds":        rds_calculado,
                    "semaforo":   rds_semaforo,
                    "nivel":      nivel_aprobacion,
                }
            )
            credito = result.fetchone()
            await self.db.commit()

            logger.info(
                f"Nueva solicitud: {credito.numero_credito} | "
                f"Producto: {producto_codigo} | Monto: {monto} | "
                f"RDS: {rds_calculado}% ({rds_semaforo}) | "
                f"Nivel: {nivel_aprobacion}"
            )

            return self._row_to_credito_response(credito)

        except HTTPException:
            raise
        except Exception as exc:
            await self.db.rollback()
            logger.error(f"Error en solicitar_credito: {exc}")
            raise HTTPException(
                status_code=500,
                detail="Error al registrar la solicitud de crédito."
            )
