-- Catálogos y datos demo mínimos para levantar la app y el ETL del mart.
-- NO es la migración de los datos históricos: eso se hace con
-- db/postgres/tools/migrate_mssql_sample.py (pendiente de ejecutar con el
-- respaldo .bak). Este archivo es idempotente.

SET client_min_messages = warning;

-- ── áreas y personal ────────────────────────────────────────────
INSERT INTO area_empresa (id_area, codigo, nombre, descripcion) VALUES
    (1, 'SALON', 'Salón', 'Atención en mesa'),
    (2, 'COCINA', 'Cocina', 'Preparación de platos'),
    (3, 'MARKETING', 'Marketing', 'Campañas y captación')
ON CONFLICT (id_area) DO NOTHING;

INSERT INTO personal (id_personal, id_area, tipo_documento, numero_documento, nombres, apellidos, cargo, fecha_ingreso) VALUES
    (1, 1, 'DNI', '10000001', 'Agente', 'Virtual', 'AGENTE', DATE '2024-01-01'),
    (2, 2, 'DNI', '10000002', 'Parrillero', 'Demo', 'PARRILLERO', DATE '2024-01-01'),
    (3, 1, 'DNI', '10000003', 'Cajero', 'Demo', 'CAJERO', DATE '2024-01-01')
ON CONFLICT (id_personal) DO NOTHING;

-- ── catálogos ───────────────────────────────────────────────────
INSERT INTO tipos_buyer (id_tipo_buyer, codigo, nombre, descripcion) VALUES
    (1, 'PERSONA', 'Persona', 'Cliente individual'),
    (2, 'EMPRESA', 'Empresa', 'Cuenta corporativa')
ON CONFLICT (id_tipo_buyer) DO NOTHING;

INSERT INTO redes_sociales (id_red_social, id_personal_administrador, plataforma, nombre_pagina, url_pagina) VALUES
    (1, 3, 'INSTAGRAM', 'parrilladas.el.establo', 'https://instagram.com/parrilladas.el.establo'),
    (2, 3, 'WHATSAPP', 'Establo Reservas', 'https://wa.me/520000000000')
ON CONFLICT (id_red_social) DO NOTHING;

INSERT INTO tipos_corte (id_tipo_corte, nombre, categoria) VALUES
    (1, 'Punta de anca', 'RES'),
    (2, 'Chuleta', 'CERDO'),
    (3, 'Pechuga', 'POLLO')
ON CONFLICT (id_tipo_corte) DO NOTHING;

INSERT INTO terminos_coccion (id_termino_coccion, nombre) VALUES
    (1, 'Término medio'),
    (2, 'Tres cuartos'),
    (3, 'Bien cocido')
ON CONFLICT (id_termino_coccion) DO NOTHING;

INSERT INTO productos (id_producto, nombre, descripcion, categoria, precio_base, es_gancho_promocional) VALUES
    (1, 'Parrillada para 2', 'Corte mixto con guarniciones', 'PLATO_CARTA', 450.00, true),
    (2, 'Punta de anca 400g', 'Corte de res a la parrilla', 'PLATO_CARTA', 320.00, false),
    (3, 'Chorizo artesanal', 'Entrada de la casa', 'ENTRADA', 85.00, false),
    (4, 'Limonada de la casa', 'Jarra de 1 litro', 'BEBIDA', 45.00, false),
    (5, 'Pie de limón', 'Postre individual', 'POSTRE', 55.00, false),
    (6, 'Papas rústicas', 'Porción para compartir', 'GUARNICION', 60.00, false)
ON CONFLICT (id_producto) DO NOTHING;

INSERT INTO mesas (id_mesa, numero_mesa, zona, capacidad, estado_mesa) VALUES
    (1, '1', 'SALON', 4, 'DISPONIBLE'),
    (2, '2', 'SALON', 6, 'DISPONIBLE'),
    (3, '3', 'TERRAZA', 4, 'DISPONIBLE'),
    (4, '4', 'BARRA', 2, 'DISPONIBLE')
ON CONFLICT (id_mesa) DO NOTHING;

