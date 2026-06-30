-- =============================================================================
-- ALFIN BANCO - Script de Base de Datos para Supabase
-- Versión: 1.0.0
-- Descripción: Schema completo del Core Bancario y Home Banking
-- Ejecutar en: Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONES NECESARIAS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- LIMPIEZA (opcional para re-ejecución en entorno de desarrollo)
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS cronograma_pagos CASCADE;
DROP TABLE IF EXISTS creditos CASCADE;
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS cuentas_ahorros CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- =============================================================================
-- TABLA: usuarios
-- Vinculada a auth.users de Supabase para autenticación
-- =============================================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    nombre_completo VARCHAR(200) NOT NULL,
    dni             VARCHAR(8)   NOT NULL UNIQUE,
    telefono        VARCHAR(15),
    direccion       TEXT,
    fecha_nacimiento DATE,
    estado          VARCHAR(20)  NOT NULL DEFAULT 'activo'
                        CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
    rol             VARCHAR(20)  NOT NULL DEFAULT 'cliente'
                        CHECK (rol IN ('cliente', 'analista', 'comite', 'admin')),
    fecha_registro  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dni_formato CHECK (dni ~ '^\d{8}$'),
    CONSTRAINT chk_email_formato CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

COMMENT ON TABLE usuarios IS 'Tabla de usuarios del sistema, vinculada a Supabase Auth';
COMMENT ON COLUMN usuarios.auth_user_id IS 'FK hacia auth.users de Supabase';
COMMENT ON COLUMN usuarios.rol IS 'cliente: home banking | analista: evalúa créditos | comite: aprueba créditos | admin: gestión total';

-- =============================================================================
-- TABLA: cuentas_ahorros
-- Cada usuario puede tener múltiples cuentas
-- =============================================================================
CREATE TABLE cuentas_ahorros (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    numero_cuenta   VARCHAR(20) NOT NULL UNIQUE,
    saldo           NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    tipo_cuenta     VARCHAR(30) NOT NULL DEFAULT 'ahorros_libre'
                        CHECK (tipo_cuenta IN (
                            'ahorros_libre',
                            'ahorros_plazo_fijo',
                            'cuenta_corriente',
                            'cuenta_remuneraciones'
                        )),
    moneda          VARCHAR(3) NOT NULL DEFAULT 'PEN'
                        CHECK (moneda IN ('PEN', 'USD')),
    estado          VARCHAR(20) NOT NULL DEFAULT 'activa'
                        CHECK (estado IN ('activa', 'bloqueada', 'cerrada')),
    tasa_interes_anual NUMERIC(5, 2) DEFAULT 0.00,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_saldo_no_negativo CHECK (saldo >= 0),
    CONSTRAINT chk_tasa_valida CHECK (tasa_interes_anual >= 0 AND tasa_interes_anual <= 100)
);

COMMENT ON TABLE cuentas_ahorros IS 'Cuentas de ahorro y corrientes de los clientes';
COMMENT ON COLUMN cuentas_ahorros.numero_cuenta IS 'Número de cuenta bancario único (ej: 0000-1234-56789012)';

-- =============================================================================
-- TABLA: movimientos
-- Registro inmutable de todas las transacciones
-- =============================================================================
CREATE TABLE movimientos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cuenta_id       UUID NOT NULL REFERENCES cuentas_ahorros(id) ON DELETE RESTRICT,
    cuenta_destino_id UUID REFERENCES cuentas_ahorros(id) ON DELETE RESTRICT,
    tipo            VARCHAR(30) NOT NULL
                        CHECK (tipo IN (
                            'deposito',
                            'retiro',
                            'transferencia_salida',
                            'transferencia_entrada',
                            'pago_credito',
                            'cargo_comision',
                            'abono_interes',
                            'desembolso_credito'
                        )),
    monto           NUMERIC(15, 2) NOT NULL,
    saldo_anterior  NUMERIC(15, 2) NOT NULL,
    saldo_posterior NUMERIC(15, 2) NOT NULL,
    descripcion     TEXT,
    referencia      VARCHAR(50) UNIQUE DEFAULT ('TXN-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 12))),
    canal           VARCHAR(30) DEFAULT 'web'
                        CHECK (canal IN ('web', 'mobile', 'ventanilla', 'cajero', 'sistema')),
    ip_origen       VARCHAR(45),
    fecha           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_monto_positivo CHECK (monto > 0),
    CONSTRAINT chk_transferencia_tiene_destino
        CHECK (
            (tipo IN ('transferencia_salida', 'transferencia_entrada') AND cuenta_destino_id IS NOT NULL)
            OR tipo NOT IN ('transferencia_salida', 'transferencia_entrada')
        )
);

