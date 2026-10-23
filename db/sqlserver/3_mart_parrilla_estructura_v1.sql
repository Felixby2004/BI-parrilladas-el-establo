-- MART PARRILLA: estructura dimensional integrada para SQL Server / SSMS.
-- Fuente de diseno: informe completo El Establo y ejemplo docente.
-- SOLO DDL. Sin INSERT, MERGE, vistas ETL, DELETE ni DROP.
-- Ejecutar UNA VEZ, completo, en una NUEVA base mart_parrilla.
-- No modifica database_parrilla ni mart_parrilla_buyers.
-- Si mart_parrilla ya existe, el script se detiene para no mezclar esquemas.
--
-- DECISIONES Y LIMITES
-- 1. Una dimension compartida por concepto; una tabla hecho por indicador.
-- 2. Todas las dimensiones tienen Key INT IDENTITY y clave natural UNIQUE.
-- 3. Los hechos tienen PK compuesta por todas sus FK. Los de PAYERS
--    tambien identifican el pago y pedido mediante sus dimensiones.
--    El ETL debe respetar las claves y el grano documentado de cada hecho.
-- 4. Los identificadores de origen se conservan en NVARCHAR(100) para admitir
--    IDs numericos o UUID. Es una decision de almacenamiento del mart,
--    NO una afirmacion sobre los tipos reales del respaldo .bak.
--    CAST del id origen a NVARCHAR(100) al comparar en el futuro MERGE.
-- 5. No se pudo restaurar el .bak en este entorno. Origen y atributos se
--    fundamentan en los diagramas del informe y el avance, no en consultas
--    ejecutadas contra la base real. Validar mapeos antes de escribir ETL.
-- 6. Los catalogos derivados de textos usan Codigo como clave natural.
--    DimFecha usa idFecha DATE. No se inventan IDs transaccionales para ellos.
-- 7. FK NOT NULL: antes de cargar hechos, el ETL debera crear miembros
--    Sin dato / No aplica para relaciones inexistentes. Aqui NO se insertan.
--    No descartar leads sin pedido, pagos sin comprobante ni gasto sin leads.
-- 8. DimFecha conserva grano DIARIO en todas las fases. Se reutiliza con
--    distintos roles; los segundos exactos se calculan desde datetime origen.
--    Confirmacion y activacion conservan DATETIME2 para analizar hora,
--    minuto y segundo. No restar KeyFecha para calcular duraciones.
-- 9. Dimensiones con estado reflejan una carga tipo 1, sin historia SCD2.
--    Si el origen no conserva historia no puede reconstruirse el estado pasado.
-- 10. Los porcentajes y promedios se calculan desde sumas de sus componentes.
--     No sumar/promediar porcentajes precalculados. No sumar medidas entre
--     hechos diferentes ni unir hechos directamente con relaciones muchos-a-muchos.
-- 11. BUYERS: producto = gancho o interes principal UNICO por evento.
--     No expandir cada buyer a todos sus productos favoritos ni repartir gasto
--     arbitrariamente. Si falta atribucion, usar No identificado.
-- 12. CUSTOMERS: dimensiones propuestas desde indicadores C1-C3 y su ER;
--     el informe no incluye un cuadro dimensional explicito para esta fase.
-- 13. BEBIDA/TIPO LEAD/SUBESTADO: atributos que requieren regla de derivacion;
--     conservar NULL cuando el origen no permita obtenerlos; no fabricar datos.
-- 14. PAYERS incorpora KeyReservaPedido: Estado del pedido se analiza por
--     pedido, no como un unico estado de un lead que puede tener varios pedidos.
-- 15. Confirmar en el origen si existen solicitud, confirmacion y envio real
--     a cocina. Si faltan estas marcas, no se pueden reconstruir TMC/TAI exactos.
-- 16. TWF cuenta un resultado 0/1 por formulario, no todos sus chats.
-- 17. Version revisada: 20 dimensiones, 15 hechos. Sin datos de ejemplo.
--
USE master;
GO
IF DB_ID(N'mart_parrilla') IS NOT NULL
BEGIN
    RAISERROR(N'La base mart_parrilla ya existe. No se realizo ningun cambio.', 16, 1);
    SET NOEXEC ON;
END;
GO
CREATE DATABASE mart_parrilla;
GO
USE mart_parrilla;
GO

-- Origen previsto: Fechas de todas las operaciones. Una fila por dia; no por segundo.
CREATE TABLE dbo.DimFecha
(
    KeyFecha INT IDENTITY(1,1) NOT NULL,
    idFecha DATE NOT NULL,
    Anual SMALLINT NOT NULL,
    Semestre TINYINT NOT NULL,
    Trimestre TINYINT NOT NULL,
    Mes TINYINT NOT NULL,
    NombreMes NVARCHAR(20) NOT NULL,
    Dia TINYINT NOT NULL,
    DiaSemana NVARCHAR(20) NOT NULL,
    CONSTRAINT PK_DimFecha PRIMARY KEY (KeyFecha),
    CONSTRAINT UQ_DimFecha_Origen UNIQUE (idFecha)
);
GO

-- Origen previsto: tipos_buyer
CREATE TABLE dbo.DimTipoBuyer
(
    KeyTipoBuyer INT IDENTITY(1,1) NOT NULL,
    idTipoBuyer NVARCHAR(100) NOT NULL,
    Codigo NVARCHAR(30) NULL,
    Nombre NVARCHAR(100) NULL,
    CONSTRAINT PK_DimTipoBuyer PRIMARY KEY (KeyTipoBuyer),
    CONSTRAINT UQ_DimTipoBuyer_Origen UNIQUE (idTipoBuyer)
);
GO

-- Origen previsto: buyers.canal_origen y canales presentes en las operaciones; Codigo es la clave natural.
CREATE TABLE dbo.DimCanal
(
    KeyCanal INT IDENTITY(1,1) NOT NULL,
    Codigo NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(150) NULL,
    TipoCanal NVARCHAR(100) NULL,
    CONSTRAINT PK_DimCanal PRIMARY KEY (KeyCanal),
    CONSTRAINT UQ_DimCanal_Origen UNIQUE (Codigo)
);
GO

