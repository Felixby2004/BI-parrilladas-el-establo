-- ============================================================
-- BASE TRANSACCIONAL DE LA PARRILLA — UNIFICADA (Fases Buyers, Leads, Payers, Salón)
-- SQL SERVER — Idempotente (sólo crea lo que no existe)
--
-- Fechas DATETIME2 registradas en UTC (SYSUTCDATETIME).
-- La aplicación debe insertar en UTC también.
--
-- ORDEN DE BLOQUES (respetando dependencias FK):
--   1. Catálogos base Buyers  2. Captación/Leads  3. Lead (pedidos/pagos)
--   4. Payers  5. Salón/CSAT  6. Índices
-- ============================================================

IF DB_ID('database_parrilla') IS NULL
    CREATE DATABASE database_parrilla;


USE database_parrilla;

-- ============================================================
-- BLOQUE 1: CATÁLOGOS BASE (FASE BUYERS)
-- ============================================================

IF OBJECT_ID('dbo.area_empresa', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.area_empresa (
        id_area INT IDENTITY(1,1) NOT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombre NVARCHAR(100) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_area_empresa_activo DEFAULT (1),

        CONSTRAINT PK_area_empresa PRIMARY KEY (id_area),
        CONSTRAINT UQ_area_empresa_codigo UNIQUE (codigo)
    );
END;

IF OBJECT_ID('dbo.tipos_buyer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tipos_buyer (
        id_tipo_buyer INT IDENTITY(1,1) NOT NULL,
        codigo VARCHAR(30) NOT NULL,
        nombre NVARCHAR(100) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_tipos_buyer_activo DEFAULT (1),

        CONSTRAINT PK_tipos_buyer PRIMARY KEY (id_tipo_buyer),
        CONSTRAINT UQ_tipos_buyer_codigo UNIQUE (codigo)
    );
END;

IF OBJECT_ID('dbo.productos', 'U') IS NULL
BEGIN
    -- Maestro de productos (desde la etapa Buyers).
    CREATE TABLE dbo.productos (
        id_producto INT IDENTITY(1,1) NOT NULL,
        nombre NVARCHAR(120) NOT NULL,
        descripcion NVARCHAR(500) NULL,
        categoria VARCHAR(30) NOT NULL,
        precio_base DECIMAL(10,2) NOT NULL,
        es_gancho_promocional BIT NOT NULL CONSTRAINT DF_productos_gancho DEFAULT (0),
        estado_activo BIT NOT NULL CONSTRAINT DF_productos_activo DEFAULT (1),

        CONSTRAINT PK_productos PRIMARY KEY (id_producto),
        CONSTRAINT UQ_productos_nombre UNIQUE (nombre),
        CONSTRAINT CK_productos_precio CHECK (precio_base >= 0),
        CONSTRAINT CK_productos_categoria CHECK (categoria IN (
            'PLATO_CARTA', 'ENTRADA', 'BEBIDA', 'POSTRE', 'GUARNICION'
        ))
    );
END;

IF OBJECT_ID('dbo.personal', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.personal (
        id_personal INT IDENTITY(1,1) NOT NULL,
        id_area INT NOT NULL,
        tipo_documento VARCHAR(20) NULL,
        numero_documento VARCHAR(20) NULL,
        nombres NVARCHAR(100) NOT NULL,
        apellidos NVARCHAR(100) NOT NULL,
        fecha_nacimiento DATE NULL,
        telefono VARCHAR(20) NULL,
        correo NVARCHAR(150) NULL,
        cargo NVARCHAR(100) NOT NULL,
        fecha_ingreso DATE NOT NULL,
        fecha_salida DATE NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_personal_activo DEFAULT (1),

        CONSTRAINT PK_personal PRIMARY KEY (id_personal),
        CONSTRAINT FK_personal_area FOREIGN KEY (id_area) REFERENCES dbo.area_empresa(id_area),
        CONSTRAINT CK_personal_fechas CHECK (
            fecha_salida IS NULL OR fecha_salida >= fecha_ingreso
        )
    );
END;

IF OBJECT_ID('dbo.redes_sociales', 'U') IS NULL
BEGIN
    -- Páginas de redes sociales de la empresa; un trabajador administra cada una.
    CREATE TABLE dbo.redes_sociales (
        id_red_social INT IDENTITY(1,1) NOT NULL,
        id_personal_administrador INT NOT NULL,
        plataforma VARCHAR(30) NOT NULL,
        nombre_pagina NVARCHAR(150) NOT NULL,
        url_pagina NVARCHAR(500) NOT NULL,
        usuario_pagina NVARCHAR(100) NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_redes_sociales_activo DEFAULT (1),

        CONSTRAINT PK_redes_sociales PRIMARY KEY (id_red_social),
        CONSTRAINT FK_redes_sociales_personal FOREIGN KEY (id_personal_administrador)
            REFERENCES dbo.personal(id_personal),
        CONSTRAINT UQ_redes_sociales_url UNIQUE (url_pagina),
        CONSTRAINT CK_redes_sociales_plataforma CHECK (plataforma IN (
            'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'OTRA'
        ))
    );
END;


-- ============================================================
-- BLOQUE 2: CAPTACIÓN Y CONVERSIÓN A LEAD (FASE BUYERS)
-- ============================================================

IF OBJECT_ID('dbo.buyer_personas', 'U') IS NULL
BEGIN
    -- Datos personales de posibles clientes; un BUYER puede existir sin identificarse.
    CREATE TABLE dbo.buyer_personas (
        id_persona UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_buyer_personas_id DEFAULT NEWID(),
        id_tipo_buyer INT NULL,
        nombre NVARCHAR(150) NULL,
        fecha_nacimiento DATE NULL,
        telefono VARCHAR(20) NULL,
        correo NVARCHAR(150) NULL,
        usuario_red_social NVARCHAR(100) NULL,
        consentimiento_datos_fecha DATETIME2(0) NULL,
        consentimiento_marketing_fecha DATETIME2(0) NULL,
        fecha_registro DATETIME2(0) NOT NULL CONSTRAINT DF_buyer_personas_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_buyer_personas PRIMARY KEY (id_persona),
        CONSTRAINT FK_buyer_personas_tipo FOREIGN KEY (id_tipo_buyer)
            REFERENCES dbo.tipos_buyer(id_tipo_buyer)
    );
END;
IF OBJECT_ID('dbo.campanas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.campanas (
        id_campana INT IDENTITY(1,1) NOT NULL,
        id_red_social INT NOT NULL,
        id_tipo_buyer_objetivo INT NULL,
        id_producto_gancho INT NULL,
        nombre NVARCHAR(150) NOT NULL,
        fuente_utm VARCHAR(100) NULL,
        fecha_creacion DATETIME2(0) NOT NULL CONSTRAINT DF_campanas_fecha DEFAULT SYSUTCDATETIME(),
        fecha_inicio DATE NULL,
        fecha_fin DATE NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_campanas_activo DEFAULT (1),

        CONSTRAINT PK_campanas PRIMARY KEY (id_campana),
        CONSTRAINT FK_campanas_red_social FOREIGN KEY (id_red_social) REFERENCES dbo.redes_sociales(id_red_social),
        CONSTRAINT FK_campanas_tipo FOREIGN KEY (id_tipo_buyer_objetivo) REFERENCES dbo.tipos_buyer(id_tipo_buyer),
        CONSTRAINT FK_campanas_producto FOREIGN KEY (id_producto_gancho) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_campanas_fechas CHECK (
            fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_fin >= fecha_inicio
        )
    );
END;

IF OBJECT_ID('dbo.anuncios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.anuncios (
        id_anuncio INT IDENTITY(1,1) NOT NULL,
        id_campana INT NOT NULL,
        nombre NVARCHAR(150) NOT NULL,
        texto_cta NVARCHAR(150) NULL,
        horario_inicio TIME NULL,
        horario_fin TIME NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_anuncios_activo DEFAULT (1),

        CONSTRAINT PK_anuncios PRIMARY KEY (id_anuncio),
        CONSTRAINT FK_anuncios_campana FOREIGN KEY (id_campana) REFERENCES dbo.campanas(id_campana)
    );
END;

IF OBJECT_ID('dbo.gastos_anuncios_diarios', 'U') IS NULL
BEGIN
    -- Gasto publicitario diario. Medida monetaria del CPL. Una fila por anuncio y día.
    CREATE TABLE dbo.gastos_anuncios_diarios (
        id_gasto BIGINT IDENTITY(1,1) NOT NULL,
        id_anuncio INT NOT NULL,
        fecha_gasto DATE NOT NULL,
        importe_gastado DECIMAL(12,2) NOT NULL,

        CONSTRAINT PK_gastos_anuncios_diarios PRIMARY KEY (id_gasto),
        CONSTRAINT FK_gastos_anuncios_anuncio FOREIGN KEY (id_anuncio) REFERENCES dbo.anuncios(id_anuncio),
        CONSTRAINT UQ_gastos_anuncios_dia UNIQUE (id_anuncio, fecha_gasto),
        CONSTRAINT CK_gastos_anuncios_importe CHECK (importe_gastado >= 0)
    );
END;

IF OBJECT_ID('dbo.buyers', 'U') IS NULL
BEGIN
    -- canal ANUNCIO_FORMULARIO exige id_anuncio_origen; los demás no permiten anuncio.
    CREATE TABLE dbo.buyers (
        id_buyer UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_buyers_id DEFAULT NEWID(),
        id_persona UNIQUEIDENTIFIER NULL,
        id_anuncio_origen INT NULL,
        id_red_social_origen INT NULL,
        canal_origen VARCHAR(30) NOT NULL,
        estado_buyer VARCHAR(30) NOT NULL CONSTRAINT DF_buyers_estado DEFAULT ('ACTIVO'),
        fecha_primer_contacto DATETIME2(0) NOT NULL CONSTRAINT DF_buyers_fecha DEFAULT SYSUTCDATETIME(),
        fecha_conversion DATETIME2(0) NULL,
        fecha_actualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_buyers_actualizacion DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_buyers PRIMARY KEY (id_buyer),
        CONSTRAINT FK_buyers_persona FOREIGN KEY (id_persona) REFERENCES dbo.buyer_personas(id_persona),
        CONSTRAINT FK_buyers_anuncio FOREIGN KEY (id_anuncio_origen) REFERENCES dbo.anuncios(id_anuncio),
        CONSTRAINT FK_buyers_red_social FOREIGN KEY (id_red_social_origen) REFERENCES dbo.redes_sociales(id_red_social),
        CONSTRAINT CK_buyers_canal CHECK (canal_origen IN (
            'ANUNCIO_FORMULARIO', 'WHATSAPP_DIRECTO', 'RED_SOCIAL_ORGANICO',
            'REFERIDO', 'WEB', 'OTRO'
        )),
        CONSTRAINT CK_buyers_anuncio CHECK (
            (canal_origen = 'ANUNCIO_FORMULARIO' AND id_anuncio_origen IS NOT NULL)
            OR (canal_origen <> 'ANUNCIO_FORMULARIO' AND id_anuncio_origen IS NULL)
        ),
        CONSTRAINT CK_buyers_estado CHECK (estado_buyer IN (
            'ACTIVO', 'ABANDONADO', 'CONVERTIDO_LEAD', 'DESCARTADO'
        )),
        CONSTRAINT CK_buyers_conversion CHECK (
            fecha_conversion IS NULL OR fecha_conversion >= fecha_primer_contacto
        )
    );
END;

IF OBJECT_ID('dbo.formularios_captacion', 'U') IS NULL
BEGIN
    -- Una fila por BUYER que envió el formulario.
    -- codigo_vinculacion va en el enlace/QR de WhatsApp para reconocer la conversación.
    CREATE TABLE dbo.formularios_captacion (
        id_formulario UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_formularios_id DEFAULT NEWID(),
        id_buyer UNIQUEIDENTIFIER NOT NULL,
        nombre_ingresado NVARCHAR(150) NULL,
        telefono_ingresado VARCHAR(20) NOT NULL,
        telefono_es_valido BIT NOT NULL,
        consentimiento_datos_otorgado BIT NOT NULL,
        interes_declarado NVARCHAR(150) NULL,
        codigo_vinculacion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_formularios_codigo DEFAULT NEWID(),
        fecha_envio DATETIME2(0) NOT NULL CONSTRAINT DF_formularios_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_formularios_captacion PRIMARY KEY (id_formulario),
        CONSTRAINT FK_formularios_buyer FOREIGN KEY (id_buyer) REFERENCES dbo.buyers(id_buyer),
        CONSTRAINT UQ_formularios_buyer UNIQUE (id_buyer),
        CONSTRAINT UQ_formularios_codigo UNIQUE (codigo_vinculacion),
        CONSTRAINT UQ_formularios_id_buyer UNIQUE (id_formulario, id_buyer)
    );
END;

IF OBJECT_ID('dbo.buyer_productos_favoritos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.buyer_productos_favoritos (
        id_buyer_producto UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_bpf_id DEFAULT NEWID(),
        id_buyer UNIQUEIDENTIFIER NOT NULL,
        id_producto INT NOT NULL,
        es_favorito_principal BIT NOT NULL CONSTRAINT DF_bpf_principal DEFAULT (0),
        origen_interes VARCHAR(30) NULL,
        fecha_registro DATETIME2(0) NOT NULL CONSTRAINT DF_bpf_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_buyer_productos_favoritos PRIMARY KEY (id_buyer_producto),
        CONSTRAINT FK_bpf_buyer FOREIGN KEY (id_buyer) REFERENCES dbo.buyers(id_buyer),
        CONSTRAINT FK_bpf_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT UQ_bpf_buyer_producto UNIQUE (id_buyer, id_producto),
        CONSTRAINT CK_bpf_origen CHECK (
            origen_interes IS NULL OR origen_interes IN (
                'CHAT_PLN', 'CATALOGO_WEB', 'CAMPANA_GANCHO'
            )
        )
    );
END;

IF OBJECT_ID('dbo.sesiones_chat', 'U') IS NULL
BEGIN
    -- id_formulario NULL = conversación sin formulario vinculado.
    -- fecha_inicio = primer mensaje del CLIENTE. fecha_abandono queda guardada si se recupera.
    CREATE TABLE dbo.sesiones_chat (
        id_sesion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sesiones_id DEFAULT NEWID(),
        id_buyer UNIQUEIDENTIFIER NOT NULL,
        id_formulario UNIQUEIDENTIFIER NULL,
        numero_whatsapp_cliente VARCHAR(20) NOT NULL,
        fecha_inicio DATETIME2(0) NOT NULL,
        fecha_hora_ultimo_mensaje DATETIME2(0) NULL,
        fecha_abandono DATETIME2(0) NULL,
        intencion_detectada VARCHAR(50) NULL,
        estado_sesion VARCHAR(20) NOT NULL CONSTRAINT DF_sesiones_estado DEFAULT ('ABIERTA'),
        fecha_cierre DATETIME2(0) NULL,

        CONSTRAINT PK_sesiones_chat PRIMARY KEY (id_sesion),
        CONSTRAINT FK_sesiones_buyer FOREIGN KEY (id_buyer) REFERENCES dbo.buyers(id_buyer),
        CONSTRAINT FK_sesiones_formulario_buyer FOREIGN KEY (id_formulario, id_buyer)
            REFERENCES dbo.formularios_captacion(id_formulario, id_buyer),
        CONSTRAINT CK_sesiones_estado CHECK (estado_sesion IN (
            'ABIERTA', 'EN_ESPERA_CLIENTE', 'ABANDONADA', 'CERRADA'
        )),
        CONSTRAINT CK_sesiones_intencion CHECK (
            intencion_detectada IS NULL OR intencion_detectada IN (
                'PRECIOS', 'RESERVA', 'CARTA_GENERAL',
                'HORARIOS_UBICACION', 'OTRA'
            )
        ),
        CONSTRAINT CK_sesiones_fechas CHECK (
            (fecha_hora_ultimo_mensaje IS NULL OR fecha_hora_ultimo_mensaje >= fecha_inicio)
            AND
            (fecha_abandono IS NULL OR fecha_abandono >= fecha_inicio)
            AND
            (fecha_cierre IS NULL OR fecha_cierre >= fecha_inicio)
        )
    );
END;

IF OBJECT_ID('dbo.mensajes_chat', 'U') IS NULL
BEGIN
    -- tipo_remitente: CLIENTE (cliente), PERSONAL (trabajador), BOT (automatizado).
    -- Un mensaje RESCATE puede ser PERSONAL o BOT; id_personal identifica al trabajador.
    CREATE TABLE dbo.mensajes_chat (
        id_mensaje BIGINT IDENTITY(1,1) NOT NULL,
        id_sesion UNIQUEIDENTIFIER NOT NULL,
        id_personal INT NULL,
        id_mensaje_externo VARCHAR(150) NULL,
        tipo_remitente VARCHAR(15) NOT NULL,
        tipo_mensaje VARCHAR(20) NOT NULL CONSTRAINT DF_mensajes_tipo DEFAULT ('NORMAL'),
        numero_whatsapp_remitente VARCHAR(20) NULL,
        mensaje_contenido NVARCHAR(MAX) NOT NULL,
        fecha_hora_mensaje DATETIME2(0) NOT NULL CONSTRAINT DF_mensajes_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_mensajes_chat PRIMARY KEY (id_mensaje),
        CONSTRAINT FK_mensajes_sesion FOREIGN KEY (id_sesion) REFERENCES dbo.sesiones_chat(id_sesion),
        CONSTRAINT FK_mensajes_personal FOREIGN KEY (id_personal) REFERENCES dbo.personal(id_personal),
        CONSTRAINT UQ_mensajes_id_sesion UNIQUE (id_mensaje, id_sesion),
        CONSTRAINT CK_mensajes_remitente CHECK (tipo_remitente IN ('CLIENTE', 'PERSONAL', 'BOT')),
        CONSTRAINT CK_mensajes_tipo CHECK (tipo_mensaje IN ('NORMAL', 'RESCATE')),
        CONSTRAINT CK_mensajes_personal CHECK (
            (tipo_remitente = 'PERSONAL' AND id_personal IS NOT NULL)
            OR
            (tipo_remitente IN ('CLIENTE', 'BOT') AND id_personal IS NULL)
        ),
        CONSTRAINT CK_mensajes_rescate CHECK (
            tipo_mensaje <> 'RESCATE' OR tipo_remitente IN ('PERSONAL', 'BOT')
        )
    );
END;

IF OBJECT_ID('dbo.rescates_chat', 'U') IS NULL
BEGIN
    -- Rescate de una sesión abandonada. Una fila por sesión rescatada.
    -- La aplicación verifica: fecha_abandono previa, rescate posterior,
    -- respuesta del CLIENTE posterior al rescate.
    CREATE TABLE dbo.rescates_chat (
        id_rescate BIGINT IDENTITY(1,1) NOT NULL,
        id_sesion UNIQUEIDENTIFIER NOT NULL,
        id_mensaje_rescate BIGINT NOT NULL,
        id_mensaje_respuesta_cliente BIGINT NULL,

        CONSTRAINT PK_rescates_chat PRIMARY KEY (id_rescate),
        CONSTRAINT UQ_rescates_sesion UNIQUE (id_sesion),
        CONSTRAINT UQ_rescates_mensaje UNIQUE (id_mensaje_rescate),
        CONSTRAINT FK_rescates_sesion FOREIGN KEY (id_sesion) REFERENCES dbo.sesiones_chat(id_sesion),
        CONSTRAINT FK_rescates_mensaje_sesion FOREIGN KEY (id_mensaje_rescate, id_sesion)
            REFERENCES dbo.mensajes_chat(id_mensaje, id_sesion),
        CONSTRAINT FK_rescates_respuesta_sesion FOREIGN KEY (id_mensaje_respuesta_cliente, id_sesion)
            REFERENCES dbo.mensajes_chat(id_mensaje, id_sesion),
        CONSTRAINT CK_rescates_mensajes_distintos CHECK (
            id_mensaje_respuesta_cliente IS NULL
            OR id_mensaje_respuesta_cliente <> id_mensaje_rescate
        )
    );
END;

IF OBJECT_ID('dbo.accesos_catalogo_web', 'U') IS NULL
BEGIN
    -- Registro de consultas/intereses del catálogo web.
    -- No se confunde con el formulario del anuncio.
    CREATE TABLE dbo.accesos_catalogo_web (
        id_acceso UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_catalogo_id DEFAULT NEWID(),
        id_buyer UNIQUEIDENTIFIER NOT NULL,
        id_sesion UNIQUEIDENTIFIER NULL,
        fecha_acceso DATETIME2(0) NOT NULL CONSTRAINT DF_catalogo_fecha DEFAULT SYSUTCDATETIME(),
        fecha_envio_datos DATETIME2(0) NULL,
        telefono_ingresado VARCHAR(20) NULL,
        telefono_es_valido BIT NULL,
        consentimiento_datos_otorgado BIT NULL,

        es_contacto_utilizable AS (
            CASE
                WHEN fecha_envio_datos IS NOT NULL
                 AND telefono_es_valido = 1
                 AND consentimiento_datos_otorgado = 1
                THEN 1
                ELSE 0
            END
        ) PERSISTED,

        CONSTRAINT PK_accesos_catalogo_web PRIMARY KEY (id_acceso),
        CONSTRAINT FK_catalogo_buyer FOREIGN KEY (id_buyer) REFERENCES dbo.buyers(id_buyer),
        CONSTRAINT FK_catalogo_sesion FOREIGN KEY (id_sesion) REFERENCES dbo.sesiones_chat(id_sesion),
        CONSTRAINT CK_catalogo_fechas CHECK (
            fecha_envio_datos IS NULL OR fecha_envio_datos >= fecha_acceso
        )
    );
END;

IF OBJECT_ID('dbo.leads', 'U') IS NULL
BEGIN
    -- Un BUYER se convierte como máximo en un LEAD.
    -- El anuncio de origen se obtiene desde buyers.
    CREATE TABLE dbo.leads (
        id_lead UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_leads_id DEFAULT NEWID(),
        id_buyer UNIQUEIDENTIFIER NOT NULL,
        interes_principal VARCHAR(50) NOT NULL,
        fecha_calificacion DATETIME2(0) NOT NULL CONSTRAINT DF_leads_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_leads PRIMARY KEY (id_lead),
        CONSTRAINT UQ_leads_buyer UNIQUE (id_buyer),
        CONSTRAINT FK_leads_buyer FOREIGN KEY (id_buyer) REFERENCES dbo.buyers(id_buyer),
        CONSTRAINT CK_leads_interes CHECK (interes_principal IN (
            'PROMO_ALMUERZO', 'PROMO_CENA', 'RESERVA_MESA',
            'CARTA_BEBIDAS', 'OTRO'
        ))
    );
END;


-- ============================================================
-- BLOQUE 3: PERFIL DE GUSTOS, NEGOCIACIÓN Y PEDIDOS DEL LEAD
-- ============================================================

IF OBJECT_ID('dbo.tipos_corte', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tipos_corte (
        id_tipo_corte INT IDENTITY(1,1) NOT NULL,
        nombre NVARCHAR(100) NOT NULL,
        categoria VARCHAR(30) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        estado_activo BIT NOT NULL CONSTRAINT DF_tipos_corte_activo DEFAULT (1),

        CONSTRAINT PK_tipos_corte PRIMARY KEY (id_tipo_corte),
        CONSTRAINT UQ_tipos_corte_nombre UNIQUE (nombre),
        CONSTRAINT CK_tipos_corte_categoria CHECK (categoria IN ('RES', 'CERDO', 'POLLO'))
    );
END;

IF OBJECT_ID('dbo.terminos_coccion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.terminos_coccion (
        id_termino_coccion INT IDENTITY(1,1) NOT NULL,
        nombre NVARCHAR(50) NOT NULL,
        descripcion NVARCHAR(200) NULL,

        CONSTRAINT PK_terminos_coccion PRIMARY KEY (id_termino_coccion),
        CONSTRAINT UQ_terminos_coccion_nombre UNIQUE (nombre)
    );
END;


IF OBJECT_ID('dbo.bebida_detalle', 'U') IS NULL
BEGIN
    -- Extras 1:1 de productos BEBIDA.
    CREATE TABLE dbo.bebida_detalle (
        id_producto INT NOT NULL,
        subcategoria VARCHAR(30) NOT NULL,

        CONSTRAINT PK_bebida_detalle PRIMARY KEY (id_producto),
        CONSTRAINT FK_bebida_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_bebida_detalle_subcategoria CHECK (subcategoria IN (
            'COCTEL', 'JUGO', 'CERVEZA', 'GASEOSA', 'AGUA'
        ))
    );
END;


IF OBJECT_ID('dbo.plato_detalle', 'U') IS NULL
BEGIN
    -- Subclase "platos a la carta" (cortes de carne) del maestro productos.
    -- Un producto PLATO_CARTA sin corte (p. ej. vegetariano) no tiene fila aquí.
    CREATE TABLE dbo.plato_detalle (
        id_producto INT NOT NULL,
        id_tipo_corte INT NOT NULL,

        CONSTRAINT PK_plato_detalle PRIMARY KEY (id_producto),
        CONSTRAINT FK_plato_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT FK_plato_detalle_corte FOREIGN KEY (id_tipo_corte) REFERENCES dbo.tipos_corte(id_tipo_corte)
    );
END;


IF OBJECT_ID('dbo.entrada_detalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.entrada_detalle (
        id_producto INT NOT NULL,
        subcategoria VARCHAR(30) NOT NULL,

        CONSTRAINT PK_entrada_detalle PRIMARY KEY (id_producto),
        CONSTRAINT FK_entrada_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_entrada_detalle_subcategoria CHECK (subcategoria IN ('FRIA', 'CALIENTE'))
    );
END;


IF OBJECT_ID('dbo.postre_detalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.postre_detalle (
        id_producto INT NOT NULL,
        subcategoria VARCHAR(30) NOT NULL,

        CONSTRAINT PK_postre_detalle PRIMARY KEY (id_producto),
        CONSTRAINT FK_postre_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_postre_detalle_subcategoria CHECK (subcategoria IN ('HELADO', 'TORTA', 'FRUTA'))
    );
END;


IF OBJECT_ID('dbo.guarnicion_detalle', 'U') IS NULL
BEGIN
    -- Extras 1:1 de productos GUARNICION.
    CREATE TABLE dbo.guarnicion_detalle (
        id_producto INT NOT NULL,
        subcategoria VARCHAR(30) NOT NULL,

        CONSTRAINT PK_guarnicion_detalle PRIMARY KEY (id_producto),
        CONSTRAINT FK_guarnicion_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_guarnicion_detalle_subcategoria CHECK (subcategoria IN ('ARROZ', 'PAPAS', 'ENSALADA'))
    );
END;


IF OBJECT_ID('dbo.perfil_gustos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.perfil_gustos (
        id_lead UNIQUEIDENTIFIER NOT NULL,
        id_tipo_corte INT NULL,
        id_termino_coccion INT NULL,
        descripcion_preferencia NVARCHAR(500) NULL,
        fecha_actualizacion DATETIME2(0) NOT NULL CONSTRAINT DF_perfil_gustos_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_perfil_gustos PRIMARY KEY (id_lead),
        CONSTRAINT FK_perfil_gustos_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT FK_perfil_gustos_corte FOREIGN KEY (id_tipo_corte) REFERENCES dbo.tipos_corte(id_tipo_corte),
        CONSTRAINT FK_perfil_gustos_coccion FOREIGN KEY (id_termino_coccion) REFERENCES dbo.terminos_coccion(id_termino_coccion)
    );
END;


IF OBJECT_ID('dbo.perfil_reserva', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.perfil_reserva (
        id_lead UNIQUEIDENTIFIER NOT NULL,
        fecha_reserva DATE NULL,
        hora_reserva TIME NULL,
        cantidad_personas INT NULL,
        observaciones NVARCHAR(300) NULL,

        CONSTRAINT PK_perfil_reserva PRIMARY KEY (id_lead),
        CONSTRAINT FK_perfil_reserva_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT CK_perfil_reserva_personas CHECK (
            cantidad_personas IS NULL OR cantidad_personas > 0
        )
    );
END;


IF OBJECT_ID('dbo.perfil_operativo', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.perfil_operativo (
        id_lead UNIQUEIDENTIFIER NOT NULL,
        responsable INT NULL,
        prioridad VARCHAR(20) NOT NULL CONSTRAINT DF_perfil_operativo_prioridad DEFAULT ('MEDIA'),
        estado_gestion VARCHAR(30) NOT NULL CONSTRAINT DF_perfil_operativo_estado DEFAULT ('PENDIENTE'),
        observaciones NVARCHAR(500) NULL,

        CONSTRAINT PK_perfil_operativo PRIMARY KEY (id_lead),
        CONSTRAINT FK_perfil_operativo_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT FK_perfil_operativo_personal FOREIGN KEY (responsable) REFERENCES dbo.personal(id_personal),
        CONSTRAINT CK_perfil_operativo_prioridad CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA')),
        CONSTRAINT CK_perfil_operativo_estado CHECK (estado_gestion IN (
            'PENDIENTE', 'EN_PROCESO', 'ATENDIDO', 'DESCARTADO'
        ))
    );
END;


IF OBJECT_ID('dbo.negociacion_leads', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.negociacion_leads (
        id_negociacion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_negociacion_id DEFAULT NEWID(),
        id_lead UNIQUEIDENTIFIER NOT NULL,
        resumen_cliente NVARCHAR(1000) NULL,
        historial_consumo NVARCHAR(1000) NULL,
        cantidad_interacciones INT NOT NULL CONSTRAINT DF_negociacion_interacciones DEFAULT 0,
        fecha_inicio DATETIME2(0) NOT NULL CONSTRAINT DF_negociacion_fecha_inicio DEFAULT SYSUTCDATETIME(),
        ultima_interaccion DATETIME2(0) NULL,
        estado_negociacion VARCHAR(30) NOT NULL CONSTRAINT DF_negociacion_estado DEFAULT ('ACTIVA'),
        resultado VARCHAR(30) NULL,

        CONSTRAINT PK_negociacion_leads PRIMARY KEY (id_negociacion),
        CONSTRAINT FK_negociacion_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT CK_negociacion_estado CHECK (estado_negociacion IN (
            'ACTIVA', 'PAUSADA', 'GANADA', 'PERDIDA'
        )),
        CONSTRAINT CK_negociacion_resultado CHECK (
            resultado IS NULL OR resultado IN (
                'VENTA_CONCRETADA', 'SIN_RESPUESTA', 'NO_INTERESADO', 'APLAZADO'
            )
        ),
        CONSTRAINT CK_negociacion_interacciones CHECK (cantidad_interacciones >= 0)
    );
END;


IF OBJECT_ID('dbo.pedidos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pedidos (
        id_pedido UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_pedidos_id DEFAULT NEWID(),
        id_lead UNIQUEIDENTIFIER NOT NULL,
        fecha_pedido DATETIME2(0) NOT NULL CONSTRAINT DF_pedidos_fecha DEFAULT SYSUTCDATETIME(),
        tipo_consumo VARCHAR(30) NULL,
        estado_pedido VARCHAR(30) NOT NULL CONSTRAINT DF_pedidos_estado DEFAULT ('PENDIENTE'),
        total DECIMAL(10,2) NOT NULL CONSTRAINT DF_pedidos_total DEFAULT 0,

        CONSTRAINT PK_pedidos PRIMARY KEY (id_pedido),
        CONSTRAINT FK_pedidos_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT CK_pedidos_tipo_consumo CHECK (
            tipo_consumo IS NULL OR tipo_consumo = 'SALON'
        ),
        CONSTRAINT CK_pedidos_estado CHECK (estado_pedido IN (
            'PENDIENTE', 'EN_PREPARACION', 'ENTREGADO', 'CANCELADO'
        )),
        CONSTRAINT CK_pedidos_total CHECK (total >= 0)
    );
END;


IF OBJECT_ID('dbo.detalle_pedido', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.detalle_pedido (
        id_detalle BIGINT IDENTITY(1,1) NOT NULL,
        id_pedido UNIQUEIDENTIFIER NOT NULL,
        id_producto INT NOT NULL,
        cantidad INT NOT NULL,
        precio_unitario DECIMAL(10,2) NOT NULL,

        subtotal AS (cantidad * precio_unitario),

        CONSTRAINT PK_detalle_pedido PRIMARY KEY (id_detalle),
        CONSTRAINT FK_detalle_pedido FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido),
        CONSTRAINT FK_detalle_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_detalle_pedido_cantidad CHECK (cantidad > 0),
        CONSTRAINT CK_detalle_pedido_precio CHECK (precio_unitario >= 0)
    );
END;


IF OBJECT_ID('dbo.pagos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pagos (
        id_pago UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_pagos_id DEFAULT NEWID(),
        id_pedido UNIQUEIDENTIFIER NOT NULL,
        metodo_pago VARCHAR(30) NULL,
        monto DECIMAL(10,2) NOT NULL,
        fecha_pago DATETIME2(0) NOT NULL CONSTRAINT DF_pagos_fecha DEFAULT SYSUTCDATETIME(),
        estado_pago VARCHAR(20) NOT NULL CONSTRAINT DF_pagos_estado DEFAULT ('PENDIENTE'),

        CONSTRAINT PK_pagos PRIMARY KEY (id_pago),
        CONSTRAINT FK_pago_pedido FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido),
        CONSTRAINT CK_pagos_metodo CHECK (
            metodo_pago IS NULL OR metodo_pago IN (
                'EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'
            )
        ),
        CONSTRAINT CK_pagos_estado CHECK (estado_pago IN (
            'PENDIENTE', 'PAGADO', 'RECHAZADO', 'ANULADO'
        )),
        CONSTRAINT CK_pagos_monto CHECK (monto >= 0)
    );
END;



-- ============================================================
-- BLOQUE 4: PAYERS (COBRANZA EN MESA, COMPROBANTE, ACTIVACIÓN)
-- ============================================================

IF OBJECT_ID('dbo.mesas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.mesas (
        id_mesa INT IDENTITY(1,1) NOT NULL,
        numero_mesa VARCHAR(10) NOT NULL,
        zona VARCHAR(30) NOT NULL,
        capacidad INT NOT NULL,
        estado_mesa VARCHAR(20) NOT NULL CONSTRAINT DF_mesas_estado DEFAULT ('DISPONIBLE'),

        CONSTRAINT PK_mesas PRIMARY KEY (id_mesa),
        CONSTRAINT UQ_mesas_numero UNIQUE (numero_mesa),
        CONSTRAINT CK_mesas_zona CHECK (zona IN ('SALON', 'TERRAZA', 'BARRA')),
        CONSTRAINT CK_mesas_estado CHECK (estado_mesa IN (
            'DISPONIBLE', 'OCUPADA', 'RESERVADA', 'MANTENIMIENTO'
        ))
    );
END;


IF OBJECT_ID('dbo.payers', 'U') IS NULL
BEGIN
    -- Cierre que certifica el paso LEAD -> PAYER y activa la comanda de la mesa.
    -- Registra al cajero/mozo responsable en el cobro manual.
    CREATE TABLE dbo.payers (
        id_payer UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_payers_id DEFAULT NEWID(),
        id_lead UNIQUEIDENTIFIER NOT NULL,
        id_pago UNIQUEIDENTIFIER NOT NULL,
        id_personal_cajero INT NULL,
        fecha_activacion_servicio DATETIME2(0) NOT NULL
            CONSTRAINT DF_payers_fecha_activacion DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_payers PRIMARY KEY (id_payer),
        CONSTRAINT UQ_payers_lead UNIQUE (id_lead),
        CONSTRAINT UQ_payers_pago UNIQUE (id_pago),
        CONSTRAINT FK_payers_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT FK_payers_pago FOREIGN KEY (id_pago) REFERENCES dbo.pagos(id_pago),
        CONSTRAINT FK_payers_personal FOREIGN KEY (id_personal_cajero) REFERENCES dbo.personal(id_personal)
    );
END;


IF OBJECT_ID('dbo.instrucciones_pago', 'U') IS NULL
BEGIN
    -- Monto de la cuenta y canal solicitado (QR Yape/Plin en mesa, POS mozo, efectivo).
    -- fecha_envio alimenta el KPI2 (TMC) contra pagos.fecha_pago.
    CREATE TABLE dbo.instrucciones_pago (
        id_instruccion UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_instrucciones_id DEFAULT NEWID(),
        id_pedido UNIQUEIDENTIFIER NOT NULL,
        canal_pago VARCHAR(30) NOT NULL,
        monto_informado DECIMAL(10,2) NOT NULL,
        fecha_envio DATETIME2(0) NOT NULL CONSTRAINT DF_instrucciones_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_instrucciones_pago PRIMARY KEY (id_instruccion),
        CONSTRAINT FK_instrucciones_pedido FOREIGN KEY (id_pedido) REFERENCES dbo.pedidos(id_pedido),
        CONSTRAINT CK_instrucciones_canal CHECK (canal_pago IN (
            'EFECTIVO', 'TARJETA', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'OTRO'
        )),
        CONSTRAINT CK_instrucciones_monto CHECK (monto_informado >= 0)
    );
END;


IF OBJECT_ID('dbo.comprobante', 'U') IS NULL
BEGIN
    -- Extiende 1:1 a dbo.pagos. Emisión del documento tributario.
    -- Alimenta el KPI3 (TCE).
    CREATE TABLE dbo.comprobante (
        id_comprobante UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_comprobante_id DEFAULT NEWID(),
        id_pago UNIQUEIDENTIFIER NOT NULL,
        tipo_comprobante VARCHAR(30) NOT NULL,
        numero_documento_cliente VARCHAR(20) NULL,
        razon_social_cliente NVARCHAR(150) NULL,
        serie VARCHAR(10) NULL,
        numero_correlativo INT NULL,
        fecha_emision DATETIME2(0) NULL,
        emitido BIT NOT NULL CONSTRAINT DF_comprobante_emitido DEFAULT (0),

        CONSTRAINT PK_comprobante PRIMARY KEY (id_comprobante),
        CONSTRAINT UQ_comprobante_pago UNIQUE (id_pago),
        CONSTRAINT UQ_comprobante_serie_numero UNIQUE (serie, numero_correlativo),
        CONSTRAINT FK_comprobante_pago FOREIGN KEY (id_pago) REFERENCES dbo.pagos(id_pago),
        CONSTRAINT CK_comprobante_tipo CHECK (tipo_comprobante IN (
            'BOLETA_DNI', 'BOLETA_SIMPLE', 'FACTURA_RUC'
        )),
        CONSTRAINT CK_comprobante_ruc CHECK (
            tipo_comprobante <> 'FACTURA_RUC'
            OR (numero_documento_cliente IS NOT NULL AND razon_social_cliente IS NOT NULL)
        ),
        CONSTRAINT CK_comprobante_fecha CHECK (
            emitido = 0 OR fecha_emision IS NOT NULL
        )
    );
END;


IF OBJECT_ID('dbo.servicios', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.servicios (
        id_servicio UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_servicios_id DEFAULT NEWID(),
        id_lead UNIQUEIDENTIFIER NOT NULL,
        id_payer UNIQUEIDENTIFIER NULL,
        id_mesa INT NOT NULL,
        tipo_servicio VARCHAR(30) NOT NULL CONSTRAINT DF_servicios_tipo DEFAULT ('SALON'),
        estado_servicio VARCHAR(30) NOT NULL CONSTRAINT DF_servicios_estado DEFAULT ('EN_PREPARACION'),
        responsable_atencion NVARCHAR(100) NULL,
        fecha_inicio_servicio DATETIME2(0) NOT NULL CONSTRAINT DF_servicios_inicio DEFAULT SYSUTCDATETIME(),
        fecha_fin_servicio DATETIME2(0) NULL,

        CONSTRAINT PK_servicios PRIMARY KEY (id_servicio),
        CONSTRAINT FK_servicios_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT FK_servicios_payer FOREIGN KEY (id_payer) REFERENCES dbo.payers(id_payer),
        CONSTRAINT FK_servicios_mesa FOREIGN KEY (id_mesa) REFERENCES dbo.mesas(id_mesa),
        CONSTRAINT CK_servicios_tipo CHECK (tipo_servicio = 'SALON'),
        CONSTRAINT CK_servicios_estado CHECK (estado_servicio IN (
            'EN_PREPARACION', 'SERVIDO', 'EN_CONSUMO', 'CUENTA_SOLICITADA',
            'FINALIZADO', 'CON_INCIDENCIA'
        )),
        CONSTRAINT CK_servicios_fechas CHECK (
            fecha_fin_servicio IS NULL OR fecha_fin_servicio >= fecha_inicio_servicio
        )
    );
END;


IF OBJECT_ID('dbo.servicio_detalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.servicio_detalle (
        id_detalle UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_sdet_id DEFAULT NEWID(),
        id_servicio UNIQUEIDENTIFIER NOT NULL,
        id_producto INT NOT NULL,
        cantidad INT NOT NULL CONSTRAINT DF_sdet_cant DEFAULT (1),
        hora_pedido DATETIME2(0) NOT NULL CONSTRAINT DF_sdet_pedido DEFAULT SYSUTCDATETIME(),
        hora_entrega_cocina DATETIME2(0) NULL,
        estado_item VARCHAR(20) NOT NULL CONSTRAINT DF_sdet_estado DEFAULT ('PENDIENTE'),

        CONSTRAINT PK_servicio_detalle PRIMARY KEY (id_detalle),
        CONSTRAINT FK_sdet_servicio FOREIGN KEY (id_servicio) REFERENCES dbo.servicios(id_servicio),
        CONSTRAINT FK_sdet_producto FOREIGN KEY (id_producto) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_sdet_estado CHECK (estado_item IN ('PENDIENTE', 'EN_COCINA', 'SERVIDO', 'DEVUELTO'))
    );
END;


IF OBJECT_ID('dbo.alertas_consumo', 'U') IS NULL
BEGIN
    -- Alertas de upselling en mesa (postre, bebida, recordatorio de cuenta).
    CREATE TABLE dbo.alertas_consumo (
        id_alerta UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_alcon_id DEFAULT NEWID(),
        id_servicio UNIQUEIDENTIFIER NOT NULL,
        tipo_alerta VARCHAR(30) NOT NULL,
        id_producto_sugerido INT NULL,
        mensaje_enviado NVARCHAR(255) NOT NULL,
        fecha_envio DATETIME2(0) NOT NULL CONSTRAINT DF_alcon_fecha DEFAULT SYSUTCDATETIME(),
        aceptada BIT NULL,

        CONSTRAINT PK_alertas_consumo PRIMARY KEY (id_alerta),
        CONSTRAINT FK_alcon_servicio FOREIGN KEY (id_servicio) REFERENCES dbo.servicios(id_servicio),
        CONSTRAINT FK_alcon_producto FOREIGN KEY (id_producto_sugerido) REFERENCES dbo.productos(id_producto),
        CONSTRAINT CK_alcon_tipo CHECK (tipo_alerta IN (
            'SUGERENCIA_POSTRE', 'SUGERENCIA_BEBIDA', 'RECORDATORIO_CUENTA'
        ))
    );
END;


IF OBJECT_ID('dbo.incidencias_servicio', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.incidencias_servicio (
        id_incidencia UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_inc_id DEFAULT NEWID(),
        id_servicio UNIQUEIDENTIFIER NOT NULL,
        tipo_incidencia VARCHAR(30) NOT NULL,
        descripcion NVARCHAR(500) NOT NULL,
        fecha_registro DATETIME2(0) NOT NULL CONSTRAINT DF_inc_reg DEFAULT SYSUTCDATETIME(),
        resuelta BIT NOT NULL CONSTRAINT DF_inc_res DEFAULT (0),
        fecha_resolucion DATETIME2(0) NULL,

        CONSTRAINT PK_incidencias_servicio PRIMARY KEY (id_incidencia),
        CONSTRAINT FK_inc_servicio FOREIGN KEY (id_servicio) REFERENCES dbo.servicios(id_servicio),
        CONSTRAINT CK_inc_tipo CHECK (tipo_incidencia IN ('DEMORA', 'PLATO_INCORRECTO', 'QUEJA_CALIDAD', 'OTRO')),
        CONSTRAINT CK_inc_fechas CHECK (
            fecha_resolucion IS NULL OR fecha_resolucion >= fecha_registro
        )
    );
END;


IF OBJECT_ID('dbo.resenas_servicio', 'U') IS NULL
BEGIN
    -- Encuesta 5 estrellas sobre un servicio. Una reseña por servicio.
    -- id_lead explícito por trazabilidad (también viene vía servicios).
    CREATE TABLE dbo.resenas_servicio (
        id_resena UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_resena_id DEFAULT NEWID(),
        id_servicio UNIQUEIDENTIFIER NOT NULL,
        id_lead UNIQUEIDENTIFIER NOT NULL,
        calificacion_estrellas TINYINT NOT NULL,
        comentario NVARCHAR(500) NULL,
        fecha_resena DATETIME2(0) NOT NULL CONSTRAINT DF_resena_fecha DEFAULT SYSUTCDATETIME(),

        CONSTRAINT PK_resenas_servicio PRIMARY KEY (id_resena),
        CONSTRAINT UQ_resenas_servicio UNIQUE (id_servicio),
        CONSTRAINT FK_resenas_servicio FOREIGN KEY (id_servicio) REFERENCES dbo.servicios(id_servicio),
        CONSTRAINT FK_resenas_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT CK_resenas_estrellas CHECK (calificacion_estrellas BETWEEN 1 AND 5)
    );
END;


IF OBJECT_ID('dbo.clientes_fichados_recuperacion', 'U') IS NULL
BEGIN
    -- Fichaje de clientes por mala calificación con cupón de recuperación.
    CREATE TABLE dbo.clientes_fichados_recuperacion (
        id_fichado UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_fich_id DEFAULT NEWID(),
        id_resena UNIQUEIDENTIFIER NOT NULL,
        id_lead UNIQUEIDENTIFIER NOT NULL,
        estrellas_obtenidas TINYINT NOT NULL,
        motivo_fichaje VARCHAR(50) NOT NULL CONSTRAINT DF_fich_motivo DEFAULT ('CALIFICACION_BAJA'),
        codigo_cupon_descuento VARCHAR(30) NOT NULL,
        porcentaje_descuento DECIMAL(5,2) NOT NULL CONSTRAINT DF_fich_desc DEFAULT (20.00),
        estado_gestion VARCHAR(30) NOT NULL CONSTRAINT DF_fich_estado DEFAULT ('FICHADO_PENDIENTE'),
        fecha_fichaje DATETIME2(0) NOT NULL CONSTRAINT DF_fich_fecha DEFAULT SYSUTCDATETIME(),
        fecha_contacto DATETIME2(0) NULL,

        CONSTRAINT PK_clientes_fichados PRIMARY KEY (id_fichado),
        CONSTRAINT UQ_fichados_resena UNIQUE (id_resena),
        CONSTRAINT UQ_fichados_cupon UNIQUE (codigo_cupon_descuento),
        CONSTRAINT FK_fichados_resena FOREIGN KEY (id_resena) REFERENCES dbo.resenas_servicio(id_resena),
        CONSTRAINT FK_fichados_lead FOREIGN KEY (id_lead) REFERENCES dbo.leads(id_lead),
        CONSTRAINT CK_fichados_estado CHECK (estado_gestion IN (
            'FICHADO_PENDIENTE', 'CUPON_ENVIADO', 'CANJEADO', 'EXPIRADO'
        )),
        CONSTRAINT CK_fichados_descuento CHECK (
            porcentaje_descuento > 0 AND porcentaje_descuento <= 100
        )
    );
END;



-- ============================================================
-- 6. ÍNDICES DE CONSULTA (OLTP)
-- ============================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_personal_documento')
    CREATE UNIQUE INDEX UX_personal_documento
    ON dbo.personal (tipo_documento, numero_documento)
    WHERE tipo_documento IS NOT NULL AND numero_documento IS NOT NULL;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_buyer_personas_telefono')
    CREATE UNIQUE INDEX UX_buyer_personas_telefono
    ON dbo.buyer_personas (telefono)
    WHERE telefono IS NOT NULL;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_buyer_personas_correo')
    CREATE UNIQUE INDEX UX_buyer_personas_correo
    ON dbo.buyer_personas (correo)
    WHERE correo IS NOT NULL;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_buyers_persona')
    CREATE UNIQUE INDEX UX_buyers_persona
    ON dbo.buyers (id_persona)
    WHERE id_persona IS NOT NULL;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_bpf_principal')
    CREATE UNIQUE INDEX UX_bpf_principal
    ON dbo.buyer_productos_favoritos (id_buyer)
    WHERE es_favorito_principal = 1;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_mensajes_externo')
    CREATE UNIQUE INDEX UX_mensajes_externo
    ON dbo.mensajes_chat (id_mensaje_externo)
    WHERE id_mensaje_externo IS NOT NULL;


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_personal_area')
    CREATE INDEX IX_personal_area ON dbo.personal (id_area);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_redes_sociales_administrador')
    CREATE INDEX IX_redes_sociales_administrador
    ON dbo.redes_sociales (id_personal_administrador);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_buyers_fecha_anuncio')
    CREATE INDEX IX_buyers_fecha_anuncio
    ON dbo.buyers (fecha_primer_contacto, id_anuncio_origen);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_formularios_fecha')
    CREATE INDEX IX_formularios_fecha
    ON dbo.formularios_captacion (fecha_envio)
    INCLUDE (id_buyer, id_formulario);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sesiones_formulario')
    CREATE INDEX IX_sesiones_formulario
    ON dbo.sesiones_chat (id_formulario, fecha_inicio)
    INCLUDE (id_buyer);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sesiones_abandono')
    CREATE INDEX IX_sesiones_abandono
    ON dbo.sesiones_chat (fecha_abandono)
    INCLUDE (id_buyer, estado_sesion);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sesiones_espera')
    CREATE INDEX IX_sesiones_espera
    ON dbo.sesiones_chat (estado_sesion, fecha_hora_ultimo_mensaje);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_mensajes_sesion_fecha')
    CREATE INDEX IX_mensajes_sesion_fecha
    ON dbo.mensajes_chat (id_sesion, fecha_hora_mensaje)
    INCLUDE (tipo_remitente, tipo_mensaje);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_catalogo_envio')
    CREATE INDEX IX_catalogo_envio
    ON dbo.accesos_catalogo_web (fecha_envio_datos)
    INCLUDE (id_buyer, es_contacto_utilizable);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_leads_fecha')
    CREATE INDEX IX_leads_fecha
    ON dbo.leads (fecha_calificacion)
    INCLUDE (id_buyer);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_instrucciones_pedido_fecha')
    CREATE INDEX IX_instrucciones_pedido_fecha
    ON dbo.instrucciones_pago (id_pedido, fecha_envio);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_comprobante_emision')
    CREATE INDEX IX_comprobante_emision
    ON dbo.comprobante (fecha_emision)
    INCLUDE (id_pago, emitido);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_payers_fecha_activacion')
    CREATE INDEX IX_payers_fecha_activacion
    ON dbo.payers (fecha_activacion_servicio)
    INCLUDE (id_lead, id_pago, id_personal_cajero);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_servicios_lead_estado')
    CREATE INDEX IX_servicios_lead_estado
    ON dbo.servicios (id_lead, estado_servicio);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_sdet_servicio')
    CREATE INDEX IX_sdet_servicio
    ON dbo.servicio_detalle (id_servicio)
    INCLUDE (id_producto, cantidad, hora_pedido);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_alertas_servicio')
    CREATE INDEX IX_alertas_servicio
    ON dbo.alertas_consumo (id_servicio)
    INCLUDE (tipo_alerta, aceptada);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_incidencias_servicio')
    CREATE INDEX IX_incidencias_servicio
    ON dbo.incidencias_servicio (id_servicio)
    INCLUDE (tipo_incidencia, resuelta);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_resenas_lead_fecha')
    CREATE INDEX IX_resenas_lead_fecha
    ON dbo.resenas_servicio (id_lead, fecha_resena)
    INCLUDE (calificacion_estrellas);


IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_fichados_estado_fecha')
    CREATE INDEX IX_fichados_estado_fecha
    ON dbo.clientes_fichados_recuperacion (estado_gestion, fecha_fichaje)
    INCLUDE (id_lead, codigo_cupon_descuento);


-- Fin del script transaccional.


-- ============================================================
-- BLOQUE FINAL: endurecimiento de CHECK constraints.
-- Idempotente: sirve igual para una base recien creada (donde la tabla ya
-- se creo con el CHECK correcto y aqui se re-aplica sin efecto) que para una
-- base existente creada con la version anterior, donde los CHECK todavia
-- admiten DELIVERY / PARA_LLEVAR.
-- Si cambias un CHECK aqui, cambialo tambien en su CREATE TABLE de arriba.
-- IMPORTANTE: ejecutalo con la base vacia. Si quedan filas con DELIVERY o
-- PARA_LLEVAR, el ALTER ... ADD CONSTRAINT falla porque las viola.
-- Orden recomendado: ./run.sh reset_database.py  ->  BD.sql  ->  ./run.sh generate_load.py
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_sesiones_intencion' AND parent_object_id = OBJECT_ID('dbo.sesiones_chat'))
    ALTER TABLE dbo.sesiones_chat DROP CONSTRAINT CK_sesiones_intencion;
ALTER TABLE dbo.sesiones_chat
    ADD CONSTRAINT CK_sesiones_intencion CHECK (
        intencion_detectada IS NULL OR intencion_detectada IN (
            'PRECIOS', 'RESERVA', 'CARTA_GENERAL',
            'HORARIOS_UBICACION', 'OTRA'
        ));

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_leads_interes' AND parent_object_id = OBJECT_ID('dbo.leads'))
    ALTER TABLE dbo.leads DROP CONSTRAINT CK_leads_interes;
ALTER TABLE dbo.leads
    ADD CONSTRAINT CK_leads_interes CHECK (interes_principal IN (
        'PROMO_ALMUERZO', 'PROMO_CENA', 'RESERVA_MESA',
        'CARTA_BEBIDAS', 'OTRO'));

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_pedidos_tipo_consumo' AND parent_object_id = OBJECT_ID('dbo.pedidos'))
    ALTER TABLE dbo.pedidos DROP CONSTRAINT CK_pedidos_tipo_consumo;
ALTER TABLE dbo.pedidos
    ADD CONSTRAINT CK_pedidos_tipo_consumo CHECK (
        tipo_consumo IS NULL OR tipo_consumo = 'SALON');

IF EXISTS (SELECT 1 FROM sys.check_constraints
           WHERE name = 'CK_servicios_tipo' AND parent_object_id = OBJECT_ID('dbo.servicios'))
    ALTER TABLE dbo.servicios DROP CONSTRAINT CK_servicios_tipo;
ALTER TABLE dbo.servicios
    ADD CONSTRAINT CK_servicios_tipo CHECK (tipo_servicio = 'SALON');