COMMENT ON TABLE movimientos IS 'Libro mayor de transacciones - registro inmutable';
COMMENT ON COLUMN movimientos.referencia IS 'Código único de transacción para trazabilidad';

-- =============================================================================
-- TABLA: creditos
-- Solicitudes y estado del ciclo de vida crediticio
-- =============================================================================
CREATE TABLE creditos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    cuenta_desembolso_id UUID REFERENCES cuentas_ahorros(id) ON DELETE RESTRICT,
    numero_credito      VARCHAR(20) UNIQUE DEFAULT ('CRED-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0')),
    monto_solicitado    NUMERIC(15, 2) NOT NULL,
    monto_aprobado      NUMERIC(15, 2),
    moneda              VARCHAR(3) NOT NULL DEFAULT 'PEN'
                            CHECK (moneda IN ('PEN', 'USD')),
    estado              VARCHAR(30) NOT NULL DEFAULT 'enviado'
                            CHECK (estado IN (
                                'enviado',
                                'en_evaluacion',
                                'en_comite',
                                'aprobado',
                                'rechazado',
                                'desembolsado',
                                'cancelado',
                                'pagado'
                            )),
    proposito           VARCHAR(100),
    tasa_interes        NUMERIC(5, 2) NOT NULL,
    tasa_tipo           VARCHAR(10) NOT NULL DEFAULT 'TEA'
                            CHECK (tasa_tipo IN ('TEM', 'TEA', 'TNM', 'TNA')),
    plazo_meses         INTEGER NOT NULL,
    analista_id         UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    comite_aprobador_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    observaciones       TEXT,
    motivo_rechazo      TEXT,
    score_crediticio    INTEGER CHECK (score_crediticio BETWEEN 0 AND 999),
    fecha_solicitud     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_evaluacion    TIMESTAMPTZ,
    fecha_decision      TIMESTAMPTZ,
    fecha_desembolso    TIMESTAMPTZ,
    fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_monto_solicitado_positivo CHECK (monto_solicitado > 0),
    CONSTRAINT chk_plazo_valido CHECK (plazo_meses BETWEEN 1 AND 120),
    CONSTRAINT chk_tasa_valida CHECK (tasa_interes > 0 AND tasa_interes <= 200),
    CONSTRAINT chk_monto_aprobado_valido CHECK (monto_aprobado IS NULL OR monto_aprobado > 0)
);

COMMENT ON TABLE creditos IS 'Solicitudes de crédito con ciclo de vida completo (workflow de aprobación)';
COMMENT ON COLUMN creditos.estado IS 'Flujo: enviado → en_evaluacion → en_comite → aprobado/rechazado → desembolsado → pagado';

-- =============================================================================
-- TABLA: cronograma_pagos
-- Cuotas generadas al aprobar un crédito
-- =============================================================================
CREATE TABLE cronograma_pagos (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credito_id          UUID NOT NULL REFERENCES creditos(id) ON DELETE CASCADE,
    numero_cuota        INTEGER NOT NULL,
    monto_cuota         NUMERIC(15, 2) NOT NULL,
    monto_capital       NUMERIC(15, 2) NOT NULL,
    monto_interes       NUMERIC(15, 2) NOT NULL,
    saldo_capital       NUMERIC(15, 2) NOT NULL,
    fecha_vencimiento   DATE NOT NULL,
    fecha_pago          TIMESTAMPTZ,
    monto_pagado        NUMERIC(15, 2),
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'pagado', 'vencido', 'refinanciado')),
    movimiento_id       UUID REFERENCES movimientos(id) ON DELETE SET NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_numero_cuota_positivo CHECK (numero_cuota > 0),
    CONSTRAINT chk_monto_cuota_positivo CHECK (monto_cuota > 0),
    CONSTRAINT chk_monto_capital_positivo CHECK (monto_capital >= 0),
    CONSTRAINT chk_monto_interes_positivo CHECK (monto_interes >= 0),
    CONSTRAINT uq_credito_cuota UNIQUE (credito_id, numero_cuota)
);