-- Origen previsto: personal + area_empresa
CREATE TABLE dbo.DimPersonal
(
    KeyPersonal INT IDENTITY(1,1) NOT NULL,
    idPersonal NVARCHAR(100) NOT NULL,
    Nombres NVARCHAR(100) NULL,
    Apellidos NVARCHAR(100) NULL,
    Cargo NVARCHAR(100) NULL,
    Area NVARCHAR(100) NULL,
    CONSTRAINT PK_DimPersonal PRIMARY KEY (KeyPersonal),
    CONSTRAINT UQ_DimPersonal_Origen UNIQUE (idPersonal)
);
GO

-- Origen previsto: redes_sociales
CREATE TABLE dbo.DimRedSocial
(
    KeyRedSocial INT IDENTITY(1,1) NOT NULL,
    idRedSocial NVARCHAR(100) NOT NULL,
    Plataforma NVARCHAR(50) NULL,
    NombrePagina NVARCHAR(150) NULL,
    UrlPagina NVARCHAR(500) NULL,
    CONSTRAINT PK_DimRedSocial PRIMARY KEY (KeyRedSocial),
    CONSTRAINT UQ_DimRedSocial_Origen UNIQUE (idRedSocial)
);
GO

-- Origen previsto: campanas + platos + tipos_buyer; atributos descriptivos, sin FK entre dimensiones.
CREATE TABLE dbo.DimCampana
(
    KeyCampana INT IDENTITY(1,1) NOT NULL,
    idCampana NVARCHAR(100) NOT NULL,
    Nombre NVARCHAR(150) NULL,
    FuenteUtm NVARCHAR(100) NULL,
    PlatoGancho NVARCHAR(150) NULL,
    TipoBuyerObjetivo NVARCHAR(100) NULL,
    CONSTRAINT PK_DimCampana PRIMARY KEY (KeyCampana),
    CONSTRAINT UQ_DimCampana_Origen UNIQUE (idCampana)
);
GO

-- Origen previsto: anuncios
CREATE TABLE dbo.DimAnuncio
(
    KeyAnuncio INT IDENTITY(1,1) NOT NULL,
    idAnuncio NVARCHAR(100) NOT NULL,
    Nombre NVARCHAR(150) NULL,
    TextoCta NVARCHAR(500) NULL,
    HorarioInicio TIME(0) NULL,
    HorarioFin TIME(0) NULL,
    CONSTRAINT PK_DimAnuncio PRIMARY KEY (KeyAnuncio),
    CONSTRAINT UQ_DimAnuncio_Origen UNIQUE (idAnuncio)
);
GO

-- Origen previsto: buyers + buyer_personas + tipos_buyer. TipoBuyer descriptivo; su Key se guarda en los hechos.
CREATE TABLE dbo.DimBuyer
(
    KeyBuyer INT IDENTITY(1,1) NOT NULL,
    idBuyer NVARCHAR(100) NOT NULL,
    idPersona NVARCHAR(100) NULL,
    Nombre NVARCHAR(150) NULL,
    TipoBuyer NVARCHAR(100) NULL,
    CONSTRAINT PK_DimBuyer PRIMARY KEY (KeyBuyer),
    CONSTRAINT UQ_DimBuyer_Origen UNIQUE (idBuyer)
);
GO

-- Origen previsto: platos; idProducto corresponde a platos.id_plato.
CREATE TABLE dbo.DimProducto
(
    KeyProducto INT IDENTITY(1,1) NOT NULL,
    idProducto NVARCHAR(100) NOT NULL,
    Nombre NVARCHAR(150) NULL,
    Categoria NVARCHAR(100) NULL,
    PrecioBase DECIMAL(18,2) NULL,
    EsGanchoPromocional BIT NULL,
    CONSTRAINT PK_DimProducto PRIMARY KEY (KeyProducto),
    CONSTRAINT UQ_DimProducto_Origen UNIQUE (idProducto)
);
GO

-- Origen previsto: leads + buyers + buyer_personas + tipos_buyer. TipoLead se deriva del perfil, no de una tabla supuesta. El estado del pedido pertenece a DimReservaPedido, no al lead.
CREATE TABLE dbo.DimLead
(
    KeyLead INT IDENTITY(1,1) NOT NULL,
    idLead NVARCHAR(100) NOT NULL,
    idBuyer NVARCHAR(100) NULL,
    NombreCliente NVARCHAR(150) NULL,
    TipoLead NVARCHAR(100) NULL,
    InteresPrincipal NVARCHAR(100) NULL,
    CONSTRAINT PK_DimLead PRIMARY KEY (KeyLead),
    CONSTRAINT UQ_DimLead_Origen UNIQUE (idLead)
);
GO

-- Origen previsto: Estados de perfil_operativo / negociacion_leads. Codigo identifica la combinacion Estado-Subestado, no una PK inexistente.
CREATE TABLE dbo.DimEstadoLead
(
    KeyEstadoLead INT IDENTITY(1,1) NOT NULL,
    Codigo NVARCHAR(200) NOT NULL,
    Estado NVARCHAR(100) NULL,
    Subestado NVARCHAR(100) NULL,
    CONSTRAINT PK_DimEstadoLead PRIMARY KEY (KeyEstadoLead),
    CONSTRAINT UQ_DimEstadoLead_Origen UNIQUE (Codigo)
);
GO

-- Origen previsto: perfil_gustos + tipos_corte + terminos_coccion; una fila por lead. Bebida solo si puede obtenerse del origen; si no, NULL. No expandir a multiples favoritos al contar leads.
CREATE TABLE dbo.DimPerfilGustos
(
    KeyPerfilGustos INT IDENTITY(1,1) NOT NULL,
    idLead NVARCHAR(100) NOT NULL,
    TipoCorte NVARCHAR(100) NULL,
    Categoria NVARCHAR(100) NULL,
    TerminoCoccion NVARCHAR(100) NULL,
    DescripcionPreferencia NVARCHAR(500) NULL,
    BebidaPreferida NVARCHAR(150) NULL,
    CONSTRAINT PK_DimPerfilGustos PRIMARY KEY (KeyPerfilGustos),
    CONSTRAINT UQ_DimPerfilGustos_Origen UNIQUE (idLead)
);
GO

