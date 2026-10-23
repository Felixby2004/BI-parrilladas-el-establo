-- SCRIPT FINAL: CARGA COMPLETA DE 15 HECHOS, CON TIEMPOS Y FILAS
-- 1. Cancelar la carga anterior. En SU MISMA pestaña:
--    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
--    SELECT @@TRANCOUNT; -- debe devolver 0
-- 2. Abrir este archivo y ejecutarlo COMPLETO (sin otra carga simultanea).
-- 3. Observar Mensajes: inicio/fin de cada preparacion y tabla.
--
-- Configurado en 0: CARGA LAS 15 TABLAS DE HECHOS COMPLETAS.
-- Reemplaza los datos actuales de hechos; no borra las dimensiones pobladas.
-- Mantiene VISTA -> DELETE -> INSERT DESDE VISTA para cada hecho.
-- Agrega 6 tablas auxiliares bajo mart_parrilla.etl; NO son dimensiones/hechos.
-- Se refrescan en cada ejecucion; materializan calculos una sola vez con indices.
-- Las vistas v_ETL_* ahora leen esa preparacion, no son reflejo en vivo del OLTP.
-- Ejecutar este archivo para refrescar antes de cada nueva carga.
--
-- Sin inventar tiempos de pago/cocina: TMC y TAI siguen sin ser medibles.
-- RecuperacionLead sigue siendo proxy de rescate de chat <=2h posterior a calificacion.
-- No se modifican tablas ni indices del origen. No cambiar origen/dimensiones
-- durante la ejecucion. No iniciar este archivo en dos pestañas a la vez.
-- Se detiene al primer error; tablas anteriores confirmadas permanecen cargadas.
-- Una cancelacion puede dejar una transaccion abierta: ROLLBACK en esa pestaña.
-- Revision estatica; no se ha medido en una instancia SQL Server aqui.
USE database_parrilla;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF @@TRANCOUNT<>0
    THROW 50000,N'Hay una transaccion abierta. Ejecuta ROLLBACK en esta pestaña antes de continuar.',1;
IF OBJECT_ID('tempdb..#ConfigHechos') IS NOT NULL DROP TABLE #ConfigHechos;
CREATE TABLE #ConfigHechos (SoloPendientes BIT NOT NULL);
INSERT #ConfigHechos VALUES (0); -- Carga completa de las 15 tablas. No cambiar.
IF OBJECT_ID('tempdb..#ResumenHechos') IS NOT NULL DROP TABLE #ResumenHechos;
CREATE TABLE #ResumenHechos
(
    Orden INT IDENTITY(1,1),Etapa NVARCHAR(30),Tabla NVARCHAR(128),
    Filas BIGINT,Inicio DATETIME2(3),Fin DATETIME2(3),
    Segundos DECIMAL(18,3),Estado NVARCHAR(20)
);
GO
USE mart_parrilla;
GO
IF SCHEMA_ID(N'etl') IS NULL EXEC(N'CREATE SCHEMA etl AUTHORIZATION dbo;');
GO
IF OBJECT_ID(N'etl.ContextoBuyer',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoBuyer
(
    id_buyer UNIQUEIDENTIFIER NOT NULL,
    fecha_primer_contacto DATETIME2(0) NOT NULL,
    KeyBuyer INT NOT NULL,
    KeyTipoBuyer INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyCampana INT NOT NULL,
    KeyAnuncio INT NOT NULL,
    KeyRedSocial INT NOT NULL,
    KeyProducto INT NOT NULL,
    KeyPersonal INT NOT NULL,
    CONSTRAINT PK_etl_ContextoBuyer PRIMARY KEY (id_buyer)
);
END;
GO
IF OBJECT_ID(N'etl.ContextoLead',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoLead
(
    id_lead UNIQUEIDENTIFIER NOT NULL,
    id_buyer UNIQUEIDENTIFIER NOT NULL,
    fecha_calificacion DATETIME2(0) NOT NULL,
    KeyLead INT NOT NULL,
    KeyBuyer INT NOT NULL,
    KeyCanal INT NOT NULL,
    KeyEstadoLead INT NOT NULL,
    KeyPerfilGustos INT NOT NULL,
    perfil_completo BIGINT NOT NULL,
    en_negociacion BIGINT NOT NULL,
    CONSTRAINT PK_etl_ContextoLead PRIMARY KEY (id_lead)
);
END;
GO
IF OBJECT_ID(N'etl.ContextoPago',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoPago
(
    id_pago UNIQUEIDENTIFIER NOT NULL,
    id_pedido UNIQUEIDENTIFIER NOT NULL,
    id_lead UNIQUEIDENTIFIER NOT NULL,
    fecha_pago DATETIME2(0) NOT NULL,
    estado_pago VARCHAR(20) NULL,
    aprobado BIGINT NOT NULL,
    KeyPago INT NOT NULL,
    KeyReservaPedido INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMedioPago INT NOT NULL,
    KeyFecha INT NOT NULL,
    CONSTRAINT PK_etl_ContextoPago PRIMARY KEY (id_pago)
);
END;
GO
IF OBJECT_ID(N'etl.ContextoServicio',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoServicio
(
    id_servicio UNIQUEIDENTIFIER NOT NULL,
    id_lead UNIQUEIDENTIFIER NOT NULL,
    fecha_fin_servicio DATETIME2(0) NULL,
    KeyServicio INT NOT NULL,
    KeyLead INT NOT NULL,
    KeyMesa INT NOT NULL,
    KeyPersonal INT NOT NULL,
    CONSTRAINT PK_etl_ContextoServicio PRIMARY KEY (id_servicio)
);
END;
GO
IF OBJECT_ID(N'etl.ContextoSesion',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoSesion
(
    id_sesion UNIQUEIDENTIFIER NOT NULL,
    id_buyer UNIQUEIDENTIFIER NOT NULL,
    fecha_inicio DATETIME2(0) NOT NULL,
    fecha_abandono DATETIME2(0) NULL,
    rescates_enviados BIGINT NOT NULL,
    rescatada INT NOT NULL,
    CONSTRAINT PK_etl_ContextoSesion PRIMARY KEY (id_sesion)
);
END;
GO
IF OBJECT_ID(N'etl.ContextoPrimerRegistroLead',N'U') IS NULL
BEGIN
CREATE TABLE etl.ContextoPrimerRegistroLead
(
    id_lead UNIQUEIDENTIFIER NOT NULL,
    KeyReservaPedido INT NOT NULL,
    CONSTRAINT PK_etl_ContextoPrimerRegistroLead PRIMARY KEY (id_lead)
);
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'etl.ContextoPago') AND name=N'IX_etl_PagoLead')
    CREATE INDEX IX_etl_PagoLead ON etl.ContextoPago (id_lead,fecha_pago,id_pago) INCLUDE (KeyReservaPedido,KeyPago,aprobado);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'etl.ContextoPago') AND name=N'IX_etl_PagoPedido')
    CREATE INDEX IX_etl_PagoPedido ON etl.ContextoPago (id_pedido,fecha_pago DESC,id_pago DESC) INCLUDE (aprobado);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'etl.ContextoSesion') AND name=N'IX_etl_SesionBuyer')
    CREATE INDEX IX_etl_SesionBuyer ON etl.ContextoSesion (id_buyer,fecha_abandono,id_sesion) INCLUDE (rescatada);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'etl.ContextoLead') AND name=N'IX_etl_LeadBuyer')
    CREATE INDEX IX_etl_LeadBuyer ON etl.ContextoLead (id_buyer,fecha_calificacion) INCLUDE (KeyLead);