COMMENT ON TABLE cronograma_pagos IS 'Tabla de amortización (cronograma) generada al desembolsar un crédito';

-- =============================================================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- =============================================================================

-- Usuarios
CREATE INDEX idx_usuarios_auth_user_id ON usuarios(auth_user_id);
CREATE INDEX idx_usuarios_dni ON usuarios(dni);
CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_rol ON usuarios(rol);

-- Cuentas de Ahorro
CREATE INDEX idx_cuentas_usuario_id ON cuentas_ahorros(usuario_id);
CREATE INDEX idx_cuentas_numero ON cuentas_ahorros(numero_cuenta);
CREATE INDEX idx_cuentas_estado ON cuentas_ahorros(estado);

-- Movimientos
CREATE INDEX idx_movimientos_cuenta_id ON movimientos(cuenta_id);
CREATE INDEX idx_movimientos_fecha ON movimientos(fecha DESC);
CREATE INDEX idx_movimientos_tipo ON movimientos(tipo);
CREATE INDEX idx_movimientos_referencia ON movimientos(referencia);

-- Créditos
CREATE INDEX idx_creditos_usuario_id ON creditos(usuario_id);
CREATE INDEX idx_creditos_estado ON creditos(estado);
CREATE INDEX idx_creditos_analista_id ON creditos(analista_id);
CREATE INDEX idx_creditos_fecha_solicitud ON creditos(fecha_solicitud DESC);

-- Cronograma
CREATE INDEX idx_cronograma_credito_id ON cronograma_pagos(credito_id);
CREATE INDEX idx_cronograma_estado ON cronograma_pagos(estado);
CREATE INDEX idx_cronograma_fecha_vencimiento ON cronograma_pagos(fecha_vencimiento);

-- =============================================================================
-- FUNCIÓN: Actualizar timestamp automáticamente
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers de actualización automática
CREATE TRIGGER trg_usuarios_updated
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_cuentas_updated
    BEFORE UPDATE ON cuentas_ahorros
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TRIGGER trg_creditos_updated
    BEFORE UPDATE ON creditos
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

-- =============================================================================
-- FUNCIÓN: Generar número de cuenta único
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_generar_numero_cuenta()
RETURNS TEXT AS $$
DECLARE
    v_numero TEXT;
    v_existe BOOLEAN;
BEGIN
    LOOP
        -- Formato: 0110-XXXX-XXXXXXXX (estilo BCP/Interbank)
        v_numero := '0110-' ||
                    LPAD(FLOOR(RANDOM() * 9999)::TEXT, 4, '0') || '-' ||
                    LPAD(FLOOR(RANDOM() * 99999999)::TEXT, 8, '0');

        SELECT EXISTS(SELECT 1 FROM cuentas_ahorros WHERE numero_cuenta = v_numero)
        INTO v_existe;

        EXIT WHEN NOT v_existe;
    END LOOP;
    RETURN v_numero;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- FUNCIÓN: Procesar transacción (atómica con bloqueo de fila)