-- ── campaña y anuncio demo ──────────────────────────────────────
INSERT INTO campanas (id_campana, id_red_social, id_tipo_buyer_objetivo, nombre, fuente_utm, fecha_inicio, fecha_fin, estado_activo, estado_impulse, presupuesto_total) VALUES
    (1, 1, 1, 'Promo Almuerzo Parrillero', 'instagram', DATE '2026-01-01', DATE '2026-12-31', true, 'activa', 5000.00)
ON CONFLICT (id_campana) DO NOTHING;

INSERT INTO anuncios (id_anuncio, id_campana, nombre, texto_cta, estado_activo, estado_impulse) VALUES
    (1, 1, 'Almuerzo para 2', 'Reserva tu mesa', true, 'activo')
ON CONFLICT (id_anuncio) DO NOTHING;

-- ── buyers, personas y leads demo ───────────────────────────────
INSERT INTO buyer_personas (id_persona, id_tipo_buyer, nombre, apellido, telefono, correo, fecha_registro) VALUES
    ('11111111-1111-1111-1111-111111111101', 1, 'Ana', 'Torres', '5512345678', 'ana@example.com', now() AT TIME ZONE 'utc'),
    ('11111111-1111-1111-1111-111111111102', 1, 'Luis', 'Ramos', '5587654321', 'luis@example.com', now() AT TIME ZONE 'utc')
ON CONFLICT (id_persona) DO NOTHING;

INSERT INTO buyers (id_buyer, id_persona, id_anuncio_origen, id_red_social_origen, canal_origen, estado_buyer, etapa_impulse, activo) VALUES
    ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 1, 1, 'ANUNCIO_FORMULARIO', 'ACTIVO', 'lead', true),
    ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111102', NULL, 2, 'WHATSAPP_DIRECTO', 'ACTIVO', 'lead', true)
ON CONFLICT (id_buyer) DO NOTHING;

INSERT INTO formularios_captacion (id_formulario, id_buyer, nombre_ingresado, telefono_ingresado, telefono_es_valido, consentimiento_datos_otorgado, interes_declarado, canal, procesado) VALUES
    ('88888888-8888-8888-8888-888888888801', '22222222-2222-2222-2222-222222222201', 'Ana Torres', '5512345678', true, true, 'RESERVA_MESA', 'web', true)
ON CONFLICT (id_formulario) DO NOTHING;

INSERT INTO leads (id_lead, id_buyer, interes_principal, estado, id_campana, id_formulario, personas_estimadas, presupuesto_estimado, notas) VALUES
    ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'RESERVA_MESA', 'nuevo', 1, '88888888-8888-8888-8888-888888888801', 4, 900.00, 'Mesa en terraza'),
    ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', 'PROMO_CENA', 'contactado', NULL, NULL, 2, 500.00, NULL)
ON CONFLICT (id_lead) DO NOTHING;

INSERT INTO negociacion_leads (id_negociacion, id_lead, resumen_cliente, cantidad_interacciones, estado_negociacion) VALUES
    ('99999999-9999-9999-9999-999999999901', '33333333-3333-3333-3333-333333333301', 'Interesada en mesa para 4', 1, 'ACTIVA')
ON CONFLICT (id_negociacion) DO NOTHING;

INSERT INTO perfil_gustos (id_lead, id_tipo_corte, id_termino_coccion, descripcion_preferencia) VALUES
    ('33333333-3333-3333-3333-333333333301', 1, 1, 'Corte jugoso, sin alergias')
ON CONFLICT (id_lead) DO NOTHING;

INSERT INTO perfil_reserva (id_lead, fecha_reserva, hora_reserva, cantidad_personas, estado_reserva) VALUES
    ('33333333-3333-3333-3333-333333333301', CURRENT_DATE + 2, TIME '20:00', 4, 'tentativa')
ON CONFLICT (id_lead) DO NOTHING;

-- ── pedido, pago y payer demo ───────────────────────────────────
INSERT INTO pedidos (id_pedido, id_lead, tipo_consumo, estado_pedido, total, subtotal, estado_impulse) VALUES
    ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333301', 'SALON', 'PENDIENTE', 900.00, 900.00, 'pendiente')
