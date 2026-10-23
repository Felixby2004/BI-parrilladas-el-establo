-- Extensiones aditivas sobre el esquema canónico.
-- Motivo: la API actual (y por tanto el frontend) expone campos que el esquema
-- de SQL Server no tiene. Todas las columnas son nullable o tienen default,
-- para no romper la carga de datos históricos ni los INSERT del BI.
--
-- Regla: nunca se renombra ni se elimina una columna canónica. El mapper de la
-- aplicación traduce. Ver docs/MIGRACION_JSON.md.

SET client_min_messages = warning;

-- ── buyers / buyer_personas ─────────────────────────────────────
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS etapa_impulse varchar(20) DEFAULT 'buyer';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS utm_source varchar(100);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS utm_medium varchar(100);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS utm_campaign varchar(100);
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS apellido varchar(100);
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS descripcion varchar(250);
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS edad_min smallint;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS edad_max smallint;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS intereses text;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS motivaciones text;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS canales_preferidos text;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS activo boolean DEFAULT true;
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE buyer_personas ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── captación y leads ───────────────────────────────────────────
-- La API no pide red social al crear una campaña; se relaja la obligatoriedad
-- del canónico sin tocar el resto de su integridad.
ALTER TABLE campanas ALTER COLUMN id_red_social DROP NOT NULL;
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS descripcion varchar(250);
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS objetivo varchar(30);
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS presupuesto_total numeric(12,2);
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS presupuesto_gastado numeric(12,2) DEFAULT 0;
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS id_buyer_persona uuid REFERENCES buyer_personas(id_persona);
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS estado_impulse varchar(20) DEFAULT 'borrador';
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE campanas ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS imagen_url text;
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS plataforma varchar(30);
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS url_destino text;
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS impresiones integer DEFAULT 0;
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS clics integer DEFAULT 0;
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS estado_impulse varchar(20) DEFAULT 'borrador';
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE anuncios ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS email varchar(150);
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS mensaje text;
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS personas_aproximadas integer;
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS fecha_preferida date;
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS canal varchar(50);
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS utm_source varchar(100);
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS utm_medium varchar(100);
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS utm_campaign varchar(100);
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS procesado boolean DEFAULT false;
ALTER TABLE formularios_captacion ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE leads ADD COLUMN IF NOT EXISTS id_campana integer REFERENCES campanas(id_campana);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS id_formulario uuid REFERENCES formularios_captacion(id_formulario);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado varchar(20) DEFAULT 'nuevo';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interes_confirmado varchar(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS personas_estimadas integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_preferida date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS presupuesto_estimado numeric(12,2);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS motivo_perdida text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_contacto timestamp(0);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fecha_respuesta timestamp(0);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE leads ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── pedidos ─────────────────────────────────────────────────────
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS descuento numeric(12,2) DEFAULT 0;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estado_impulse varchar(30) DEFAULT 'pendiente';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_pedido_app varchar(20);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS termino_coccion varchar(30);
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS notas_especiales text;
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS nombre_producto varchar(120);
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS categoria varchar(30);
ALTER TABLE detalle_pedido ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- El DTO permite items libres (sin id_producto) con nombre propio.
ALTER TABLE detalle_pedido ALTER COLUMN id_producto DROP NOT NULL;

-- ── pagos y cobranza ────────────────────────────────────────────
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS id_lead uuid REFERENCES leads(id_lead);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS tipo_pago varchar(20) DEFAULT 'adelanto';
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS estado_app varchar(20) DEFAULT 'pendiente';
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS porcentaje numeric(5,2);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_preference_id varchar(255);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_payment_id varchar(255);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_status varchar(50);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_status_detail varchar(100);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_external_reference varchar(255);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS mp_init_point text;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS pagador_nombre varchar(150);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS pagador_email varchar(150);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- Mercado Pago no existe en el CHECK canónico. Sin esto el cobro no se puede
-- clasificar y el BI reporta un método incorrecto.
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS CK_pagos_metodo;
ALTER TABLE pagos ADD CONSTRAINT CK_pagos_metodo CHECK (
    metodo_pago IS NULL OR metodo_pago IN (
        'EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'MERCADO_PAGO', 'OTRO'
    )
);

ALTER TABLE payers ADD COLUMN IF NOT EXISTS id_pedido uuid REFERENCES pedidos(id_pedido);
ALTER TABLE payers ADD COLUMN IF NOT EXISTS id_buyer uuid REFERENCES buyers(id_buyer);
ALTER TABLE payers ADD COLUMN IF NOT EXISTS id_mesa integer REFERENCES mesas(id_mesa);
ALTER TABLE payers ADD COLUMN IF NOT EXISTS estado varchar(20) DEFAULT 'esperando';
ALTER TABLE payers ADD COLUMN IF NOT EXISTS fecha_llegada timestamp(0);
ALTER TABLE payers ADD COLUMN IF NOT EXISTS fecha_pago_saldo timestamp(0);
ALTER TABLE payers ADD COLUMN IF NOT EXISTS monto_adelanto_pagado numeric(12,2) DEFAULT 0;
ALTER TABLE payers ADD COLUMN IF NOT EXISTS monto_saldo numeric(12,2) DEFAULT 0;
ALTER TABLE payers ADD COLUMN IF NOT EXISTS total_pedido numeric(12,2) DEFAULT 0;
ALTER TABLE payers ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE payers ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE payers ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS id_payer uuid REFERENCES payers(id_payer);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS tipo_pago varchar(20);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS estado varchar(20) DEFAULT 'pendiente';
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS mp_payment_id varchar(255);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS mp_status varchar(50);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS mp_terminal_id varchar(100);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS referencia varchar(150);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS notas text;
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS procesado_por varchar(100);
ALTER TABLE instrucciones_pago ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE instrucciones_pago DROP CONSTRAINT IF EXISTS CK_instrucciones_canal;
ALTER TABLE instrucciones_pago ADD CONSTRAINT CK_instrucciones_canal CHECK (
    canal_pago IN (
        'EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'MERCADO_PAGO', 'OTRO'
    )
);

ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS id_payer uuid REFERENCES payers(id_payer);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS id_pedido uuid REFERENCES pedidos(id_pedido);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS folio varchar(50);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS subtotal numeric(12,2) DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS descuento numeric(12,2) DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS total numeric(12,2) DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS adelanto_aplicado numeric(12,2) DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS saldo_cobrado numeric(12,2) DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS metodo_pago_saldo varchar(30);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS generado_por varchar(100);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS cliente_nombre varchar(150);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS cliente_telefono varchar(30);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS observaciones text;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── salón ───────────────────────────────────────────────────────
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS descripcion varchar(250);
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS activa boolean DEFAULT true;
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE mesas ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE servicios ADD COLUMN IF NOT EXISTS id_parrillero integer REFERENCES personal(id_personal);
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS prioridad varchar(20) DEFAULT 'normal';
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS notas_cocina text;
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS estado_impulse varchar(20) DEFAULT 'en_espera';
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE servicios ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS id_detalle_pedido bigint REFERENCES detalle_pedido(id_detalle);
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS nombre_item varchar(150);
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS estado_item_app varchar(20);
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS termino_coccion varchar(30);
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS prioridad integer DEFAULT 3;
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS notas_cocina text;
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS tiempo_preparacion_min integer;
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE servicio_detalle ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE alertas_consumo ADD COLUMN IF NOT EXISTS tipo_alerta_app varchar(30);
ALTER TABLE alertas_consumo ADD COLUMN IF NOT EXISTS nivel varchar(20) DEFAULT 'info';
ALTER TABLE alertas_consumo ADD COLUMN IF NOT EXISTS atendida_por varchar(100);
ALTER TABLE alertas_consumo ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS id_buyer uuid REFERENCES buyers(id_buyer);
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS calificacion_comida smallint;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS calificacion_servicio smallint;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS calificacion_ambiente smallint;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS calificacion_precio smallint;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS recomendaria boolean;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS publicar boolean DEFAULT true;
ALTER TABLE resenas_servicio ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── perfiles ────────────────────────────────────────────────────
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS tipos_corte_preferidos text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS termino_coccion varchar(30);
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS bebidas_preferidas text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS entradas_preferidas text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS guarniciones_preferidas text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS postres_preferidos text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS alergias text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS restricciones_dieteticas text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS presupuesto_por_persona numeric(10,2);
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS notas_adicionales text;
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE perfil_gustos ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS hora_inicio time;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS hora_fin time;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS numero_adultos integer;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS numero_ninos integer;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS ocasion_especial varchar(100);
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS nombre_festejado varchar(150);
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS requiere_decoracion boolean DEFAULT false;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS requiere_musica boolean DEFAULT false;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS requiere_pastel boolean DEFAULT false;
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS estado_reserva varchar(20) DEFAULT 'tentativa';
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE perfil_reserva ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── chat (log real de mensajes, no resumen) ─────────────────────
ALTER TABLE sesiones_chat ADD COLUMN IF NOT EXISTS id_lead uuid REFERENCES leads(id_lead);
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS tipo_mensaje_app varchar(20);
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS remitente_app varchar(20);
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS metadata_json text;
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS leido boolean DEFAULT false;
ALTER TABLE mensajes_chat ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── Hermes (solo app) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hermes_mensajes (
    message_id varchar(200) NOT NULL,
    payload_sha256 varchar(64) NOT NULL,
    id_mensaje bigint NOT NULL REFERENCES mensajes_chat(id_mensaje) ON DELETE CASCADE,
    created_at timestamp(0) NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
    CONSTRAINT PK_hermes_mensajes PRIMARY KEY (message_id)
);

-- ── productos y personal: alias de estado ───────────────────────
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url text;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS created_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');
ALTER TABLE productos ADD COLUMN IF NOT EXISTS updated_at timestamp(0) DEFAULT (now() AT TIME ZONE 'utc');

-- ── catálogos de la app ─────────────────────────────────────────
-- tipos_buyer y productos se leen del canónico; el mapper traduce
-- activo <-> estado_activo y disponible <-> estado_activo.

-- ── índices de la app ───────────────────────────────────────────
-- El DTO permite comanda sin mesa (mostrador) e item libre sin producto.
ALTER TABLE servicios ALTER COLUMN id_mesa DROP NOT NULL;
ALTER TABLE servicio_detalle ALTER COLUMN id_producto DROP NOT NULL;

CREATE INDEX IF NOT EXISTS IX_leads_estado ON leads (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS IX_buyers_etapa ON buyers (etapa_impulse);
CREATE INDEX IF NOT EXISTS IX_pagos_external_ref ON pagos (mp_external_reference);
CREATE INDEX IF NOT EXISTS IX_mensajes_sesion_orden ON mensajes_chat (id_sesion, fecha_hora_mensaje);