-- Origen previsto: pedidos y perfil_reserva. Para reserva usar id_lead si esa es su PK. TipoRegistro distingue PEDIDO y RESERVA; evita colisiones de identificadores.
CREATE TABLE dbo.DimReservaPedido
(
    KeyReservaPedido INT IDENTITY(1,1) NOT NULL,
    TipoRegistro NVARCHAR(30) NOT NULL,
    idRegistro NVARCHAR(100) NOT NULL,
    TipoConsumo NVARCHAR(100) NULL,
    Estado NVARCHAR(100) NULL,
    CONSTRAINT PK_DimReservaPedido PRIMARY KEY (KeyReservaPedido),
    CONSTRAINT UQ_DimReservaPedido_Origen UNIQUE (TipoRegistro, idRegistro)
);
GO

-- Origen previsto: pagos; metodo_pago se conserva como descripcion, sin FK a otra dimension.
CREATE TABLE dbo.DimPago
(
    KeyPago INT IDENTITY(1,1) NOT NULL,
    idPago NVARCHAR(100) NOT NULL,
    EstadoPago NVARCHAR(100) NULL,
    MedioPago NVARCHAR(100) NULL,
    CONSTRAINT PK_DimPago PRIMARY KEY (KeyPago),
    CONSTRAINT UQ_DimPago_Origen UNIQUE (idPago)
);
GO

-- Origen previsto: Valores DISTINCT de pagos.metodo_pago / instrucciones_pago.canal_pago. No presupone un catalogo transaccional separado.
CREATE TABLE dbo.DimMedioPago
(
    KeyMedioPago INT IDENTITY(1,1) NOT NULL,
    Codigo NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(150) NULL,
    CONSTRAINT PK_DimMedioPago PRIMARY KEY (KeyMedioPago),
    CONSTRAINT UQ_DimMedioPago_Origen UNIQUE (Codigo)
);
GO

-- Origen previsto: comprobante
CREATE TABLE dbo.DimComprobante
(
    KeyComprobante INT IDENTITY(1,1) NOT NULL,
    idComprobante NVARCHAR(100) NOT NULL,
    TipoComprobante NVARCHAR(50) NULL,
    Serie NVARCHAR(30) NULL,
    NumeroCorrelativo NVARCHAR(50) NULL,
    DocumentoCliente NVARCHAR(30) NULL,
    Emitido BIT NULL,
    CONSTRAINT PK_DimComprobante PRIMARY KEY (KeyComprobante),
    CONSTRAINT UQ_DimComprobante_Origen UNIQUE (idComprobante)
);
GO

-- Origen previsto: mesas. Propuesta para CUSTOMERS, cuya seccion no incluye analisis dimensional explicito.
CREATE TABLE dbo.DimMesa
(
    KeyMesa INT IDENTITY(1,1) NOT NULL,
    idMesa NVARCHAR(100) NOT NULL,
    NumeroMesa NVARCHAR(30) NULL,
    Zona NVARCHAR(100) NULL,
    Capacidad INT NULL,
    CONSTRAINT PK_DimMesa PRIMARY KEY (KeyMesa),
    CONSTRAINT UQ_DimMesa_Origen UNIQUE (idMesa)
);
GO

-- Origen previsto: servicios. Propuesta CUSTOMERS; permite contar cada servicio una sola vez.
CREATE TABLE dbo.DimServicio
(
    KeyServicio INT IDENTITY(1,1) NOT NULL,
    idServicio NVARCHAR(100) NOT NULL,
    TipoServicio NVARCHAR(100) NULL,
    EstadoServicio NVARCHAR(100) NULL,
    CONSTRAINT PK_DimServicio PRIMARY KEY (KeyServicio),
    CONSTRAINT UQ_DimServicio_Origen UNIQUE (idServicio)
);
GO

-- Origen previsto: DISTINCT alertas_consumo.tipo_alerta. Propuesta CUSTOMERS.
CREATE TABLE dbo.DimTipoAlerta
(
    KeyTipoAlerta INT IDENTITY(1,1) NOT NULL,
    Codigo NVARCHAR(100) NOT NULL,
    Descripcion NVARCHAR(150) NULL,
    CONSTRAINT PK_DimTipoAlerta PRIMARY KEY (KeyTipoAlerta),
    CONSTRAINT UQ_DimTipoAlerta_Origen UNIQUE (Codigo)
);
GO

-- Origen previsto: DISTINCT resenas_servicio.calificacion_estrellas; descripcion derivada del valor. Propuesta CUSTOMERS.
CREATE TABLE dbo.DimCalificacion
(
    KeyCalificacion INT IDENTITY(1,1) NOT NULL,
    Valor TINYINT NOT NULL,
    Descripcion NVARCHAR(100) NULL,
    CONSTRAINT PK_DimCalificacion PRIMARY KEY (KeyCalificacion),
    CONSTRAINT UQ_DimCalificacion_Origen UNIQUE (Valor),
    CONSTRAINT CK_DimCalificacion_Valor CHECK (Valor BETWEEN 1 AND 5)
);
GO

-- BUYERS: HechoCostoLead
-- GRANO: Dia + personal administrador + campana + anuncio + red + producto gancho.
-- ETL: Agregar gasto y leads por separado al mismo grano ANTES de unir. Nunca multiplicar gasto por buyers o favoritos. Incluir gasto sin leads y leads con gasto cero.
CREATE TABLE dbo.HechoCostoLead
(
    KeyFecha INT NOT NULL,
    KeyPersonal INT NOT NULL,
    KeyCampana INT NOT NULL,
    KeyAnuncio INT NOT NULL,
    KeyRedSocial INT NOT NULL,
    KeyProducto INT NOT NULL,
    importe_gastado DECIMAL(18,2) NOT NULL,
    leads_convertidos BIGINT NOT NULL,
    CONSTRAINT PK_HechoCostoLead PRIMARY KEY (KeyFecha, KeyPersonal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto),
    CONSTRAINT FK_HechoCostoLead_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoCostoLead_Personal FOREIGN KEY (KeyPersonal) REFERENCES dbo.DimPersonal(KeyPersonal),
    CONSTRAINT FK_HechoCostoLead_Campana FOREIGN KEY (KeyCampana) REFERENCES dbo.DimCampana(KeyCampana),
    CONSTRAINT FK_HechoCostoLead_Anuncio FOREIGN KEY (KeyAnuncio) REFERENCES dbo.DimAnuncio(KeyAnuncio),
    CONSTRAINT FK_HechoCostoLead_RedSocial FOREIGN KEY (KeyRedSocial) REFERENCES dbo.DimRedSocial(KeyRedSocial),
    CONSTRAINT FK_HechoCostoLead_Producto FOREIGN KEY (KeyProducto) REFERENCES dbo.DimProducto(KeyProducto),
    CONSTRAINT CK_HechoCostoLead_NoNegativos CHECK (importe_gastado >= 0 AND leads_convertidos >= 0)
);
GO