GO
USE database_parrilla;
GO
CREATE OR ALTER VIEW dbo.v_PrepararHechos_Buyer
AS
SELECT b.id_buyer, b.fecha_primer_contacto,
       db.KeyBuyer,
       CASE WHEN bp.id_tipo_buyer IS NULL THEN 0 ELSE dt.KeyTipoBuyer END AS KeyTipoBuyer,
       dc.KeyCanal,
       CASE WHEN a.id_campana IS NULL THEN 0 ELSE dca.KeyCampana END AS KeyCampana,
       CASE WHEN b.id_anuncio_origen IS NULL THEN 0 ELSE da.KeyAnuncio END AS KeyAnuncio,
       CASE WHEN COALESCE(c.id_red_social, b.id_red_social_origen) IS NULL THEN 0 ELSE dr.KeyRedSocial END AS KeyRedSocial,
       CASE WHEN c.id_producto_gancho IS NULL THEN 0 ELSE dp.KeyProducto END AS KeyProducto,
       CASE WHEN rs.id_personal_administrador IS NULL THEN 0 ELSE dpe.KeyPersonal END AS KeyPersonal
FROM dbo.buyers b
LEFT JOIN dbo.buyer_personas bp ON bp.id_persona = b.id_persona
LEFT JOIN dbo.anuncios a ON a.id_anuncio = b.id_anuncio_origen
LEFT JOIN dbo.campanas c ON c.id_campana = a.id_campana
LEFT JOIN dbo.redes_sociales rs
    ON rs.id_red_social = COALESCE(c.id_red_social, b.id_red_social_origen)