-- Garantiza consistencia en depósitos, retiros y transferencias
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_procesar_transaccion(
    p_cuenta_id         UUID,
    p_tipo              VARCHAR,
    p_monto             NUMERIC,
    p_descripcion       TEXT,
    p_canal             VARCHAR DEFAULT 'web',
    p_ip_origen         VARCHAR DEFAULT NULL,
    p_cuenta_destino_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_saldo_anterior    NUMERIC;
    v_saldo_posterior   NUMERIC;
    v_movimiento_id     UUID;
    v_saldo_destino_ant NUMERIC;
    v_movimiento_dest   UUID;
BEGIN
    -- Bloquear la fila de la cuenta origen para evitar race conditions
    SELECT saldo INTO v_saldo_anterior
    FROM cuentas_ahorros
    WHERE id = p_cuenta_id AND estado = 'activa'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CUENTA_NO_ENCONTRADA: La cuenta % no existe o está inactiva', p_cuenta_id;
    END IF;

    -- Calcular saldo resultante
    IF p_tipo IN ('deposito', 'transferencia_entrada', 'abono_interes', 'desembolso_credito') THEN
        v_saldo_posterior := v_saldo_anterior + p_monto;
    ELSIF p_tipo IN ('retiro', 'transferencia_salida', 'pago_credito', 'cargo_comision') THEN
        IF v_saldo_anterior < p_monto THEN
            RAISE EXCEPTION 'SALDO_INSUFICIENTE: Saldo %.2f insuficiente para operación de %.2f',
                v_saldo_anterior, p_monto;
        END IF;
        v_saldo_posterior := v_saldo_anterior - p_monto;
    ELSE
        RAISE EXCEPTION 'TIPO_INVALIDO: Tipo de movimiento % no reconocido', p_tipo;
    END IF;

    -- Actualizar saldo cuenta origen
    UPDATE cuentas_ahorros SET saldo = v_saldo_posterior WHERE id = p_cuenta_id;

    -- Registrar movimiento origen
    INSERT INTO movimientos (
        cuenta_id, cuenta_destino_id, tipo, monto,
        saldo_anterior, saldo_posterior, descripcion, canal, ip_origen
    ) VALUES (
        p_cuenta_id, p_cuenta_destino_id, p_tipo, p_monto,
        v_saldo_anterior, v_saldo_posterior, p_descripcion, p_canal, p_ip_origen
    ) RETURNING id INTO v_movimiento_id;

    -- Si es transferencia, procesar cuenta destino
    IF p_tipo = 'transferencia_salida' AND p_cuenta_destino_id IS NOT NULL THEN
        SELECT saldo INTO v_saldo_destino_ant
        FROM cuentas_ahorros
        WHERE id = p_cuenta_destino_id AND estado = 'activa'
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'CUENTA_DESTINO_INVALIDA: La cuenta destino % no existe o está inactiva',
                p_cuenta_destino_id;
        END IF;

        UPDATE cuentas_ahorros
        SET saldo = v_saldo_destino_ant + p_monto
        WHERE id = p_cuenta_destino_id;

        INSERT INTO movimientos (
            cuenta_id, cuenta_destino_id, tipo, monto,
            saldo_anterior, saldo_posterior, descripcion, canal, ip_origen
        ) VALUES (
            p_cuenta_destino_id, p_cuenta_id, 'transferencia_entrada', p_monto,
            v_saldo_destino_ant, v_saldo_destino_ant + p_monto,
            'Transferencia recibida - ' || COALESCE(p_descripcion, ''),
            'sistema', p_ip_origen
        ) RETURNING id INTO v_movimiento_dest;
    END IF;

    RETURN v_movimiento_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Seguridad a nivel de fila
-- =============================================================================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_ahorros ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE creditos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma_pagos ENABLE ROW LEVEL SECURITY;

-- Política: Un cliente solo ve sus propios datos
CREATE POLICY pol_usuario_propio ON usuarios
    FOR ALL USING (auth.uid() = auth_user_id);

-- Política: Cliente solo ve sus propias cuentas
CREATE POLICY pol_cuenta_propia ON cuentas_ahorros
    FOR SELECT USING (
        usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
    );

-- Política: Analistas y admins ven todo
CREATE POLICY pol_staff_cuentas ON cuentas_ahorros
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
            WHERE auth_user_id = auth.uid()
            AND rol IN ('analista', 'comite', 'admin')
        )
    );

-- Política: Cliente solo ve movimientos de sus cuentas
CREATE POLICY pol_movimientos_propios ON movimientos
    FOR SELECT USING (
        cuenta_id IN (
            SELECT ca.id FROM cuentas_ahorros ca
            JOIN usuarios u ON u.id = ca.usuario_id
            WHERE u.auth_user_id = auth.uid()
        )
    );

-- Política: Staff puede insertar movimientos (via funciones)
CREATE POLICY pol_movimientos_sistema ON movimientos
    FOR INSERT WITH CHECK (true); -- Controlado por fn_procesar_transaccion

-- Política: Cliente ve sus propios créditos
CREATE POLICY pol_creditos_propios ON creditos
    FOR SELECT USING (
        usuario_id = (SELECT id FROM usuarios WHERE auth_user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE auth_user_id = auth.uid()
            AND rol IN ('analista', 'comite', 'admin')
        )
    );