-- BUYERS: HechoInicioWhatsApp
-- GRANO: Dia de envio + buyer + tipo + canal + atribucion unica.
-- ETL: TWF aparece en el grafico. Dimensiones propuestas por analogia con captacion. Ventana de 7 dias del ejemplo; confirmar regla antes del ETL.
CREATE TABLE dbo.HechoInicioWhatsApp
(
    KeyFecha INT NOT NULL,
    KeyBuyer INT NOT NULL,
    KeyTipoBuyer INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyCampana INT NOT NULL,
    KeyAnuncio INT NOT NULL,
    KeyRedSocial INT NOT NULL,
    KeyProducto INT NOT NULL,
    formularios_enviados BIGINT NOT NULL,
    inicio_whatsapp BIGINT NOT NULL,
    CONSTRAINT PK_HechoInicioWhatsApp PRIMARY KEY (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto),
    CONSTRAINT FK_HechoInicioWhatsApp_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoInicioWhatsApp_Buyer FOREIGN KEY (KeyBuyer) REFERENCES dbo.DimBuyer(KeyBuyer),
    CONSTRAINT FK_HechoInicioWhatsApp_TipoBuyer FOREIGN KEY (KeyTipoBuyer) REFERENCES dbo.DimTipoBuyer(KeyTipoBuyer),
    CONSTRAINT FK_HechoInicioWhatsApp_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoInicioWhatsApp_Campana FOREIGN KEY (KeyCampana) REFERENCES dbo.DimCampana(KeyCampana),
    CONSTRAINT FK_HechoInicioWhatsApp_Anuncio FOREIGN KEY (KeyAnuncio) REFERENCES dbo.DimAnuncio(KeyAnuncio),
    CONSTRAINT FK_HechoInicioWhatsApp_RedSocial FOREIGN KEY (KeyRedSocial) REFERENCES dbo.DimRedSocial(KeyRedSocial),
    CONSTRAINT FK_HechoInicioWhatsApp_Producto FOREIGN KEY (KeyProducto) REFERENCES dbo.DimProducto(KeyProducto),
    CONSTRAINT CK_HechoInicioWhatsApp_NoNegativos CHECK (formularios_enviados >= 0 AND inicio_whatsapp >= 0),
    CONSTRAINT CK_HechoInicioWhatsApp_Relacion CHECK (inicio_whatsapp <= formularios_enviados)
);
GO

-- BUYERS: HechoRescateConversaciones
-- GRANO: Dia de inicio de sesion + buyer + tipo + canal + atribucion unica.
-- ETL: Regla del informe: respuesta dentro de 2 horas del rescate; no usar las 24h del avance. Contar sesiones distintas, aunque tengan varios mensajes o rescates.
CREATE TABLE dbo.HechoRescateConversaciones
(
    KeyFecha INT NOT NULL,
    KeyBuyer INT NOT NULL,
    KeyTipoBuyer INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyCampana INT NOT NULL,
    KeyAnuncio INT NOT NULL,
    KeyRedSocial INT NOT NULL,
    KeyProducto INT NOT NULL,
    sesiones_iniciadas BIGINT NOT NULL,
    sesiones_abandonadas BIGINT NOT NULL,
    rescates_enviados BIGINT NOT NULL,
    sesiones_rescatadas BIGINT NOT NULL,
    CONSTRAINT PK_HechoRescateConversaciones PRIMARY KEY (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto),
    CONSTRAINT FK_HechoRescateConversaciones_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoRescateConversaciones_Buyer FOREIGN KEY (KeyBuyer) REFERENCES dbo.DimBuyer(KeyBuyer),
    CONSTRAINT FK_HechoRescateConversaciones_TipoBuyer FOREIGN KEY (KeyTipoBuyer) REFERENCES dbo.DimTipoBuyer(KeyTipoBuyer),
    CONSTRAINT FK_HechoRescateConversaciones_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoRescateConversaciones_Campana FOREIGN KEY (KeyCampana) REFERENCES dbo.DimCampana(KeyCampana),
    CONSTRAINT FK_HechoRescateConversaciones_Anuncio FOREIGN KEY (KeyAnuncio) REFERENCES dbo.DimAnuncio(KeyAnuncio),
    CONSTRAINT FK_HechoRescateConversaciones_RedSocial FOREIGN KEY (KeyRedSocial) REFERENCES dbo.DimRedSocial(KeyRedSocial),
    CONSTRAINT FK_HechoRescateConversaciones_Producto FOREIGN KEY (KeyProducto) REFERENCES dbo.DimProducto(KeyProducto),
    CONSTRAINT CK_HechoRescateConversaciones_NoNegativos CHECK (sesiones_iniciadas >= 0 AND sesiones_abandonadas >= 0 AND rescates_enviados >= 0 AND sesiones_rescatadas >= 0),
    CONSTRAINT CK_HechoRescateConversaciones_Relacion CHECK (sesiones_abandonadas <= sesiones_iniciadas AND sesiones_rescatadas <= sesiones_abandonadas)
);
GO