INNER JOIN mart_parrilla.dbo.DimBuyer db
    ON db.idBuyer COLLATE DATABASE_DEFAULT = CAST(b.id_buyer AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimTipoBuyer dt
    ON dt.idTipoBuyer COLLATE DATABASE_DEFAULT = COALESCE(CAST(bp.id_tipo_buyer AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimCanal dc ON dc.Codigo COLLATE DATABASE_DEFAULT = b.canal_origen COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimCampana dca
    ON dca.idCampana COLLATE DATABASE_DEFAULT = COALESCE(CAST(a.id_campana AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimAnuncio da
    ON da.idAnuncio COLLATE DATABASE_DEFAULT = COALESCE(CAST(b.id_anuncio_origen AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimRedSocial dr
    ON dr.idRedSocial COLLATE DATABASE_DEFAULT = COALESCE(CAST(COALESCE(c.id_red_social, b.id_red_social_origen) AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimProducto dp
    ON dp.idProducto COLLATE DATABASE_DEFAULT = COALESCE(CAST(c.id_producto_gancho AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimPersonal dpe
    ON dpe.idPersonal COLLATE DATABASE_DEFAULT = COALESCE(CAST(rs.id_personal_administrador AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT;
GO

CREATE OR ALTER VIEW dbo.v_PrepararHechos_Lead
AS
WITH ultima_negociacion AS
(
    SELECT id_lead,estado_negociacion,
           ROW_NUMBER() OVER(PARTITION BY id_lead
             ORDER BY COALESCE(ultima_interaccion,fecha_inicio) DESC,
                      fecha_inicio DESC,id_negociacion DESC) AS orden
    FROM dbo.negociacion_leads
), tiene_bebida AS
(
    SELECT f.id_buyer,MIN(f.id_producto) AS id_producto
    FROM dbo.buyer_productos_favoritos f
    INNER JOIN dbo.bebida_detalle bd ON bd.id_producto=f.id_producto
    GROUP BY f.id_buyer
)
SELECT l.id_lead, l.id_buyer, l.fecha_calificacion,
       CAST(CASE WHEN ne.id_lead IS NULL THEN 0 ELSE 1 END AS BIGINT) AS en_negociacion,
       dl.KeyLead, db.KeyBuyer, dcan.KeyCanal,
       CASE WHEN o.estado_gestion IS NULL AND n.estado_negociacion IS NULL
            THEN 0 ELSE de.KeyEstadoLead END AS KeyEstadoLead,
       CASE WHEN pg.id_lead IS NULL THEN 0 ELSE dg.KeyPerfilGustos END AS KeyPerfilGustos,
       CAST(CASE WHEN bp.nombre IS NOT NULL AND LTRIM(RTRIM(bp.nombre)) <> N''
            AND pg.id_tipo_corte IS NOT NULL AND pg.id_termino_coccion IS NOT NULL
            AND l.interes_principal IS NOT NULL AND bebida.id_producto IS NOT NULL
            THEN 1 ELSE 0 END AS BIGINT) AS perfil_completo
FROM dbo.leads l
INNER JOIN dbo.buyers bo ON bo.id_buyer = l.id_buyer
LEFT JOIN dbo.buyer_personas bp ON bp.id_persona = bo.id_persona
LEFT JOIN dbo.perfil_operativo o ON o.id_lead = l.id_lead
LEFT JOIN dbo.perfil_gustos pg ON pg.id_lead = l.id_lead
LEFT JOIN ultima_negociacion n ON n.id_lead=l.id_lead AND n.orden=1
LEFT JOIN tiene_bebida bebida ON bebida.id_buyer=l.id_buyer
INNER JOIN mart_parrilla.dbo.DimLead dl
    ON dl.idLead COLLATE DATABASE_DEFAULT = CAST(l.id_lead AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimPerfilGustos dg
    ON dg.idLead COLLATE DATABASE_DEFAULT = COALESCE(CAST(pg.id_lead AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimEstadoLead de
    ON de.Codigo COLLATE DATABASE_DEFAULT = CASE WHEN o.estado_gestion IS NULL AND n.estado_negociacion IS NULL THEN N'__SIN_DATO__' ELSE CAST(CONCAT(COALESCE(o.estado_gestion,'SIN_GESTION'),N'|',COALESCE(n.estado_negociacion,'SIN_NEGOCIACION')) AS NVARCHAR(200)) END COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimBuyer db
    ON db.idBuyer COLLATE DATABASE_DEFAULT=CAST(l.id_buyer AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimCanal dcan
    ON dcan.Codigo COLLATE DATABASE_DEFAULT=bo.canal_origen COLLATE DATABASE_DEFAULT
LEFT JOIN (SELECT id_lead FROM dbo.negociacion_leads GROUP BY id_lead) ne ON ne.id_lead=l.id_lead;
GO

CREATE OR ALTER VIEW dbo.v_PrepararHechos_Pago
AS
SELECT p.id_pago, p.id_pedido, pe.id_lead, p.fecha_pago, p.estado_pago,
       CAST(CASE WHEN p.estado_pago = 'PAGADO' THEN 1 ELSE 0 END AS BIGINT) AS aprobado,
       dp.KeyPago, drp.KeyReservaPedido, dl.KeyLead,
       CASE WHEN p.metodo_pago IS NULL THEN 0 ELSE dm.KeyMedioPago END AS KeyMedioPago,
       df.KeyFecha
FROM dbo.pagos p
INNER JOIN dbo.pedidos pe ON pe.id_pedido = p.id_pedido
INNER JOIN mart_parrilla.dbo.DimPago dp
    ON dp.idPago COLLATE DATABASE_DEFAULT = CAST(p.id_pago AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimReservaPedido drp
    ON drp.idRegistro COLLATE DATABASE_DEFAULT = CAST(p.id_pedido AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT AND drp.TipoRegistro COLLATE DATABASE_DEFAULT = N'PEDIDO' COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimLead dl
    ON dl.idLead COLLATE DATABASE_DEFAULT = CAST(pe.id_lead AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimMedioPago dm ON dm.Codigo COLLATE DATABASE_DEFAULT = COALESCE(p.metodo_pago,'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha = CAST(p.fecha_pago AS DATE);
GO

CREATE OR ALTER VIEW dbo.v_PrepararHechos_Servicio
AS
SELECT s.id_servicio, s.id_lead, s.fecha_fin_servicio,
       ds.KeyServicio, dl.KeyLead, dm.KeyMesa,
       CAST(0 AS INT) AS KeyPersonal
FROM dbo.servicios s
INNER JOIN mart_parrilla.dbo.DimServicio ds
    ON ds.idServicio COLLATE DATABASE_DEFAULT = CAST(s.id_servicio AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimLead dl
    ON dl.idLead COLLATE DATABASE_DEFAULT = CAST(s.id_lead AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimMesa dm
    ON dm.idMesa COLLATE DATABASE_DEFAULT = CAST(s.id_mesa AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT;
GO

CREATE OR ALTER VIEW dbo.v_PrepararHechos_Sesion
AS
WITH rescates AS
(
    SELECT rc.id_sesion,COUNT_BIG(*) AS rescates_enviados,
           MAX(CASE WHEN mr.fecha_hora_mensaje>=s.fecha_abandono
                     AND mc.fecha_hora_mensaje>=mr.fecha_hora_mensaje
                     AND mc.fecha_hora_mensaje<=DATEADD(HOUR,2,mr.fecha_hora_mensaje)
                    THEN 1 ELSE 0 END) AS rescatada
    FROM dbo.rescates_chat rc
    INNER JOIN dbo.sesiones_chat s ON s.id_sesion=rc.id_sesion
    INNER JOIN dbo.mensajes_chat mr ON mr.id_mensaje=rc.id_mensaje_rescate AND mr.id_sesion=rc.id_sesion
    LEFT JOIN dbo.mensajes_chat mc ON mc.id_mensaje=rc.id_mensaje_respuesta_cliente AND mc.id_sesion=rc.id_sesion
    GROUP BY rc.id_sesion
)
SELECT s.id_sesion,s.id_buyer,s.fecha_inicio,s.fecha_abandono,
       COALESCE(r.rescates_enviados,CAST(0 AS BIGINT)) AS rescates_enviados,
       COALESCE(r.rescatada,0) AS rescatada
FROM dbo.sesiones_chat s
LEFT JOIN rescates r ON r.id_sesion=s.id_sesion;
GO

CREATE OR ALTER VIEW dbo.v_PrepararHechos_PrimerRegistroLead
AS
WITH registros AS
(
    SELECT p.id_lead,N'PEDIDO' AS TipoRegistro,
           CAST(p.id_pedido AS NVARCHAR(100)) AS idRegistro,p.fecha_pedido AS fecha
    FROM dbo.pedidos p
    UNION ALL
    SELECT r.id_lead,N'RESERVA',CAST(r.id_lead AS NVARCHAR(100)),CAST(r.fecha_reserva AS DATETIME2)
    FROM dbo.perfil_reserva r WHERE r.fecha_reserva IS NOT NULL
), primero AS
(
    SELECT *,ROW_NUMBER() OVER(PARTITION BY id_lead ORDER BY fecha,TipoRegistro,idRegistro) AS orden
    FROM registros
)
SELECT r.id_lead,d.KeyReservaPedido
FROM primero r
INNER JOIN mart_parrilla.dbo.DimReservaPedido d
    ON d.TipoRegistro COLLATE DATABASE_DEFAULT=r.TipoRegistro COLLATE DATABASE_DEFAULT
   AND d.idRegistro COLLATE DATABASE_DEFAULT=r.idRegistro COLLATE DATABASE_DEFAULT
WHERE r.orden=1;
GO

IF (SELECT SoloPendientes FROM #ConfigHechos)=0 OR OBJECT_ID(N'dbo.v_ETL_Buyer',N'V') IS NULL
    EXEC(N'CREATE OR ALTER VIEW dbo.v_ETL_Buyer
AS
SELECT id_buyer, fecha_primer_contacto, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, KeyPersonal
FROM mart_parrilla.etl.ContextoBuyer;');
GO

CREATE OR ALTER VIEW dbo.v_ETL_Lead
AS
SELECT id_lead, id_buyer, fecha_calificacion, KeyLead, KeyBuyer, KeyCanal, KeyEstadoLead, KeyPerfilGustos, perfil_completo, en_negociacion
FROM mart_parrilla.etl.ContextoLead;
GO

CREATE OR ALTER VIEW dbo.v_ETL_Pago
AS
SELECT id_pago, id_pedido, id_lead, fecha_pago, estado_pago, aprobado, KeyPago, KeyReservaPedido, KeyLead, KeyMedioPago, KeyFecha
FROM mart_parrilla.etl.ContextoPago;
GO

IF (SELECT SoloPendientes FROM #ConfigHechos)=0 OR OBJECT_ID(N'dbo.v_ETL_Servicio',N'V') IS NULL
    EXEC(N'CREATE OR ALTER VIEW dbo.v_ETL_Servicio
AS
SELECT id_servicio, id_lead, fecha_fin_servicio, KeyServicio, KeyLead, KeyMesa, KeyPersonal
FROM mart_parrilla.etl.ContextoServicio;');
GO

CREATE OR ALTER VIEW dbo.v_ETL_Sesion
AS
SELECT id_sesion, id_buyer, fecha_inicio, fecha_abandono, rescates_enviados, rescatada
FROM mart_parrilla.etl.ContextoSesion;
GO

CREATE OR ALTER VIEW dbo.v_HechoCostoLead
AS
WITH movimientos AS
(
    SELECT g.fecha_gasto AS fecha, g.id_anuncio,
           CAST(g.importe_gastado AS DECIMAL(18,2)) AS importe,
           CAST(0 AS BIGINT) AS leads
    FROM dbo.gastos_anuncios_diarios g
    UNION ALL
    SELECT x.fecha, x.id_anuncio_origen, CAST(0 AS DECIMAL(18,2)), COUNT_BIG(*)
    FROM
    (
        SELECT b.id_buyer, b.id_anuncio_origen,
               CAST(MIN(l.fecha_calificacion) AS DATE) AS fecha
        FROM dbo.buyers b
        INNER JOIN dbo.leads l ON l.id_buyer = b.id_buyer
        WHERE b.id_anuncio_origen IS NOT NULL
        GROUP BY b.id_buyer, b.id_anuncio_origen
    ) x
    GROUP BY x.fecha, x.id_anuncio_origen
)
SELECT df.KeyFecha, dpe.KeyPersonal, dc.KeyCampana, da.KeyAnuncio,
       dr.KeyRedSocial,
       CASE WHEN c.id_producto_gancho IS NULL THEN 0 ELSE dp.KeyProducto END AS KeyProducto,
       SUM(m.importe) AS importe_gastado, SUM(m.leads) AS leads_convertidos
FROM movimientos m
INNER JOIN dbo.anuncios a ON a.id_anuncio = m.id_anuncio
INNER JOIN dbo.campanas c ON c.id_campana = a.id_campana
INNER JOIN dbo.redes_sociales r ON r.id_red_social = c.id_red_social
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha = m.fecha
INNER JOIN mart_parrilla.dbo.DimPersonal dpe
    ON dpe.idPersonal COLLATE DATABASE_DEFAULT = CAST(r.id_personal_administrador AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimCampana dc
    ON dc.idCampana COLLATE DATABASE_DEFAULT = CAST(c.id_campana AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimAnuncio da
    ON da.idAnuncio COLLATE DATABASE_DEFAULT = CAST(a.id_anuncio AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimRedSocial dr
    ON dr.idRedSocial COLLATE DATABASE_DEFAULT = CAST(r.id_red_social AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimProducto dp
    ON dp.idProducto COLLATE DATABASE_DEFAULT = COALESCE(CAST(c.id_producto_gancho AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
GROUP BY df.KeyFecha,dpe.KeyPersonal,dc.KeyCampana,da.KeyAnuncio,
         dr.KeyRedSocial, CASE WHEN c.id_producto_gancho IS NULL THEN 0 ELSE dp.KeyProducto END;
GO

CREATE OR ALTER VIEW dbo.v_HechoInicioWhatsApp
AS
WITH formularios_con_chat AS
(
    SELECT sc.id_formulario,sc.id_buyer
    FROM dbo.sesiones_chat sc
    INNER JOIN dbo.formularios_captacion f
        ON f.id_formulario=sc.id_formulario AND f.id_buyer=sc.id_buyer
    WHERE sc.fecha_inicio>=f.fecha_envio
      AND sc.fecha_inicio<=DATEADD(DAY,7,f.fecha_envio)
    GROUP BY sc.id_formulario,sc.id_buyer
)
SELECT df.KeyFecha, b.KeyBuyer, b.KeyTipoBuyer, b.KeyCanal, b.KeyCampana, b.KeyAnuncio, b.KeyRedSocial, b.KeyProducto, COUNT_BIG(*) AS formularios_enviados,
       SUM(CAST(CASE WHEN w.id_formulario IS NULL THEN 0 ELSE 1 END AS BIGINT)) AS inicio_whatsapp
FROM dbo.formularios_captacion f
LEFT JOIN formularios_con_chat w ON w.id_formulario=f.id_formulario AND w.id_buyer=f.id_buyer
INNER JOIN dbo.v_ETL_Buyer b ON b.id_buyer = f.id_buyer
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha = CAST(f.fecha_envio AS DATE)
GROUP BY df.KeyFecha, b.KeyBuyer, b.KeyTipoBuyer, b.KeyCanal, b.KeyCampana, b.KeyAnuncio, b.KeyRedSocial, b.KeyProducto;
GO

CREATE OR ALTER VIEW dbo.v_HechoRescateConversaciones
AS
SELECT df.KeyFecha, b.KeyBuyer, b.KeyTipoBuyer, b.KeyCanal, b.KeyCampana, b.KeyAnuncio, b.KeyRedSocial, b.KeyProducto, COUNT_BIG(*) AS sesiones_iniciadas,
       SUM(CAST(CASE WHEN s.fecha_abandono IS NOT NULL THEN 1 ELSE 0 END AS BIGINT)) AS sesiones_abandonadas,
       SUM(s.rescates_enviados) AS rescates_enviados,
       SUM(CAST(s.rescatada AS BIGINT)) AS sesiones_rescatadas
FROM dbo.v_ETL_Sesion s
INNER JOIN dbo.v_ETL_Buyer b ON b.id_buyer=s.id_buyer
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(s.fecha_inicio AS DATE)
GROUP BY df.KeyFecha, b.KeyBuyer, b.KeyTipoBuyer, b.KeyCanal, b.KeyCampana, b.KeyAnuncio, b.KeyRedSocial, b.KeyProducto;
GO

CREATE OR ALTER VIEW dbo.v_HechoConversionBuyerLead
AS
SELECT df.KeyFecha, b.KeyBuyer, b.KeyTipoBuyer, b.KeyCanal, b.KeyCampana, b.KeyAnuncio, b.KeyRedSocial, b.KeyProducto, CAST(1 AS BIGINT) AS buyers_captados,
       CAST(CASE WHEN l.id_buyer IS NULL THEN 0 ELSE 1 END AS BIGINT) AS leads_convertidos
FROM dbo.v_ETL_Buyer b
LEFT JOIN (SELECT id_buyer FROM dbo.leads GROUP BY id_buyer) l ON l.id_buyer=b.id_buyer
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(b.fecha_primer_contacto AS DATE);
GO

CREATE OR ALTER VIEW dbo.v_HechoCalificacionLead
AS
SELECT df.KeyFecha, l.KeyLead,l.KeyCanal,l.KeyPerfilGustos,l.KeyEstadoLead,
       CAST(1 AS BIGINT) AS leads_registrados, l.perfil_completo AS leads_informacion_completa
FROM dbo.v_ETL_Lead l
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(l.fecha_calificacion AS DATE);
GO

CREATE OR ALTER VIEW dbo.v_HechoNegociacionLead
AS
SELECT df.KeyFecha,l.KeyLead,l.KeyCanal,l.KeyEstadoLead,
       COALESCE(r.KeyReservaPedido,0) AS KeyReservaPedido,
       CAST(1 AS BIGINT) AS leads_registrados,
       l.en_negociacion AS leads_en_negociacion,
       CAST(CASE WHEN r.id_lead IS NULL THEN 0 ELSE 1 END AS BIGINT) AS leads_con_reserva_pedido
FROM mart_parrilla.etl.ContextoLead l
LEFT JOIN mart_parrilla.etl.ContextoPrimerRegistroLead r ON r.id_lead=l.id_lead
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(l.fecha_calificacion AS DATE);
GO

CREATE OR ALTER VIEW dbo.v_HechoConversionLeadPayer
AS
WITH primer_pago AS
(
    SELECT p.*,ROW_NUMBER() OVER(PARTITION BY p.id_lead ORDER BY p.fecha_pago,p.id_pago) AS orden
    FROM dbo.v_ETL_Pago p WHERE p.aprobado=1
)
SELECT df.KeyFecha,l.KeyLead,l.KeyCanal,l.KeyEstadoLead,
       CASE WHEN p.id_pago IS NULL THEN 0 ELSE p.KeyReservaPedido END AS KeyReservaPedido,
       CASE WHEN p.id_pago IS NULL THEN 0 ELSE p.KeyPago END AS KeyPago,
       CAST(1 AS BIGINT) AS leads_registrados,
       CAST(CASE WHEN p.id_pago IS NULL THEN 0 ELSE 1 END AS BIGINT) AS leads_pago_confirmado
FROM dbo.v_ETL_Lead l
LEFT JOIN primer_pago p ON p.id_lead=l.id_lead AND p.orden=1
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(l.fecha_calificacion AS DATE);
GO

CREATE OR ALTER VIEW dbo.v_HechoRecuperacionLead
AS
WITH primer_abandono AS
(
    SELECT l.id_lead,s.id_sesion,s.fecha_abandono,
           ROW_NUMBER() OVER(PARTITION BY l.id_lead ORDER BY s.fecha_abandono,s.id_sesion) AS orden
    FROM dbo.leads l
    INNER JOIN dbo.sesiones_chat s ON s.id_buyer=l.id_buyer
    WHERE s.fecha_abandono>=l.fecha_calificacion
)
SELECT df.KeyFecha,l.KeyLead,l.KeyCanal,l.KeyEstadoLead,
       CAST(1 AS BIGINT) AS leads_abandonados,CAST(s.rescatada AS BIGINT) AS leads_recuperados
FROM primer_abandono pa
INNER JOIN dbo.v_ETL_Lead l ON l.id_lead=pa.id_lead
INNER JOIN dbo.v_ETL_Sesion s ON s.id_sesion=pa.id_sesion
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(pa.fecha_abandono AS DATE)
WHERE pa.orden=1;
GO

CREATE OR ALTER VIEW dbo.v_HechoValidacionPago
AS
SELECT p.KeyReservaPedido,p.KeyPago,p.KeyFecha,p.KeyLead,p.KeyMedioPago,
       CAST(1 AS BIGINT) AS pagos_intentados,p.aprobado AS pagos_aprobados
FROM dbo.v_ETL_Pago p;
GO

CREATE OR ALTER VIEW dbo.v_HechoConfirmacionPago
AS
SELECT p.KeyReservaPedido,p.KeyPago,
       CAST(0 AS INT) AS KeyFechaSolicitud,CAST(0 AS INT) AS KeyFechaConfirmacion,
       p.KeyLead,p.KeyMedioPago,CAST(1 AS BIGINT) AS pagos_aprobados,
       CAST(NULL AS DATETIME2(3)) AS fecha_hora_solicitud,
       CAST(NULL AS DATETIME2(3)) AS fecha_hora_confirmacion,
       CAST(0 AS BIGINT) AS pagos_con_tiempo_medido,
       CAST(0 AS DECIMAL(20,3)) AS segundos_confirmacion_total
FROM dbo.v_ETL_Pago p WHERE p.aprobado=1;
GO

CREATE OR ALTER VIEW dbo.v_HechoEmisionComprobante
AS
WITH emitidos AS
(
    SELECT c.id_pago,c.id_comprobante,
           ROW_NUMBER() OVER(PARTITION BY c.id_pago ORDER BY
             CASE WHEN c.fecha_emision IS NULL THEN 1 ELSE 0 END,c.fecha_emision,c.id_comprobante) AS orden
    FROM dbo.comprobante c WHERE c.emitido=1
)
SELECT p.KeyReservaPedido,p.KeyPago,p.KeyFecha,p.KeyLead,p.KeyMedioPago,
       CASE WHEN c.id_comprobante IS NULL THEN 0 ELSE dc.KeyComprobante END AS KeyComprobante,
       CAST(1 AS BIGINT) AS pagos_aprobados,
       CAST(CASE WHEN c.id_comprobante IS NULL THEN 0 ELSE 1 END AS BIGINT) AS comprobantes_emitidos
FROM dbo.v_ETL_Pago p
LEFT JOIN emitidos c ON c.id_pago=p.id_pago AND c.orden=1
INNER JOIN mart_parrilla.dbo.DimComprobante dc
    ON dc.idComprobante COLLATE DATABASE_DEFAULT = COALESCE(CAST(c.id_comprobante AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
WHERE p.aprobado=1;
GO

CREATE OR ALTER VIEW dbo.v_HechoActivacionServicio
AS
WITH primer_payer AS
(
    SELECT py.id_pago,py.id_lead,py.id_personal_cajero,py.fecha_activacion_servicio,
           ROW_NUMBER() OVER(PARTITION BY py.id_pago,py.id_lead
             ORDER BY py.fecha_activacion_servicio,py.id_payer) AS orden
    FROM dbo.payers py
), cierre AS
(
    SELECT p.*,ROW_NUMBER() OVER
        (PARTITION BY p.id_pedido ORDER BY p.fecha_pago DESC,p.id_pago DESC) AS orden
    FROM dbo.v_ETL_Pago p WHERE p.aprobado=1
)
SELECT p.KeyReservaPedido,p.KeyPago,CAST(0 AS INT) AS KeyFechaConfirmacion,
       CASE WHEN py.fecha_activacion_servicio IS NULL THEN 0 ELSE df.KeyFecha END AS KeyFechaActivacion,
       p.KeyLead,p.KeyMedioPago,
       CASE WHEN py.id_personal_cajero IS NULL THEN 0 ELSE dp.KeyPersonal END AS KeyPersonal,
       CAST(1 AS BIGINT) AS pagos_aprobados,
       CAST(0 AS BIGINT) AS pedidos_enviados_cocina,
       CAST(0 AS BIGINT) AS pedidos_enviados_cocina_2min,
       CAST(NULL AS DATETIME2(3)) AS fecha_hora_confirmacion,
       CAST(py.fecha_activacion_servicio AS DATETIME2(3)) AS fecha_hora_activacion,
       CAST(0 AS BIGINT) AS activaciones_con_tiempo_medido,
       CAST(0 AS DECIMAL(20,3)) AS segundos_activacion_total
FROM cierre p
LEFT JOIN primer_payer py ON py.id_pago=p.id_pago AND py.id_lead=p.id_lead AND py.orden=1
INNER JOIN mart_parrilla.dbo.DimPersonal dp
    ON dp.idPersonal COLLATE DATABASE_DEFAULT = COALESCE(CAST(py.id_personal_cajero AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=COALESCE(CAST(py.fecha_activacion_servicio AS DATE),CAST('00010101' AS DATE))
WHERE p.orden=1;
GO

CREATE OR ALTER VIEW dbo.v_HechoServicioSinIncidencia
AS
SELECT df.KeyFecha,s.KeyLead,s.KeyServicio,s.KeyMesa,s.KeyPersonal,
       CAST(1 AS BIGINT) AS servicios_finalizados,
       CAST(CASE WHEN i.id_servicio IS NULL THEN 1 ELSE 0 END AS BIGINT) AS servicios_sin_incidencia
FROM dbo.v_ETL_Servicio s
LEFT JOIN (SELECT id_servicio FROM dbo.incidencias_servicio GROUP BY id_servicio) i ON i.id_servicio=s.id_servicio
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(s.fecha_fin_servicio AS DATE)
WHERE s.fecha_fin_servicio IS NOT NULL;
GO

CREATE OR ALTER VIEW dbo.v_HechoAceptacionConsumo
AS
SELECT df.KeyFecha,s.KeyLead,s.KeyServicio,s.KeyMesa,s.KeyPersonal,
       CASE WHEN a.id_producto_sugerido IS NULL THEN 0 ELSE dp.KeyProducto END AS KeyProducto,
       dt.KeyTipoAlerta,COUNT_BIG(*) AS alertas_enviadas,
       SUM(CAST(CASE WHEN a.aceptada=1 THEN 1 ELSE 0 END AS BIGINT)) AS alertas_aceptadas
FROM dbo.alertas_consumo a
INNER JOIN dbo.v_ETL_Servicio s ON s.id_servicio=a.id_servicio
INNER JOIN mart_parrilla.dbo.DimProducto dp
    ON dp.idProducto COLLATE DATABASE_DEFAULT = COALESCE(CAST(a.id_producto_sugerido AS NVARCHAR(100)),N'__SIN_DATO__') COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimTipoAlerta dt ON dt.Codigo COLLATE DATABASE_DEFAULT = a.tipo_alerta COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(a.fecha_envio AS DATE)
GROUP BY df.KeyFecha,s.KeyLead,s.KeyServicio,s.KeyMesa,s.KeyPersonal,
         CASE WHEN a.id_producto_sugerido IS NULL THEN 0 ELSE dp.KeyProducto END,dt.KeyTipoAlerta;
GO

CREATE OR ALTER VIEW dbo.v_HechoSatisfaccionCliente
AS
SELECT df.KeyFecha,dl.KeyLead,s.KeyServicio,s.KeyMesa,s.KeyPersonal,dc.KeyCalificacion,
       COUNT_BIG(*) AS resenas_recibidas,
       SUM(CAST(CASE WHEN r.calificacion_estrellas IN (4,5) THEN 1 ELSE 0 END AS BIGINT)) AS resenas_satisfechas,
       SUM(CAST(r.calificacion_estrellas AS BIGINT)) AS estrellas_total
FROM dbo.resenas_servicio r
INNER JOIN dbo.v_ETL_Servicio s ON s.id_servicio=r.id_servicio
INNER JOIN mart_parrilla.dbo.DimLead dl
    ON dl.idLead COLLATE DATABASE_DEFAULT = CAST(r.id_lead AS NVARCHAR(100)) COLLATE DATABASE_DEFAULT
INNER JOIN mart_parrilla.dbo.DimCalificacion dc ON dc.Valor=r.calificacion_estrellas
INNER JOIN mart_parrilla.dbo.DimFecha df ON df.idFecha=CAST(r.fecha_resena AS DATE)
GROUP BY df.KeyFecha,dl.KeyLead,s.KeyServicio,s.KeyMesa,s.KeyPersonal,dc.KeyCalificacion;
GO

-- Preparacion y carga: NO hay GO dentro de este bloque.
DECLARE @SoloPendientes BIT=(SELECT SoloPendientes FROM #ConfigHechos);
DECLARE @Paso NVARCHAR(128),@Etapa NVARCHAR(30),@Inicio DATETIME2(3),@Fin DATETIME2(3);
DECLARE @Filas BIGINT,@Segundos DECIMAL(18,3),@Mensaje NVARCHAR(2048);
DECLARE @Esperado DECIMAL(38,2),@Obtenido DECIMAL(38,2);
DECLARE @InicioTotal DATETIME2(3)=SYSDATETIME();
BEGIN TRY
    SET @Paso=N'Miembros Sin dato'; SET @Etapa=N'Preparacion'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO: miembros Sin dato',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    -- Miembro tecnico reservado de DimFecha: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimFecha
               WHERE KeyFecha=0 AND idFecha<>'00010101')
        THROW 50001, N'La Key 0 de DimFecha ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimFecha WHERE KeyFecha=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimFecha ON;
        INSERT mart_parrilla.dbo.DimFecha (KeyFecha, idFecha, Anual, Semestre, Trimestre, Mes, NombreMes, Dia, DiaSemana)
        VALUES (0, '00010101', 0, 0, 0, 0, N'Sin fecha conocida', 0, N'Sin fecha conocida');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimFecha OFF;
    END;

    -- Miembro tecnico reservado de DimTipoBuyer: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimTipoBuyer
               WHERE KeyTipoBuyer=0 AND idTipoBuyer<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimTipoBuyer ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimTipoBuyer WHERE KeyTipoBuyer=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimTipoBuyer ON;
        INSERT mart_parrilla.dbo.DimTipoBuyer (KeyTipoBuyer, idTipoBuyer, Nombre)
        VALUES (0, N'__SIN_DATO__', N'No identificado');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimTipoBuyer OFF;
    END;

    -- Miembro tecnico reservado de DimPersonal: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPersonal
               WHERE KeyPersonal=0 AND idPersonal<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimPersonal ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPersonal WHERE KeyPersonal=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPersonal ON;
        INSERT mart_parrilla.dbo.DimPersonal (KeyPersonal, idPersonal, Nombres)
        VALUES (0, N'__SIN_DATO__', N'No identificado');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPersonal OFF;
    END;

    -- Miembro tecnico reservado de DimCampana: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimCampana
               WHERE KeyCampana=0 AND idCampana<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimCampana ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimCampana WHERE KeyCampana=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimCampana ON;
        INSERT mart_parrilla.dbo.DimCampana (KeyCampana, idCampana, Nombre)
        VALUES (0, N'__SIN_DATO__', N'Sin campana atribuida');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimCampana OFF;
    END;

    -- Miembro tecnico reservado de DimAnuncio: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimAnuncio
               WHERE KeyAnuncio=0 AND idAnuncio<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimAnuncio ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimAnuncio WHERE KeyAnuncio=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimAnuncio ON;
        INSERT mart_parrilla.dbo.DimAnuncio (KeyAnuncio, idAnuncio, Nombre)
        VALUES (0, N'__SIN_DATO__', N'Sin anuncio atribuido');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimAnuncio OFF;
    END;

    -- Miembro tecnico reservado de DimRedSocial: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimRedSocial
               WHERE KeyRedSocial=0 AND idRedSocial<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimRedSocial ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimRedSocial WHERE KeyRedSocial=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimRedSocial ON;
        INSERT mart_parrilla.dbo.DimRedSocial (KeyRedSocial, idRedSocial, Plataforma)
        VALUES (0, N'__SIN_DATO__', N'No identificada');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimRedSocial OFF;
    END;

    -- Miembro tecnico reservado de DimProducto: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimProducto
               WHERE KeyProducto=0 AND idProducto<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimProducto ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimProducto WHERE KeyProducto=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimProducto ON;
        INSERT mart_parrilla.dbo.DimProducto (KeyProducto, idProducto, Nombre)
        VALUES (0, N'__SIN_DATO__', N'No atribuido');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimProducto OFF;
    END;

    -- Miembro tecnico reservado de DimEstadoLead: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimEstadoLead
               WHERE KeyEstadoLead=0 AND Codigo<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimEstadoLead ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimEstadoLead WHERE KeyEstadoLead=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimEstadoLead ON;
        INSERT mart_parrilla.dbo.DimEstadoLead (KeyEstadoLead, Codigo, Estado)
        VALUES (0, N'__SIN_DATO__', N'No registrado');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimEstadoLead OFF;
    END;

    -- Miembro tecnico reservado de DimPerfilGustos: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPerfilGustos
               WHERE KeyPerfilGustos=0 AND idLead<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimPerfilGustos ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPerfilGustos WHERE KeyPerfilGustos=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPerfilGustos ON;
        INSERT mart_parrilla.dbo.DimPerfilGustos (KeyPerfilGustos, idLead)
        VALUES (0, N'__SIN_DATO__');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPerfilGustos OFF;
    END;

    -- Miembro tecnico reservado de DimReservaPedido: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimReservaPedido
               WHERE KeyReservaPedido=0 AND TipoRegistro<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimReservaPedido ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimReservaPedido WHERE KeyReservaPedido=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimReservaPedido ON;
        INSERT mart_parrilla.dbo.DimReservaPedido (KeyReservaPedido, TipoRegistro, idRegistro)
        VALUES (0, N'__SIN_DATO__', N'__SIN_DATO__');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimReservaPedido OFF;
    END;

    -- Miembro tecnico reservado de DimPago: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPago
               WHERE KeyPago=0 AND idPago<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimPago ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimPago WHERE KeyPago=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPago ON;
        INSERT mart_parrilla.dbo.DimPago (KeyPago, idPago)
        VALUES (0, N'__SIN_DATO__');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimPago OFF;
    END;

    -- Miembro tecnico reservado de DimMedioPago: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimMedioPago
               WHERE KeyMedioPago=0 AND Codigo<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimMedioPago ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimMedioPago WHERE KeyMedioPago=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimMedioPago ON;
        INSERT mart_parrilla.dbo.DimMedioPago (KeyMedioPago, Codigo, Descripcion)
        VALUES (0, N'__SIN_DATO__', N'No registrado');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimMedioPago OFF;
    END;

    -- Miembro tecnico reservado de DimComprobante: Key=0.
    IF EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimComprobante
               WHERE KeyComprobante=0 AND idComprobante<>N'__SIN_DATO__')
        THROW 50001, N'La Key 0 de DimComprobante ya esta ocupada por otro registro.', 1;
    IF NOT EXISTS (SELECT 1 FROM mart_parrilla.dbo.DimComprobante WHERE KeyComprobante=0)
    BEGIN
        SET IDENTITY_INSERT mart_parrilla.dbo.DimComprobante ON;
        INSERT mart_parrilla.dbo.DimComprobante (KeyComprobante, idComprobante, TipoComprobante)
        VALUES (0, N'__SIN_DATO__', N'Sin comprobante emitido');
        SET IDENTITY_INSERT mart_parrilla.dbo.DimComprobante OFF;
    END;

    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME();
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,NULL,@Inicio,@Fin,DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0,N'OK');
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoBuyer'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoBuyer',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoBuyer;
    INSERT mart_parrilla.etl.ContextoBuyer (id_buyer, fecha_primer_contacto, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, KeyPersonal)
    SELECT id_buyer, fecha_primer_contacto, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, KeyPersonal FROM dbo.v_PrepararHechos_Buyer
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.buyers);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    END;
        SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoLead;
    INSERT mart_parrilla.etl.ContextoLead (id_lead, id_buyer, fecha_calificacion, KeyLead, KeyBuyer, KeyCanal, KeyEstadoLead, KeyPerfilGustos, perfil_completo, en_negociacion)
    SELECT id_lead, id_buyer, fecha_calificacion, KeyLead, KeyBuyer, KeyCanal, KeyEstadoLead, KeyPerfilGustos, perfil_completo, en_negociacion FROM dbo.v_PrepararHechos_Lead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.leads);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
        SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoPago'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoPago',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoPago;
    INSERT mart_parrilla.etl.ContextoPago (id_pago, id_pedido, id_lead, fecha_pago, estado_pago, aprobado, KeyPago, KeyReservaPedido, KeyLead, KeyMedioPago, KeyFecha)
    SELECT id_pago, id_pedido, id_lead, fecha_pago, estado_pago, aprobado, KeyPago, KeyReservaPedido, KeyLead, KeyMedioPago, KeyFecha FROM dbo.v_PrepararHechos_Pago
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.pagos);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoServicio'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoServicio',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoServicio;
    INSERT mart_parrilla.etl.ContextoServicio (id_servicio, id_lead, fecha_fin_servicio, KeyServicio, KeyLead, KeyMesa, KeyPersonal)
    SELECT id_servicio, id_lead, fecha_fin_servicio, KeyServicio, KeyLead, KeyMesa, KeyPersonal FROM dbo.v_PrepararHechos_Servicio
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.servicios);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    END;
        SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoSesion'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoSesion',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoSesion;
    INSERT mart_parrilla.etl.ContextoSesion (id_sesion, id_buyer, fecha_inicio, fecha_abandono, rescates_enviados, rescatada)
    SELECT id_sesion, id_buyer, fecha_inicio, fecha_abandono, rescates_enviados, rescatada FROM dbo.v_PrepararHechos_Sesion
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.sesiones_chat);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
        SET @Etapa=N'Preparacion'; SET @Paso=N'ContextoPrimerRegistroLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO PREPARACION: ContextoPrimerRegistroLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.etl.ContextoPrimerRegistroLead;
    INSERT mart_parrilla.etl.ContextoPrimerRegistroLead (id_lead, KeyReservaPedido)
    SELECT id_lead, KeyReservaPedido FROM dbo.v_PrepararHechos_PrimerRegistroLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM
    (SELECT id_lead FROM dbo.pedidos UNION
     SELECT id_lead FROM dbo.perfil_reserva WHERE fecha_reserva IS NOT NULL) x);
    IF @Filas<>@Esperado
        THROW 50002,N'Preparacion incompleta: faltan dimensiones o hay registros duplicados. No se han recargado hechos.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN PREPARACION: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoValidacionPago'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoValidacionPago',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoValidacionPago;
    INSERT INTO mart_parrilla.dbo.HechoValidacionPago
        (KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago, pagos_intentados, pagos_aprobados)
    SELECT KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago, pagos_intentados, pagos_aprobados
    FROM dbo.v_HechoValidacionPago
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoPago);
    SELECT @Obtenido=COALESCE(SUM(pagos_intentados),0) FROM mart_parrilla.dbo.HechoValidacionPago;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoConfirmacionPago'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoConfirmacionPago',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoConfirmacionPago;
    INSERT INTO mart_parrilla.dbo.HechoConfirmacionPago
        (KeyReservaPedido, KeyPago, KeyFechaSolicitud, KeyFechaConfirmacion, KeyLead, KeyMedioPago, pagos_aprobados, fecha_hora_solicitud, fecha_hora_confirmacion, pagos_con_tiempo_medido, segundos_confirmacion_total)
    SELECT KeyReservaPedido, KeyPago, KeyFechaSolicitud, KeyFechaConfirmacion, KeyLead, KeyMedioPago, pagos_aprobados, fecha_hora_solicitud, fecha_hora_confirmacion, pagos_con_tiempo_medido, segundos_confirmacion_total
    FROM dbo.v_HechoConfirmacionPago
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoPago WHERE aprobado=1);
    SELECT @Obtenido=COALESCE(SUM(pagos_aprobados),0) FROM mart_parrilla.dbo.HechoConfirmacionPago;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoEmisionComprobante'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoEmisionComprobante',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoEmisionComprobante;
    INSERT INTO mart_parrilla.dbo.HechoEmisionComprobante
        (KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago, KeyComprobante, pagos_aprobados, comprobantes_emitidos)
    SELECT KeyReservaPedido, KeyPago, KeyFecha, KeyLead, KeyMedioPago, KeyComprobante, pagos_aprobados, comprobantes_emitidos
    FROM dbo.v_HechoEmisionComprobante
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoPago WHERE aprobado=1);
    SELECT @Obtenido=COALESCE(SUM(pagos_aprobados),0) FROM mart_parrilla.dbo.HechoEmisionComprobante;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoServicioSinIncidencia'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoServicioSinIncidencia',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoServicioSinIncidencia;
    INSERT INTO mart_parrilla.dbo.HechoServicioSinIncidencia
        (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, servicios_finalizados, servicios_sin_incidencia)
    SELECT KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, servicios_finalizados, servicios_sin_incidencia
    FROM dbo.v_HechoServicioSinIncidencia
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoServicio WHERE fecha_fin_servicio IS NOT NULL);
    SELECT @Obtenido=COALESCE(SUM(servicios_finalizados),0) FROM mart_parrilla.dbo.HechoServicioSinIncidencia;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoAceptacionConsumo'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoAceptacionConsumo',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoAceptacionConsumo;
    INSERT INTO mart_parrilla.dbo.HechoAceptacionConsumo
        (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyProducto, KeyTipoAlerta, alertas_enviadas, alertas_aceptadas)
    SELECT KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyProducto, KeyTipoAlerta, alertas_enviadas, alertas_aceptadas
    FROM dbo.v_HechoAceptacionConsumo
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.alertas_consumo);
    SELECT @Obtenido=COALESCE(SUM(alertas_enviadas),0) FROM mart_parrilla.dbo.HechoAceptacionConsumo;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoSatisfaccionCliente'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoSatisfaccionCliente',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoSatisfaccionCliente;
    INSERT INTO mart_parrilla.dbo.HechoSatisfaccionCliente
        (KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyCalificacion, resenas_recibidas, resenas_satisfechas, estrellas_total)
    SELECT KeyFecha, KeyLead, KeyServicio, KeyMesa, KeyPersonal, KeyCalificacion, resenas_recibidas, resenas_satisfechas, estrellas_total
    FROM dbo.v_HechoSatisfaccionCliente
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.resenas_servicio);
    SELECT @Obtenido=COALESCE(SUM(resenas_recibidas),0) FROM mart_parrilla.dbo.HechoSatisfaccionCliente;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoCostoLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoCostoLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoCostoLead;
    INSERT INTO mart_parrilla.dbo.HechoCostoLead
        (KeyFecha, KeyPersonal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, importe_gastado, leads_convertidos)
    SELECT KeyFecha, KeyPersonal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, importe_gastado, leads_convertidos
    FROM dbo.v_HechoCostoLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COALESCE(SUM(importe_gastado),0) FROM dbo.gastos_anuncios_diarios);
    SELECT @Obtenido=COALESCE(SUM(importe_gastado),0) FROM mart_parrilla.dbo.HechoCostoLead;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoInicioWhatsApp'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoInicioWhatsApp',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoInicioWhatsApp;
    INSERT INTO mart_parrilla.dbo.HechoInicioWhatsApp
        (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, formularios_enviados, inicio_whatsapp)
    SELECT KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, formularios_enviados, inicio_whatsapp
    FROM dbo.v_HechoInicioWhatsApp
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM dbo.formularios_captacion);
    SELECT @Obtenido=COALESCE(SUM(formularios_enviados),0) FROM mart_parrilla.dbo.HechoInicioWhatsApp;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoRescateConversaciones'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoRescateConversaciones',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoRescateConversaciones;
    INSERT INTO mart_parrilla.dbo.HechoRescateConversaciones
        (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, sesiones_iniciadas, sesiones_abandonadas, rescates_enviados, sesiones_rescatadas)
    SELECT KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, sesiones_iniciadas, sesiones_abandonadas, rescates_enviados, sesiones_rescatadas
    FROM dbo.v_HechoRescateConversaciones
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoSesion);
    SELECT @Obtenido=COALESCE(SUM(sesiones_iniciadas),0) FROM mart_parrilla.dbo.HechoRescateConversaciones;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoConversionBuyerLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoConversionBuyerLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoConversionBuyerLead;
    INSERT INTO mart_parrilla.dbo.HechoConversionBuyerLead
        (KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, buyers_captados, leads_convertidos)
    SELECT KeyFecha, KeyBuyer, KeyTipoBuyer, KeyCanal, KeyCampana, KeyAnuncio, KeyRedSocial, KeyProducto, buyers_captados, leads_convertidos
    FROM dbo.v_HechoConversionBuyerLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoBuyer);
    SELECT @Obtenido=COALESCE(SUM(buyers_captados),0) FROM mart_parrilla.dbo.HechoConversionBuyerLead;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    IF @SoloPendientes=0
    BEGIN
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoCalificacionLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoCalificacionLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoCalificacionLead;
    INSERT INTO mart_parrilla.dbo.HechoCalificacionLead
        (KeyFecha, KeyLead, KeyCanal, KeyPerfilGustos, KeyEstadoLead, leads_registrados, leads_informacion_completa)
    SELECT KeyFecha, KeyLead, KeyCanal, KeyPerfilGustos, KeyEstadoLead, leads_registrados, leads_informacion_completa
    FROM dbo.v_HechoCalificacionLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoLead);
    SELECT @Obtenido=COALESCE(SUM(leads_registrados),0) FROM mart_parrilla.dbo.HechoCalificacionLead;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    END;
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoNegociacionLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoNegociacionLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoNegociacionLead;
    INSERT INTO mart_parrilla.dbo.HechoNegociacionLead
        (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido, leads_registrados, leads_en_negociacion, leads_con_reserva_pedido)
    SELECT KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido, leads_registrados, leads_en_negociacion, leads_con_reserva_pedido
    FROM dbo.v_HechoNegociacionLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoLead);
    SELECT @Obtenido=COALESCE(SUM(leads_registrados),0) FROM mart_parrilla.dbo.HechoNegociacionLead;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoConversionLeadPayer'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoConversionLeadPayer',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoConversionLeadPayer;
    INSERT INTO mart_parrilla.dbo.HechoConversionLeadPayer
        (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido, KeyPago, leads_registrados, leads_pago_confirmado)
    SELECT KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, KeyReservaPedido, KeyPago, leads_registrados, leads_pago_confirmado
    FROM dbo.v_HechoConversionLeadPayer
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoLead);
    SELECT @Obtenido=COALESCE(SUM(leads_registrados),0) FROM mart_parrilla.dbo.HechoConversionLeadPayer;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoRecuperacionLead'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoRecuperacionLead',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoRecuperacionLead;
    INSERT INTO mart_parrilla.dbo.HechoRecuperacionLead
        (KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, leads_abandonados, leads_recuperados)
    SELECT KeyFecha, KeyLead, KeyCanal, KeyEstadoLead, leads_abandonados, leads_recuperados
    FROM dbo.v_HechoRecuperacionLead
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(*) FROM mart_parrilla.etl.ContextoLead l WHERE EXISTS (SELECT 1 FROM mart_parrilla.etl.ContextoSesion s WHERE s.id_buyer=l.id_buyer AND s.fecha_abandono>=l.fecha_calificacion));
    SELECT @Obtenido=COALESCE(SUM(leads_abandonados),0) FROM mart_parrilla.dbo.HechoRecuperacionLead;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    SET @Etapa=N'Tabla hecho'; SET @Paso=N'HechoActivacionServicio'; SET @Inicio=SYSDATETIME();
    RAISERROR(N'INICIO TABLA: HechoActivacionServicio',0,1) WITH NOWAIT;
    BEGIN TRANSACTION;
    DELETE FROM mart_parrilla.dbo.HechoActivacionServicio;
    INSERT INTO mart_parrilla.dbo.HechoActivacionServicio
        (KeyReservaPedido, KeyPago, KeyFechaConfirmacion, KeyFechaActivacion, KeyLead, KeyMedioPago, KeyPersonal, pagos_aprobados, pedidos_enviados_cocina, pedidos_enviados_cocina_2min, fecha_hora_confirmacion, fecha_hora_activacion, activaciones_con_tiempo_medido, segundos_activacion_total)
    SELECT KeyReservaPedido, KeyPago, KeyFechaConfirmacion, KeyFechaActivacion, KeyLead, KeyMedioPago, KeyPersonal, pagos_aprobados, pedidos_enviados_cocina, pedidos_enviados_cocina_2min, fecha_hora_confirmacion, fecha_hora_activacion, activaciones_con_tiempo_medido, segundos_activacion_total
    FROM dbo.v_HechoActivacionServicio
    OPTION (RECOMPILE);
    SET @Filas=@@ROWCOUNT;
    SET @Esperado=(SELECT COUNT_BIG(DISTINCT id_pedido) FROM mart_parrilla.etl.ContextoPago WHERE aprobado=1);
    SELECT @Obtenido=COALESCE(SUM(pagos_aprobados),0) FROM mart_parrilla.dbo.HechoActivacionServicio;
    IF @Obtenido<>@Esperado
        THROW 50003,N'Los totales de la tabla hecho no coinciden con el origen. Se revierte esta tabla.',1;
    COMMIT TRANSACTION;
    SET @Fin=SYSDATETIME(); SET @Segundos=DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0;
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,@Filas,@Inicio,@Fin,@Segundos,N'OK');
    SET @Mensaje=CONCAT(N'FIN TABLA: ',@Paso,N' | filas=',@Filas,N' | segundos=',@Segundos);
    RAISERROR(@Mensaje,0,1) WITH NOWAIT;
    SELECT @Paso AS Tabla,@Filas AS FilasCargadas,@Segundos AS SegundosTranscurridos;
    SELECT Orden,Etapa,Tabla,Filas,Segundos,Estado FROM #ResumenHechos ORDER BY Orden;
    SELECT DATEDIFF_BIG(MILLISECOND,@InicioTotal,SYSDATETIME())/1000.0 AS SegundosTotales;
    RAISERROR(N'Carga terminada. TMC y TAI siguen sin tiempos suficientes para calcularse.',0,1) WITH NOWAIT;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimFecha OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimTipoBuyer OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimPersonal OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimCampana OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimAnuncio OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimRedSocial OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimProducto OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimEstadoLead OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimPerfilGustos OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimReservaPedido OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimPago OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimMedioPago OFF;
    SET IDENTITY_INSERT mart_parrilla.dbo.DimComprobante OFF;
    SET @Fin=SYSDATETIME();
    INSERT #ResumenHechos(Etapa,Tabla,Filas,Inicio,Fin,Segundos,Estado)
    VALUES(@Etapa,@Paso,NULL,@Inicio,@Fin,DATEDIFF_BIG(MILLISECOND,@Inicio,@Fin)/1000.0,N'ERROR');
    SELECT Orden,Etapa,Tabla,Filas,Segundos,Estado FROM #ResumenHechos ORDER BY Orden;
    SELECT @Paso AS PasoFallido,ERROR_MESSAGE() AS Error;
    THROW;
END CATCH;
GO