-- Política: Cronograma visible según acceso al crédito
CREATE POLICY pol_cronograma ON cronograma_pagos
    FOR SELECT USING (
        credito_id IN (
            SELECT c.id FROM creditos c
            JOIN usuarios u ON u.id = c.usuario_id
            WHERE u.auth_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM usuarios
            WHERE auth_user_id = auth.uid()
            AND rol IN ('analista', 'comite', 'admin')
        )
    );

-- =============================================================================
-- DATOS SEMILLA (Seed Data) para desarrollo y pruebas
-- =============================================================================

-- Nota: Los usuarios reales se crean primero en Supabase Auth.
-- Estos son datos de ejemplo para desarrollo local.

-- Insertar usuario de prueba (el auth_user_id se actualiza después de crear en Auth)
INSERT INTO usuarios (email, nombre_completo, dni, telefono, rol, estado)
VALUES
    ('admin@alfinbanco.pe', 'Administrador Sistema', '12345678', '999000001', 'admin', 'activo'),
    ('analista1@alfinbanco.pe', 'María García Torres', '23456789', '999000002', 'analista', 'activo'),
    ('comite1@alfinbanco.pe', 'Roberto Díaz Ríos', '34567890', '999000003', 'comite', 'activo'),
    ('cliente1@alfinbanco.pe', 'Juan Pérez López', '45678901', '987654321', 'cliente', 'activo');

-- Vistas útiles para reportes
-- =============================================================================

-- Vista: Dashboard del cliente
CREATE OR REPLACE VIEW v_dashboard_cliente AS
SELECT
    u.id AS usuario_id,
    u.nombre_completo,
    u.email,
    ca.id AS cuenta_id,
    ca.numero_cuenta,
    ca.tipo_cuenta,
    ca.saldo,
    ca.moneda,
    ca.estado AS estado_cuenta
FROM usuarios u
LEFT JOIN cuentas_ahorros ca ON ca.usuario_id = u.id AND ca.estado = 'activa';

-- Vista: Cartera activa de créditos (para analistas)
CREATE OR REPLACE VIEW v_cartera_activa AS
SELECT
    c.id,
    c.numero_credito,
    u.nombre_completo AS cliente,
    u.dni,
    c.monto_solicitado,
    c.monto_aprobado,
    c.moneda,
    c.estado,
    c.tasa_interes,
    c.tasa_tipo,
    c.plazo_meses,
    c.proposito,
    c.fecha_solicitud,
    c.fecha_desembolso,
    an.nombre_completo AS analista,
    com.nombre_completo AS comite_aprobador,
    -- Cuotas pendientes
    (SELECT COUNT(*) FROM cronograma_pagos cp
     WHERE cp.credito_id = c.id AND cp.estado = 'pendiente') AS cuotas_pendientes,
    (SELECT COUNT(*) FROM cronograma_pagos cp
     WHERE cp.credito_id = c.id AND cp.estado = 'vencido') AS cuotas_vencidas
FROM creditos c
JOIN usuarios u ON u.id = c.usuario_id
LEFT JOIN usuarios an ON an.id = c.analista_id
LEFT JOIN usuarios com ON com.id = c.comite_aprobador_id
WHERE c.estado NOT IN ('cancelado', 'rechazado');

-- Vista: Desembolsos del día
CREATE OR REPLACE VIEW v_desembolsos_dia AS
SELECT
    c.id,
    c.numero_credito,
    u.nombre_completo AS cliente,
    u.dni,
    c.monto_aprobado,
    c.moneda,
    c.tasa_interes,
    c.plazo_meses,
    c.fecha_desembolso,
    com.nombre_completo AS aprobado_por
FROM creditos c
JOIN usuarios u ON u.id = c.usuario_id
LEFT JOIN usuarios com ON com.id = c.comite_aprobador_id
WHERE c.estado = 'desembolsado'
  AND DATE(c.fecha_desembolso AT TIME ZONE 'America/Lima') = CURRENT_DATE;

COMMENT ON VIEW v_cartera_activa IS 'Cartera de créditos activos para reportes del core bancario';
COMMENT ON VIEW v_desembolsos_dia IS 'Créditos desembolsados en el día actual (hora Lima)';