-- BUYERS: HechoConversionBuyerLead
-- GRANO: Dia de captacion + buyer + tipo + canal + atribucion unica.
-- ETL: Cohorte de captacion. No sumar leads_convertidos de este hecho con los de CPL: representan el mismo resultado visto en indicadores distintos.
CREATE TABLE dbo.HechoConversionBuyerLead
(
    KeyFecha INT NOT NULL,
    KeyBuyer INT NOT NULL,
    KeyTipoBuyer INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyCampana INT NOT NULL,
    KeyAnuncio INT NOT NULL,
    KeyRedSocial INT NOT NULL,
    KeyProducto INT NOT NULL,
    buyers_captados BIGINT NOT NULL,
    leads_convertidos BIGINT NOT NULL,
    CONSTRAINT PK_HechoConversionBuyerLead PRIMARY KEY (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto),
    CONSTRAINT FK_HechoConversionBuyerLead_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoConversionBuyerLead_Buyer FOREIGN KEY (KeyBuyer) REFERENCES dbo.DimBuyer(KeyBuyer),
    CONSTRAINT FK_HechoConversionBuyerLead_TipoBuyer FOREIGN KEY (KeyTipoBuyer) REFERENCES dbo.DimTipoBuyer(KeyTipoBuyer),
    CONSTRAINT FK_HechoConversionBuyerLead_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoConversionBuyerLead_Campana FOREIGN KEY (KeyCampana) REFERENCES dbo.DimCampana(KeyCampana),
    CONSTRAINT FK_HechoConversionBuyerLead_Anuncio FOREIGN KEY (KeyAnuncio) REFERENCES dbo.DimAnuncio(KeyAnuncio),
    CONSTRAINT FK_HechoConversionBuyerLead_RedSocial FOREIGN KEY (KeyRedSocial) REFERENCES dbo.DimRedSocial(KeyRedSocial),
    CONSTRAINT FK_HechoConversionBuyerLead_Producto FOREIGN KEY (KeyProducto) REFERENCES dbo.DimProducto(KeyProducto),
    CONSTRAINT CK_HechoConversionBuyerLead_NoNegativos CHECK (buyers_captados >= 0 AND leads_convertidos >= 0),
    CONSTRAINT CK_HechoConversionBuyerLead_Relacion CHECK (leads_convertidos <= buyers_captados)
);
GO

-- LEADS: HechoCalificacionLead
-- GRANO: Dia de calificacion + lead + canal + perfil + estado.
-- ETL: Una observacion por lead, sin duplicarlo por favoritos o negociaciones. Definir campos obligatorios del perfil antes del ETL.
CREATE TABLE dbo.HechoCalificacionLead
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyPerfilGustos INT NOT NULL,
    KeyEstadoLead INT NOT NULL,
    leads_registrados BIGINT NOT NULL,
    leads_informacion_completa BIGINT NOT NULL,
    CONSTRAINT PK_HechoCalificacionLead PRIMARY KEY (KeyFecha, KeyLead, KeyCanal, KeyPerfilGustos, KeyEstadoLead),
    CONSTRAINT FK_HechoCalificacionLead_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoCalificacionLead_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoCalificacionLead_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoCalificacionLead_PerfilGustos FOREIGN KEY (KeyPerfilGustos) REFERENCES dbo.DimPerfilGustos(KeyPerfilGustos),
    CONSTRAINT FK_HechoCalificacionLead_EstadoLead FOREIGN KEY (KeyEstadoLead) REFERENCES dbo.DimEstadoLead(KeyEstadoLead),
    CONSTRAINT CK_HechoCalificacionLead_NoNegativos CHECK (leads_registrados >= 0 AND leads_informacion_completa >= 0),
    CONSTRAINT CK_HechoCalificacionLead_Relacion CHECK (leads_informacion_completa <= leads_registrados),
    CONSTRAINT UQ_HechoCalificacionLead_Evento UNIQUE (KeyLead)
);
GO

-- LEADS: HechoNegociacionLead
-- GRANO: Dia de calificacion + lead + canal + estado + primera reserva/pedido.
-- ETL: Para TAN usar leads_con_reserva_pedido / leads_registrados. Conservar leads sin pedido; elegir primera reserva/pedido, no una fila por cada pedido.
CREATE TABLE dbo.HechoNegociacionLead
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyEstadoLead INT NOT NULL,
    KeyReservaPedido INT NOT NULL,
    leads_registrados BIGINT NOT NULL,
    leads_en_negociacion BIGINT NOT NULL,
    leads_con_reserva_pedido BIGINT NOT NULL,
    CONSTRAINT PK_HechoNegociacionLead PRIMARY KEY (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido),
    CONSTRAINT FK_HechoNegociacionLead_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoNegociacionLead_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoNegociacionLead_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoNegociacionLead_EstadoLead FOREIGN KEY (KeyEstadoLead) REFERENCES dbo.DimEstadoLead(KeyEstadoLead),
    CONSTRAINT FK_HechoNegociacionLead_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT CK_HechoNegociacionLead_NoNegativos CHECK (leads_registrados >= 0 AND leads_en_negociacion >= 0 AND leads_con_reserva_pedido >= 0),
    CONSTRAINT CK_HechoNegociacionLead_Relacion CHECK (leads_con_reserva_pedido <= leads_registrados AND leads_en_negociacion <= leads_registrados),
    CONSTRAINT UQ_HechoNegociacionLead_Evento UNIQUE (KeyLead)
);
GO

-- LEADS: HechoConversionLeadPayer
-- GRANO: Dia de calificacion + lead + canal + estado + primer pedido/pago confirmado.
-- ETL: Conservar leads sin pago; elegir un solo pedido/pago representativo para no duplicar denominador. Se analiza primera conversion, no todos los pagos.
CREATE TABLE dbo.HechoConversionLeadPayer
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyEstadoLead INT NOT NULL,
    KeyReservaPedido INT NOT NULL,
    KeyPago INT NOT NULL,
    leads_registrados BIGINT NOT NULL,
    leads_pago_confirmado BIGINT NOT NULL,
    CONSTRAINT PK_HechoConversionLeadPayer PRIMARY KEY (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido, KeyPago),
    CONSTRAINT FK_HechoConversionLeadPayer_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoConversionLeadPayer_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoConversionLeadPayer_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoConversionLeadPayer_EstadoLead FOREIGN KEY (KeyEstadoLead) REFERENCES dbo.DimEstadoLead(KeyEstadoLead),
    CONSTRAINT FK_HechoConversionLeadPayer_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT FK_HechoConversionLeadPayer_Pago FOREIGN KEY (KeyPago) REFERENCES dbo.DimPago(KeyPago),
    CONSTRAINT CK_HechoConversionLeadPayer_NoNegativos CHECK (leads_registrados >= 0 AND leads_pago_confirmado >= 0),
    CONSTRAINT CK_HechoConversionLeadPayer_Relacion CHECK (leads_pago_confirmado <= leads_registrados),
    CONSTRAINT UQ_HechoConversionLeadPayer_Evento UNIQUE (KeyLead)
);
GO