ON CONFLICT (id_pedido) DO NOTHING;

INSERT INTO detalle_pedido (id_detalle, id_pedido, id_producto, cantidad, precio_unitario, nombre_producto, categoria) VALUES
    (1, '44444444-4444-4444-4444-444444444401', 1, 1, 450.00, 'Parrillada para 2', 'PLATO_CARTA'),
    (2, '44444444-4444-4444-4444-444444444401', 4, 2, 45.00, 'Limonada de la casa', 'BEBIDA')
ON CONFLICT (id_detalle) DO NOTHING;

INSERT INTO pagos (id_pago, id_pedido, metodo_pago, monto, estado_pago, id_lead, tipo_pago, porcentaje) VALUES
    ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', 'EFECTIVO', 90.00, 'PAGADO', '33333333-3333-3333-3333-333333333301', 'adelanto', 10.00)
ON CONFLICT (id_pago) DO NOTHING;

INSERT INTO payers (id_payer, id_lead, id_pago, id_pedido, id_buyer, id_mesa, estado, total_pedido, monto_adelanto_pagado, monto_saldo, fecha_llegada) VALUES
    ('66666666-6666-6666-6666-666666666601', '33333333-3333-3333-3333-333333333301', '55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222201', 3, 'esperando', 900.00, 90.00, 810.00, now() AT TIME ZONE 'utc')
ON CONFLICT (id_payer) DO NOTHING;

INSERT INTO instrucciones_pago (id_instruccion, id_pedido, canal_pago, monto_informado, id_payer, tipo_pago) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01', '44444444-4444-4444-4444-444444444401', 'EFECTIVO', 90.00, '66666666-6666-6666-6666-666666666601', 'adelanto')
ON CONFLICT (id_instruccion) DO NOTHING;

INSERT INTO comprobante (id_comprobante, id_pago, tipo_comprobante, id_payer, id_pedido, folio, total, emitido, fecha_emision) VALUES
    ('77777777-7777-7777-7777-777777777701', '55555555-5555-5555-5555-555555555501', 'BOLETA_SIMPLE', '66666666-6666-6666-6666-666666666601', '44444444-4444-4444-4444-444444444401', 'B001-0001', 900.00, true, now() AT TIME ZONE 'utc')
ON CONFLICT (id_comprobante) DO NOTHING;

-- Las PK explícitas no avanzan las secuencias IDENTITY. Se sincronizan para
-- que los INSERT que haga la API no choquen con los ids del seed.
SELECT setval(pg_get_serial_sequence('area_empresa', 'id_area'), (SELECT max(id_area) FROM area_empresa));
SELECT setval(pg_get_serial_sequence('personal', 'id_personal'), (SELECT max(id_personal) FROM personal));
SELECT setval(pg_get_serial_sequence('tipos_buyer', 'id_tipo_buyer'), (SELECT max(id_tipo_buyer) FROM tipos_buyer));
SELECT setval(pg_get_serial_sequence('redes_sociales', 'id_red_social'), (SELECT max(id_red_social) FROM redes_sociales));
SELECT setval(pg_get_serial_sequence('tipos_corte', 'id_tipo_corte'), (SELECT max(id_tipo_corte) FROM tipos_corte));
SELECT setval(pg_get_serial_sequence('terminos_coccion', 'id_termino_coccion'), (SELECT max(id_termino_coccion) FROM terminos_coccion));
SELECT setval(pg_get_serial_sequence('productos', 'id_producto'), (SELECT max(id_producto) FROM productos));
SELECT setval(pg_get_serial_sequence('mesas', 'id_mesa'), (SELECT max(id_mesa) FROM mesas));
SELECT setval(pg_get_serial_sequence('campanas', 'id_campana'), (SELECT max(id_campana) FROM campanas));
SELECT setval(pg_get_serial_sequence('anuncios', 'id_anuncio'), (SELECT max(id_anuncio) FROM anuncios));
SELECT setval(pg_get_serial_sequence('detalle_pedido', 'id_detalle'), (SELECT max(id_detalle) FROM detalle_pedido));