-- LEADS: HechoRecuperacionLead
-- GRANO: Primera fecha de abandono + lead + canal + estado del abandono.
-- ETL: Una fila por lead que abandono: leads_abandonados=1 y
-- leads_recuperados=0 o 1. Atribuir recuperacion al primer abandono,
-- sin repetir leads por mensajes, rescates o dias. La ventana y condicion
-- de recuperacion no estan definidas en el informe: acordarlas antes del ETL.
CREATE TABLE dbo.HechoRecuperacionLead
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyEstadoLead INT NOT NULL,
    leads_abandonados BIGINT NOT NULL,
    leads_recuperados BIGINT NOT NULL,
    CONSTRAINT PK_HechoRecuperacionLead PRIMARY KEY (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead),
    CONSTRAINT FK_HechoRecuperacionLead_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoRecuperacionLead_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoRecuperacionLead_Canal FOREIGN KEY (KeyCanal) REFERENCES dbo.DimCanal(KeyCanal),
    CONSTRAINT FK_HechoRecuperacionLead_EstadoLead FOREIGN KEY (KeyEstadoLead) REFERENCES dbo.DimEstadoLead(KeyEstadoLead),
    CONSTRAINT CK_HechoRecuperacionLead_NoNegativos CHECK (leads_abandonados >= 0 AND leads_recuperados >= 0),
    CONSTRAINT CK_HechoRecuperacionLead_Relacion CHECK (leads_recuperados <= leads_abandonados),
    CONSTRAINT UQ_HechoRecuperacionLead_Evento UNIQUE (KeyLead)
);
GO

-- PAYERS: HechoValidacionPago
-- GRANO: Intento identificado por DimPago, su pedido, dia, lead y medio de pago.
-- ETL: Agrupar intentos; no unir con detalle_pedido. P1 = pagos_aprobados / pagos_intentados.
CREATE TABLE dbo.HechoValidacionPago
(
    KeyReservaPedido INT NOT NULL,
    KeyPago INT NOT NULL,
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMedioPago INT NOT NULL,
    pagos_intentados BIGINT NOT NULL,
    pagos_aprobados BIGINT NOT NULL,
    CONSTRAINT PK_HechoValidacionPago PRIMARY KEY (KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago),
    CONSTRAINT FK_HechoValidacionPago_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoValidacionPago_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoValidacionPago_MedioPago FOREIGN KEY (KeyMedioPago) REFERENCES dbo.DimMedioPago(KeyMedioPago),
    CONSTRAINT FK_HechoValidacionPago_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT FK_HechoValidacionPago_Pago FOREIGN KEY (KeyPago) REFERENCES dbo.DimPago(KeyPago),
    CONSTRAINT CK_HechoValidacionPago_NoNegativos CHECK (pagos_intentados >= 0 AND pagos_aprobados >= 0),
    CONSTRAINT CK_HechoValidacionPago_Relacion CHECK (pagos_aprobados <= pagos_intentados)
);
GO

-- PAYERS: HechoConfirmacionPago
-- GRANO: Un pago aprobado, su pedido, lead, medio y fechas solicitud/confirmacion.
-- ETL: Incluir todos los pagos aprobados. Si faltan marcas, usar NULL,
-- pagos_con_tiempo_medido=0 y segundos_confirmacion_total=0 (aporte a suma,
-- no duracion observada). Con dos marcas validas: pagos_con_tiempo_medido=1.
-- TMC observado = SUM(segundos_confirmacion_total) /
-- NULLIF(SUM(pagos_con_tiempo_medido),0) / 60.0.
-- Coincide con P2 del informe cuando todos los aprobados tienen tiempos.
-- Mostrar cobertura: pagos_con_tiempo_medido / pagos_aprobados.
-- No imputar cero como tiempo de confirmacion para pagos sin marcas.
CREATE TABLE dbo.HechoConfirmacionPago
(
    KeyReservaPedido INT NOT NULL,
    KeyPago INT NOT NULL,
    KeyFechaSolicitud INT NOT NULL,
    KeyFechaConfirmacion INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMedioPago INT NOT NULL,
    pagos_aprobados BIGINT NOT NULL,
    fecha_hora_solicitud DATETIME2(3) NULL,
    fecha_hora_confirmacion DATETIME2(3) NULL,
    pagos_con_tiempo_medido BIGINT NOT NULL,
    segundos_confirmacion_total DECIMAL(20,3) NOT NULL,
    CONSTRAINT PK_HechoConfirmacionPago PRIMARY KEY (KeyReservaPedido, KeyPago, KeyFechaSolicitud, KeyFechaConfirmacion, KeyLead, KeyMedioPago),
    CONSTRAINT FK_HechoConfirmacionPago_FechaSolicitud FOREIGN KEY (KeyFechaSolicitud) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoConfirmacionPago_FechaConfirmacion FOREIGN KEY (KeyFechaConfirmacion) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoConfirmacionPago_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoConfirmacionPago_MedioPago FOREIGN KEY (KeyMedioPago) REFERENCES dbo.DimMedioPago(KeyMedioPago),
    CONSTRAINT FK_HechoConfirmacionPago_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT FK_HechoConfirmacionPago_Pago FOREIGN KEY (KeyPago) REFERENCES dbo.DimPago(KeyPago),
    CONSTRAINT CK_HechoConfirmacionPago_NoNegativos CHECK (pagos_aprobados >= 0 AND pagos_con_tiempo_medido >= 0 AND segundos_confirmacion_total >= 0),
    CONSTRAINT CK_HechoConfirmacionPago_Relacion CHECK (pagos_con_tiempo_medido <= pagos_aprobados),
    CONSTRAINT UQ_HechoConfirmacionPago_Evento UNIQUE (KeyPago),
    CONSTRAINT CK_HechoConfirmacionPago_Tiempos CHECK (
        (pagos_con_tiempo_medido = 0 AND segundos_confirmacion_total = 0)
        OR (pagos_con_tiempo_medido = 1 AND fecha_hora_solicitud IS NOT NULL
            AND fecha_hora_confirmacion IS NOT NULL
            AND fecha_hora_confirmacion >= fecha_hora_solicitud)
    )
);
GO

-- PAYERS: HechoEmisionComprobante
-- GRANO: Un pago aprobado + pedido + dia + lead + medio + primer comprobante valido (o Sin comprobante).
-- ETL: Incluir pagos sin comprobante mediante miembro Sin dato. Una aprobacion se cuenta una vez; no duplicarla por varias emisiones/reintentos. La regla requiere un comprobante valido por pago.
CREATE TABLE dbo.HechoEmisionComprobante
(
    KeyReservaPedido INT NOT NULL,
    KeyPago INT NOT NULL,
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMedioPago INT NOT NULL,
    KeyComprobante INT NOT NULL,
    pagos_aprobados BIGINT NOT NULL,
    comprobantes_emitidos BIGINT NOT NULL,
    CONSTRAINT PK_HechoEmisionComprobante PRIMARY KEY (KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago, KeyComprobante),
    CONSTRAINT FK_HechoEmisionComprobante_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoEmisionComprobante_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoEmisionComprobante_MedioPago FOREIGN KEY (KeyMedioPago) REFERENCES dbo.DimMedioPago(KeyMedioPago),
    CONSTRAINT FK_HechoEmisionComprobante_Comprobante FOREIGN KEY (KeyComprobante) REFERENCES dbo.DimComprobante(KeyComprobante),
    CONSTRAINT FK_HechoEmisionComprobante_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT FK_HechoEmisionComprobante_Pago FOREIGN KEY (KeyPago) REFERENCES dbo.DimPago(KeyPago),
    CONSTRAINT CK_HechoEmisionComprobante_NoNegativos CHECK (pagos_aprobados >= 0 AND comprobantes_emitidos >= 0),
    CONSTRAINT CK_HechoEmisionComprobante_Relacion CHECK (comprobantes_emitidos <= pagos_aprobados),
    CONSTRAINT UQ_HechoEmisionComprobante_Evento UNIQUE (KeyPago)
);
GO

-- PAYERS: HechoActivacionServicio
-- GRANO: Un pedido pagado + pago de cierre + fechas confirmacion/activacion + lead + medio + personal.
-- ETL: Una fila por pedido pagado; si hay cuotas, asociar un unico pago de
-- cierre. pagos_aprobados=1 representa ese cierre. Confirmar esta regla de
-- pagos parciales antes del ETL, pues el informe mezcla pedidos y pagos.
-- Incluir pedidos sin activacion con marca NULL y miembro fecha desconocida.
-- pedidos_enviados_cocina_2min=1 solo con ambas marcas y demora entre 0 y 120s.
-- segundos_activacion_total suma duraciones conocidas; activaciones_con_tiempo_medido
-- cuenta esas duraciones. P4 = pedidos_enviados_cocina_2min / pagos_aprobados.
-- Verificar si fecha_activacion_servicio equivale al envio real a cocina.
CREATE TABLE dbo.HechoActivacionServicio
(
    KeyReservaPedido INT NOT NULL,
    KeyPago INT NOT NULL,
    KeyFechaConfirmacion INT NOT NULL,
    KeyFechaActivacion INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMedioPago INT NOT NULL,
    KeyPersonal INT NOT NULL,
    pagos_aprobados BIGINT NOT NULL,
    pedidos_enviados_cocina BIGINT NOT NULL,
    pedidos_enviados_cocina_2min BIGINT NOT NULL,
    fecha_hora_confirmacion DATETIME2(3) NULL,
    fecha_hora_activacion DATETIME2(3) NULL,
    activaciones_con_tiempo_medido BIGINT NOT NULL,
    segundos_activacion_total DECIMAL(20,3) NOT NULL,
    CONSTRAINT PK_HechoActivacionServicio PRIMARY KEY (KeyReservaPedido, KeyPago, KeyFechaConfirmacion, KeyFechaActivacion, KeyLead, KeyMedioPago, KeyPersonal),
    CONSTRAINT FK_HechoActivacionServicio_FechaConfirmacion FOREIGN KEY (KeyFechaConfirmacion) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoActivacionServicio_FechaActivacion FOREIGN KEY (KeyFechaActivacion) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoActivacionServicio_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoActivacionServicio_MedioPago FOREIGN KEY (KeyMedioPago) REFERENCES dbo.DimMedioPago(KeyMedioPago),
    CONSTRAINT FK_HechoActivacionServicio_Personal FOREIGN KEY (KeyPersonal) REFERENCES dbo.DimPersonal(KeyPersonal),
    CONSTRAINT FK_HechoActivacionServicio_ReservaPedido FOREIGN KEY (KeyReservaPedido) REFERENCES dbo.DimReservaPedido(KeyReservaPedido),
    CONSTRAINT FK_HechoActivacionServicio_Pago FOREIGN KEY (KeyPago) REFERENCES dbo.DimPago(KeyPago),
    CONSTRAINT CK_HechoActivacionServicio_NoNegativos CHECK (pagos_aprobados >= 0 AND pedidos_enviados_cocina >= 0 AND pedidos_enviados_cocina_2min >= 0 AND activaciones_con_tiempo_medido >= 0 AND segundos_activacion_total >= 0),
    CONSTRAINT CK_HechoActivacionServicio_Relacion CHECK (pedidos_enviados_cocina_2min <= pedidos_enviados_cocina AND pedidos_enviados_cocina <= pagos_aprobados AND activaciones_con_tiempo_medido <= pedidos_enviados_cocina),
    CONSTRAINT UQ_HechoActivacionServicio_Evento UNIQUE (KeyReservaPedido)
);
GO

-- CUSTOMERS: HechoServicioSinIncidencia
-- GRANO: Dia de fin + lead + servicio + mesa + responsable.
-- ETL: Propuesta desde C1 y ER. Una fila por servicio finalizado; usar EXISTS para incidencias, no JOIN que multiplique servicios. Incidencia resuelta sigue siendo incidencia ocurrida.
CREATE TABLE dbo.HechoServicioSinIncidencia
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyServicio INT NOT NULL,
    KeyMesa INT NOT NULL,
    KeyPersonal INT NOT NULL,
    servicios_finalizados BIGINT NOT NULL,
    servicios_sin_incidencia BIGINT NOT NULL,
    CONSTRAINT PK_HechoServicioSinIncidencia PRIMARY KEY (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal),
    CONSTRAINT FK_HechoServicioSinIncidencia_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoServicioSinIncidencia_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoServicioSinIncidencia_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.DimServicio(KeyServicio),
    CONSTRAINT FK_HechoServicioSinIncidencia_Mesa FOREIGN KEY (KeyMesa) REFERENCES dbo.DimMesa(KeyMesa),
    CONSTRAINT FK_HechoServicioSinIncidencia_Personal FOREIGN KEY (KeyPersonal) REFERENCES dbo.DimPersonal(KeyPersonal),
    CONSTRAINT CK_HechoServicioSinIncidencia_NoNegativos CHECK (servicios_finalizados >= 0 AND servicios_sin_incidencia >= 0),
    CONSTRAINT CK_HechoServicioSinIncidencia_Relacion CHECK (servicios_sin_incidencia <= servicios_finalizados)
);
GO

-- CUSTOMERS: HechoAceptacionConsumo
-- GRANO: Dia de envio + lead + servicio + mesa + responsable + producto sugerido + tipo alerta.
-- ETL: Propuesta desde C2 y ER. Contar cada alerta una vez; Producto es el sugerido, no todos los productos servidos.
CREATE TABLE dbo.HechoAceptacionConsumo
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyServicio INT NOT NULL,
    KeyMesa INT NOT NULL,
    KeyPersonal INT NOT NULL,
    KeyProducto INT NOT NULL,
    KeyTipoAlerta INT NOT NULL,
    alertas_enviadas BIGINT NOT NULL,
    alertas_aceptadas BIGINT NOT NULL,
    CONSTRAINT PK_HechoAceptacionConsumo PRIMARY KEY (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyProducto, KeyTipoAlerta),
    CONSTRAINT FK_HechoAceptacionConsumo_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoAceptacionConsumo_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoAceptacionConsumo_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.DimServicio(KeyServicio),
    CONSTRAINT FK_HechoAceptacionConsumo_Mesa FOREIGN KEY (KeyMesa) REFERENCES dbo.DimMesa(KeyMesa),
    CONSTRAINT FK_HechoAceptacionConsumo_Personal FOREIGN KEY (KeyPersonal) REFERENCES dbo.DimPersonal(KeyPersonal),
    CONSTRAINT FK_HechoAceptacionConsumo_Producto FOREIGN KEY (KeyProducto) REFERENCES dbo.DimProducto(KeyProducto),
    CONSTRAINT FK_HechoAceptacionConsumo_TipoAlerta FOREIGN KEY (KeyTipoAlerta) REFERENCES dbo.DimTipoAlerta(KeyTipoAlerta),
    CONSTRAINT CK_HechoAceptacionConsumo_NoNegativos CHECK (alertas_enviadas >= 0 AND alertas_aceptadas >= 0),
    CONSTRAINT CK_HechoAceptacionConsumo_Relacion CHECK (alertas_aceptadas <= alertas_enviadas)
);
GO

-- CUSTOMERS: HechoSatisfaccionCliente
-- GRANO: Dia de resena + lead + servicio + mesa + responsable + calificacion.
-- ETL: Propuesta desde C3 y ER. Satisfecha = 4 o 5 estrellas. Una resena por evento, sin multiplicar por incidencias, items o cupones.
CREATE TABLE dbo.HechoSatisfaccionCliente
(
    KeyFecha INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyServicio INT NOT NULL,
    KeyMesa INT NOT NULL,
    KeyPersonal INT NOT NULL,
    KeyCalificacion INT NOT NULL,
    resenas_recibidas BIGINT NOT NULL,
    resenas_satisfechas BIGINT NOT NULL,
    estrellas_total BIGINT NOT NULL,
    CONSTRAINT PK_HechoSatisfaccionCliente PRIMARY KEY (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyCalificacion),
    CONSTRAINT FK_HechoSatisfaccionCliente_Fecha FOREIGN KEY (KeyFecha) REFERENCES dbo.DimFecha(KeyFecha),
    CONSTRAINT FK_HechoSatisfaccionCliente_Lead FOREIGN KEY (KeyLead) REFERENCES dbo.DimLead(KeyLead),
    CONSTRAINT FK_HechoSatisfaccionCliente_Servicio FOREIGN KEY (KeyServicio) REFERENCES dbo.DimServicio(KeyServicio),
    CONSTRAINT FK_HechoSatisfaccionCliente_Mesa FOREIGN KEY (KeyMesa) REFERENCES dbo.DimMesa(KeyMesa),
    CONSTRAINT FK_HechoSatisfaccionCliente_Personal FOREIGN KEY (KeyPersonal) REFERENCES dbo.DimPersonal(KeyPersonal),
    CONSTRAINT FK_HechoSatisfaccionCliente_Calificacion FOREIGN KEY (KeyCalificacion) REFERENCES dbo.DimCalificacion(KeyCalificacion),
    CONSTRAINT CK_HechoSatisfaccionCliente_NoNegativos CHECK (resenas_recibidas >= 0 AND resenas_satisfechas >= 0 AND estrellas_total >= 0),
    CONSTRAINT CK_HechoSatisfaccionCliente_Relacion CHECK (resenas_satisfechas <= resenas_recibidas)
);
GO

-- Fin. No se cargaron registros.
SET NOEXEC OFF;
GO
