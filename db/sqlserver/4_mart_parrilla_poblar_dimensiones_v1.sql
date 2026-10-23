-- POBLAMIENTO DE LAS 20 DIMENSIONES DE mart_parrilla
-- Origen: database_parrilla. Destino: mart_parrilla.
-- Basado en la estructura real enviada en Texto pegado.txt y las FK recibidas.
-- Requiere haber ejecutado el script de estructura dimensional revisado.
-- Ejecutar COMPLETO en SSMS. Ambas bases deben estar en la misma instancia.
--
-- Patron solicitado: MERGE ... WHEN NOT MATCHED THEN INSERT.
-- Inserta registros nuevos; NO actualiza atributos de registros existentes.
-- Una segunda ejecucion sin cambios en el origen no duplica claves naturales.
-- Si cambian estados/nombres/perfiles ya cargados, este patron NO los refresca;
-- para eso se necesitara agregar WHEN MATCHED THEN UPDATE en otra version.
-- Las Keys IDENTITY se generan solas; no se copian IDs OLTP a las Keys.
-- Se incluyen registros activos e inactivos para no perder relaciones historicas.
-- No se alteran tablas ni se borran datos. No se pueblan hechos.
-- No se crean miembros sinteticos Sin dato/No aplica: se definiran antes del ETL
-- de hechos, porque sus FK son NOT NULL y algunos vinculos del OLTP son opcionales.
--
-- CORRECCION COLLATION (error 468): las comparaciones de claves de texto
-- usan COLLATE DATABASE_DEFAULT en ambos lados. USE database_parrilla
-- determina la regla de comparacion; no se altera ninguna base ni columna.
-- idFecha y Valor no usan COLLATE porque son DATE y TINYINT.
--
-- DECISIONES DE MAPEO EXPLICITAS
-- TipoLead y TipoCanal quedan NULL: no existen esas columnas en el origen.
-- EstadoLead usa gestion + ultima negociacion; BebidaPreferida usa un favorito.
-- La fecha/hora de confirmacion de pagos NO aparece en la estructura enviada:
-- no inventar esa marca al construir posteriormente los hechos de PAYERS.
-- Este script se ha verificado contra los nombres y tipos proporcionados;
-- no ha sido ejecutado en una instancia SQL Server en este entorno.

USE database_parrilla;
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET LANGUAGE Spanish;

BEGIN TRY
    BEGIN TRANSACTION;

-- 01. DimFecha
-- Fechas DISTINCT de operaciones existentes; no genera calendario continuo ni fechas ficticias. No incluye nacimientos ni fechas de personal.
MERGE [mart_parrilla].dbo.DimFecha AS dim
USING
(
    SELECT f.idFecha,
           YEAR(f.idFecha) AS Anual,
           CASE WHEN MONTH(f.idFecha) <= 6 THEN 1 ELSE 2 END AS Semestre,
           DATEPART(QUARTER, f.idFecha) AS Trimestre,
           MONTH(f.idFecha) AS Mes,
           DATENAME(MONTH, f.idFecha) AS NombreMes,
           DAY(f.idFecha) AS Dia,
           DATENAME(WEEKDAY, f.idFecha) AS DiaSemana
    FROM
    (
        SELECT CAST(x.fecha_acceso AS DATE) AS idFecha FROM dbo.accesos_catalogo_web x
        UNION
        SELECT CAST(x.fecha_envio_datos AS DATE) AS idFecha FROM dbo.accesos_catalogo_web x
        UNION
        SELECT CAST(x.fecha_envio AS DATE) AS idFecha FROM dbo.alertas_consumo x
        UNION
        SELECT CAST(x.consentimiento_datos_fecha AS DATE) AS idFecha FROM dbo.buyer_personas x
        UNION
        SELECT CAST(x.consentimiento_marketing_fecha AS DATE) AS idFecha FROM dbo.buyer_personas x
        UNION
        SELECT CAST(x.fecha_registro AS DATE) AS idFecha FROM dbo.buyer_personas x
        UNION
        SELECT CAST(x.fecha_registro AS DATE) AS idFecha FROM dbo.buyer_productos_favoritos x
        UNION
        SELECT CAST(x.fecha_primer_contacto AS DATE) AS idFecha FROM dbo.buyers x
        UNION
        SELECT CAST(x.fecha_conversion AS DATE) AS idFecha FROM dbo.buyers x
        UNION
        SELECT CAST(x.fecha_actualizacion AS DATE) AS idFecha FROM dbo.buyers x
        UNION
        SELECT CAST(x.fecha_creacion AS DATE) AS idFecha FROM dbo.campanas x
        UNION
        SELECT CAST(x.fecha_inicio AS DATE) AS idFecha FROM dbo.campanas x
        UNION
        SELECT CAST(x.fecha_fin AS DATE) AS idFecha FROM dbo.campanas x
        UNION
        SELECT CAST(x.fecha_fichaje AS DATE) AS idFecha FROM dbo.clientes_fichados_recuperacion x
        UNION
        SELECT CAST(x.fecha_contacto AS DATE) AS idFecha FROM dbo.clientes_fichados_recuperacion x
        UNION
        SELECT CAST(x.fecha_emision AS DATE) AS idFecha FROM dbo.comprobante x
        UNION
        SELECT CAST(x.fecha_envio AS DATE) AS idFecha FROM dbo.formularios_captacion x
        UNION
        SELECT CAST(x.fecha_gasto AS DATE) AS idFecha FROM dbo.gastos_anuncios_diarios x
        UNION
        SELECT CAST(x.fecha_registro AS DATE) AS idFecha FROM dbo.incidencias_servicio x
        UNION
        SELECT CAST(x.fecha_resolucion AS DATE) AS idFecha FROM dbo.incidencias_servicio x
        UNION
        SELECT CAST(x.fecha_envio AS DATE) AS idFecha FROM dbo.instrucciones_pago x
        UNION
        SELECT CAST(x.fecha_calificacion AS DATE) AS idFecha FROM dbo.leads x
        UNION
        SELECT CAST(x.fecha_hora_mensaje AS DATE) AS idFecha FROM dbo.mensajes_chat x
        UNION
        SELECT CAST(x.fecha_inicio AS DATE) AS idFecha FROM dbo.negociacion_leads x
        UNION
        SELECT CAST(x.ultima_interaccion AS DATE) AS idFecha FROM dbo.negociacion_leads x
        UNION
        SELECT CAST(x.fecha_pago AS DATE) AS idFecha FROM dbo.pagos x
        UNION
        SELECT CAST(x.fecha_activacion_servicio AS DATE) AS idFecha FROM dbo.payers x
        UNION
        SELECT CAST(x.fecha_pedido AS DATE) AS idFecha FROM dbo.pedidos x
        UNION
        SELECT CAST(x.fecha_actualizacion AS DATE) AS idFecha FROM dbo.perfil_gustos x
        UNION
        SELECT CAST(x.fecha_reserva AS DATE) AS idFecha FROM dbo.perfil_reserva x
        UNION
        SELECT CAST(x.fecha_resena AS DATE) AS idFecha FROM dbo.resenas_servicio x
        UNION
        SELECT CAST(x.hora_pedido AS DATE) AS idFecha FROM dbo.servicio_detalle x
        UNION
        SELECT CAST(x.hora_entrega_cocina AS DATE) AS idFecha FROM dbo.servicio_detalle x
        UNION
        SELECT CAST(x.fecha_inicio_servicio AS DATE) AS idFecha FROM dbo.servicios x
        UNION
        SELECT CAST(x.fecha_fin_servicio AS DATE) AS idFecha FROM dbo.servicios x
        UNION
        SELECT CAST(x.fecha_inicio AS DATE) AS idFecha FROM dbo.sesiones_chat x
        UNION
        SELECT CAST(x.fecha_hora_ultimo_mensaje AS DATE) AS idFecha FROM dbo.sesiones_chat x
        UNION
        SELECT CAST(x.fecha_abandono AS DATE) AS idFecha FROM dbo.sesiones_chat x
        UNION
        SELECT CAST(x.fecha_cierre AS DATE) AS idFecha FROM dbo.sesiones_chat x
    ) f
    WHERE f.idFecha IS NOT NULL
) AS oltp
ON oltp.idFecha = dim.idFecha
WHEN NOT MATCHED THEN
    INSERT (idFecha, Anual, Semestre, Trimestre, Mes, NombreMes, Dia, DiaSemana)
    VALUES (oltp.idFecha, oltp.Anual, oltp.Semestre, oltp.Trimestre, oltp.Mes, oltp.NombreMes, oltp.Dia, oltp.DiaSemana);

-- 02. DimTipoBuyer
MERGE [mart_parrilla].dbo.DimTipoBuyer AS dim
USING
(
    SELECT CAST(t.id_tipo_buyer AS NVARCHAR(100)) AS idTipoBuyer,
           t.codigo AS Codigo, t.nombre AS Nombre
    FROM dbo.tipos_buyer t
) AS oltp
ON oltp.idTipoBuyer COLLATE DATABASE_DEFAULT = dim.idTipoBuyer COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idTipoBuyer, Codigo, Nombre)
    VALUES (oltp.idTipoBuyer, oltp.Codigo, oltp.Nombre);

-- 03. DimCanal
-- El origen no tiene catalogo de canales ni TipoCanal; se conserva el codigo real. TipoCanal queda NULL.
MERGE [mart_parrilla].dbo.DimCanal AS dim
USING
(
    SELECT DISTINCT CAST(b.canal_origen AS NVARCHAR(100)) AS Codigo,
           CAST(b.canal_origen AS NVARCHAR(150)) AS Descripcion,
           CAST(NULL AS NVARCHAR(100)) AS TipoCanal
    FROM dbo.buyers b
) AS oltp
ON oltp.Codigo COLLATE DATABASE_DEFAULT = dim.Codigo COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (Codigo, Descripcion, TipoCanal)
    VALUES (oltp.Codigo, oltp.Descripcion, oltp.TipoCanal);

-- 04. DimPersonal
MERGE [mart_parrilla].dbo.DimPersonal AS dim
USING
(
    SELECT CAST(p.id_personal AS NVARCHAR(100)) AS idPersonal,
           p.nombres AS Nombres, p.apellidos AS Apellidos,
           p.cargo AS Cargo, a.nombre AS Area
    FROM dbo.personal p
    LEFT JOIN dbo.area_empresa a ON a.id_area = p.id_area
) AS oltp
ON oltp.idPersonal COLLATE DATABASE_DEFAULT = dim.idPersonal COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idPersonal, Nombres, Apellidos, Cargo, Area)
    VALUES (oltp.idPersonal, oltp.Nombres, oltp.Apellidos, oltp.Cargo, oltp.Area);

-- 05. DimRedSocial
MERGE [mart_parrilla].dbo.DimRedSocial AS dim
USING
(
    SELECT CAST(r.id_red_social AS NVARCHAR(100)) AS idRedSocial,
           r.plataforma AS Plataforma, r.nombre_pagina AS NombrePagina,
           r.url_pagina AS UrlPagina
    FROM dbo.redes_sociales r
) AS oltp
ON oltp.idRedSocial COLLATE DATABASE_DEFAULT = dim.idRedSocial COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idRedSocial, Plataforma, NombrePagina, UrlPagina)
    VALUES (oltp.idRedSocial, oltp.Plataforma, oltp.NombrePagina, oltp.UrlPagina);

-- 06. DimProducto
-- La tabla real es productos; no platos.
MERGE [mart_parrilla].dbo.DimProducto AS dim
USING
(
    SELECT CAST(p.id_producto AS NVARCHAR(100)) AS idProducto,
           p.nombre AS Nombre, p.categoria AS Categoria,
           p.precio_base AS PrecioBase,
           p.es_gancho_promocional AS EsGanchoPromocional
    FROM dbo.productos p
) AS oltp
ON oltp.idProducto COLLATE DATABASE_DEFAULT = dim.idProducto COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idProducto, Nombre, Categoria, PrecioBase, EsGanchoPromocional)
    VALUES (oltp.idProducto, oltp.Nombre, oltp.Categoria, oltp.PrecioBase, oltp.EsGanchoPromocional);

-- 07. DimCampana
-- PlatoGancho es el nombre del campo destino existente; su origen real es productos.nombre.
MERGE [mart_parrilla].dbo.DimCampana AS dim
USING
(
    SELECT CAST(c.id_campana AS NVARCHAR(100)) AS idCampana,
           c.nombre AS Nombre, c.fuente_utm AS FuenteUtm,
           p.nombre AS PlatoGancho, t.nombre AS TipoBuyerObjetivo
    FROM dbo.campanas c
    LEFT JOIN dbo.productos p ON p.id_producto = c.id_producto_gancho
    LEFT JOIN dbo.tipos_buyer t ON t.id_tipo_buyer = c.id_tipo_buyer_objetivo
) AS oltp
ON oltp.idCampana COLLATE DATABASE_DEFAULT = dim.idCampana COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idCampana, Nombre, FuenteUtm, PlatoGancho, TipoBuyerObjetivo)
    VALUES (oltp.idCampana, oltp.Nombre, oltp.FuenteUtm, oltp.PlatoGancho, oltp.TipoBuyerObjetivo);

-- 08. DimAnuncio
MERGE [mart_parrilla].dbo.DimAnuncio AS dim
USING
(
    SELECT CAST(a.id_anuncio AS NVARCHAR(100)) AS idAnuncio,
           a.nombre AS Nombre, a.texto_cta AS TextoCta,
           a.horario_inicio AS HorarioInicio, a.horario_fin AS HorarioFin
    FROM dbo.anuncios a
) AS oltp
ON oltp.idAnuncio COLLATE DATABASE_DEFAULT = dim.idAnuncio COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idAnuncio, Nombre, TextoCta, HorarioInicio, HorarioFin)
    VALUES (oltp.idAnuncio, oltp.Nombre, oltp.TextoCta, oltp.HorarioInicio, oltp.HorarioFin);

-- 09. DimBuyer
-- LEFT JOIN conserva buyers que aun no tienen persona o tipo identificado.
MERGE [mart_parrilla].dbo.DimBuyer AS dim
USING
(
    SELECT CAST(b.id_buyer AS NVARCHAR(100)) AS idBuyer,
           CAST(b.id_persona AS NVARCHAR(100)) AS idPersona,
           p.nombre AS Nombre, t.nombre AS TipoBuyer
    FROM dbo.buyers b
    LEFT JOIN dbo.buyer_personas p ON p.id_persona = b.id_persona
    LEFT JOIN dbo.tipos_buyer t ON t.id_tipo_buyer = p.id_tipo_buyer
) AS oltp
ON oltp.idBuyer COLLATE DATABASE_DEFAULT = dim.idBuyer COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idBuyer, idPersona, Nombre, TipoBuyer)
    VALUES (oltp.idBuyer, oltp.idPersona, oltp.Nombre, oltp.TipoBuyer);

-- 10. DimLead
-- No existe tipo_lead en la estructura recibida. TipoLead queda NULL; no se confunde con tipo_buyer.
MERGE [mart_parrilla].dbo.DimLead AS dim
USING
(
    SELECT CAST(l.id_lead AS NVARCHAR(100)) AS idLead,
           CAST(l.id_buyer AS NVARCHAR(100)) AS idBuyer,
           p.nombre AS NombreCliente,
           CAST(NULL AS NVARCHAR(100)) AS TipoLead,
           l.interes_principal AS InteresPrincipal
    FROM dbo.leads l
    LEFT JOIN dbo.buyers b ON b.id_buyer = l.id_buyer
    LEFT JOIN dbo.buyer_personas p ON p.id_persona = b.id_persona
) AS oltp
ON oltp.idLead COLLATE DATABASE_DEFAULT = dim.idLead COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idLead, idBuyer, NombreCliente, TipoLead, InteresPrincipal)
    VALUES (oltp.idLead, oltp.idBuyer, oltp.NombreCliente, oltp.TipoLead, oltp.InteresPrincipal);

-- 11. DimEstadoLead
-- Regla de mapeo: Estado = perfil_operativo.estado_gestion;
-- Subestado = estado de la negociacion con interaccion mas reciente.
-- No existe una columna subestado literal. Codigo identifica esa combinacion.
-- SIN_GESTION/SIN_NEGOCIACION solo codifican un componente ausente; no crean
-- estados operativos ficticios. Reutilizar EXACTAMENTE esta regla en el ETL de hechos.
-- OUTER APPLY TOP(1) evita multiplicar filas si un lead tiene varias negociaciones.
MERGE [mart_parrilla].dbo.DimEstadoLead AS dim
USING
(
    SELECT DISTINCT
           CAST(CONCAT(COALESCE(o.estado_gestion, 'SIN_GESTION'), N'|',
                       COALESCE(n.estado_negociacion, 'SIN_NEGOCIACION'))
                AS NVARCHAR(200)) AS Codigo,
           o.estado_gestion AS Estado,
           n.estado_negociacion AS Subestado
    FROM dbo.leads l
    LEFT JOIN dbo.perfil_operativo o ON o.id_lead = l.id_lead
    OUTER APPLY
    (
        SELECT TOP (1) nl.estado_negociacion
        FROM dbo.negociacion_leads nl
        WHERE nl.id_lead = l.id_lead
        ORDER BY COALESCE(nl.ultima_interaccion, nl.fecha_inicio) DESC,
                 nl.fecha_inicio DESC, nl.id_negociacion DESC
    ) n
    WHERE o.estado_gestion IS NOT NULL
       OR n.estado_negociacion IS NOT NULL
) AS oltp
ON oltp.Codigo COLLATE DATABASE_DEFAULT = dim.Codigo COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (Codigo, Estado, Subestado)
    VALUES (oltp.Codigo, oltp.Estado, oltp.Subestado);

-- 12. DimPerfilGustos
-- BebidaPreferida se obtiene de un favorito del buyer asociado al lead
-- que existe en bebida_detalle. Prioridad: favorito principal, registro mas
-- reciente, id como desempate. Si no existe, NULL. No se infiere desde texto
-- libre ni desde compras. Una sola bebida mantiene una fila por perfil de lead.
MERGE [mart_parrilla].dbo.DimPerfilGustos AS dim
USING
(
    SELECT CAST(g.id_lead AS NVARCHAR(100)) AS idLead,
           c.nombre AS TipoCorte, c.categoria AS Categoria,
           t.nombre AS TerminoCoccion,
           g.descripcion_preferencia AS DescripcionPreferencia,
           bebida.nombre AS BebidaPreferida
    FROM dbo.perfil_gustos g
    LEFT JOIN dbo.tipos_corte c ON c.id_tipo_corte = g.id_tipo_corte
    LEFT JOIN dbo.terminos_coccion t
        ON t.id_termino_coccion = g.id_termino_coccion
    LEFT JOIN dbo.leads l ON l.id_lead = g.id_lead
    OUTER APPLY
    (
        SELECT TOP (1) p.nombre
        FROM dbo.buyer_productos_favoritos f
        INNER JOIN dbo.productos p ON p.id_producto = f.id_producto
        INNER JOIN dbo.bebida_detalle bd ON bd.id_producto = p.id_producto
        WHERE f.id_buyer = l.id_buyer
        ORDER BY f.es_favorito_principal DESC, f.fecha_registro DESC,
                 f.id_buyer_producto DESC
    ) bebida
) AS oltp
ON oltp.idLead COLLATE DATABASE_DEFAULT = dim.idLead COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idLead, TipoCorte, Categoria, TerminoCoccion, DescripcionPreferencia, BebidaPreferida)
    VALUES (oltp.idLead, oltp.TipoCorte, oltp.Categoria, oltp.TerminoCoccion, oltp.DescripcionPreferencia, oltp.BebidaPreferida);

-- 13. DimReservaPedido
-- Pedidos usa id_pedido; reservas usa id_lead.
-- TipoRegistro forma parte de la clave para evitar colisiones.
-- Se carga como reserva solo perfil_reserva con fecha_reserva registrada.
-- perfil_reserva NO tiene estado ni tipo_consumo: esos atributos quedan NULL.
MERGE [mart_parrilla].dbo.DimReservaPedido AS dim
USING
(
    SELECT CAST(N'PEDIDO' AS NVARCHAR(30)) AS TipoRegistro,
           CAST(p.id_pedido AS NVARCHAR(100)) AS idRegistro,
           p.tipo_consumo AS TipoConsumo, p.estado_pedido AS Estado
    FROM dbo.pedidos p
    UNION ALL
    SELECT N'RESERVA', CAST(r.id_lead AS NVARCHAR(100)),
           CAST(NULL AS NVARCHAR(100)), CAST(NULL AS NVARCHAR(100))
    FROM dbo.perfil_reserva r
    WHERE r.fecha_reserva IS NOT NULL
) AS oltp
ON oltp.TipoRegistro COLLATE DATABASE_DEFAULT = dim.TipoRegistro COLLATE DATABASE_DEFAULT
AND oltp.idRegistro COLLATE DATABASE_DEFAULT = dim.idRegistro COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (TipoRegistro, idRegistro, TipoConsumo, Estado)
    VALUES (oltp.TipoRegistro, oltp.idRegistro, oltp.TipoConsumo, oltp.Estado);

-- 14. DimPago
MERGE [mart_parrilla].dbo.DimPago AS dim
USING
(
    SELECT CAST(p.id_pago AS NVARCHAR(100)) AS idPago,
           p.estado_pago AS EstadoPago, p.metodo_pago AS MedioPago
    FROM dbo.pagos p
) AS oltp
ON oltp.idPago COLLATE DATABASE_DEFAULT = dim.idPago COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idPago, EstadoPago, MedioPago)
    VALUES (oltp.idPago, oltp.EstadoPago, oltp.MedioPago);

-- 15. DimMedioPago
-- UNION elimina medios repetidos entre pagos e instrucciones. No se inventan etiquetas ni se unifican codigos distintos.
MERGE [mart_parrilla].dbo.DimMedioPago AS dim
USING
(
    SELECT CAST(p.metodo_pago AS NVARCHAR(100)) AS Codigo,
           CAST(p.metodo_pago AS NVARCHAR(150)) AS Descripcion
    FROM dbo.pagos p
    WHERE p.metodo_pago IS NOT NULL
    UNION
    SELECT CAST(i.canal_pago AS NVARCHAR(100)),
           CAST(i.canal_pago AS NVARCHAR(150))
    FROM dbo.instrucciones_pago i
    WHERE i.canal_pago IS NOT NULL
) AS oltp
ON oltp.Codigo COLLATE DATABASE_DEFAULT = dim.Codigo COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (Codigo, Descripcion)
    VALUES (oltp.Codigo, oltp.Descripcion);

-- 16. DimComprobante
MERGE [mart_parrilla].dbo.DimComprobante AS dim
USING
(
    SELECT CAST(c.id_comprobante AS NVARCHAR(100)) AS idComprobante,
           c.tipo_comprobante AS TipoComprobante, c.serie AS Serie,
           CAST(c.numero_correlativo AS NVARCHAR(50)) AS NumeroCorrelativo,
           c.numero_documento_cliente AS DocumentoCliente,
           c.emitido AS Emitido
    FROM dbo.comprobante c
) AS oltp
ON oltp.idComprobante COLLATE DATABASE_DEFAULT = dim.idComprobante COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idComprobante, TipoComprobante, Serie, NumeroCorrelativo, DocumentoCliente, Emitido)
    VALUES (oltp.idComprobante, oltp.TipoComprobante, oltp.Serie, oltp.NumeroCorrelativo, oltp.DocumentoCliente, oltp.Emitido);

-- 17. DimMesa
MERGE [mart_parrilla].dbo.DimMesa AS dim
USING
(
    SELECT CAST(m.id_mesa AS NVARCHAR(100)) AS idMesa,
           m.numero_mesa AS NumeroMesa, m.zona AS Zona,
           m.capacidad AS Capacidad
    FROM dbo.mesas m
) AS oltp
ON oltp.idMesa COLLATE DATABASE_DEFAULT = dim.idMesa COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idMesa, NumeroMesa, Zona, Capacidad)
    VALUES (oltp.idMesa, oltp.NumeroMesa, oltp.Zona, oltp.Capacidad);

-- 18. DimServicio
-- responsable_atencion es un texto NVARCHAR, no una FK a personal. No se convierte arbitrariamente en id_personal.
MERGE [mart_parrilla].dbo.DimServicio AS dim
USING
(
    SELECT CAST(s.id_servicio AS NVARCHAR(100)) AS idServicio,
           s.tipo_servicio AS TipoServicio, s.estado_servicio AS EstadoServicio
    FROM dbo.servicios s
) AS oltp
ON oltp.idServicio COLLATE DATABASE_DEFAULT = dim.idServicio COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (idServicio, TipoServicio, EstadoServicio)
    VALUES (oltp.idServicio, oltp.TipoServicio, oltp.EstadoServicio);

-- 19. DimTipoAlerta
MERGE [mart_parrilla].dbo.DimTipoAlerta AS dim
USING
(
    SELECT DISTINCT CAST(a.tipo_alerta AS NVARCHAR(100)) AS Codigo,
           CAST(a.tipo_alerta AS NVARCHAR(150)) AS Descripcion
    FROM dbo.alertas_consumo a
) AS oltp
ON oltp.Codigo COLLATE DATABASE_DEFAULT = dim.Codigo COLLATE DATABASE_DEFAULT
WHEN NOT MATCHED THEN
    INSERT (Codigo, Descripcion)
    VALUES (oltp.Codigo, oltp.Descripcion);

-- 20. DimCalificacion
-- Solo valores presentes en el origen. No se insertan artificialmente las cinco calificaciones.
MERGE [mart_parrilla].dbo.DimCalificacion AS dim
USING
(
    SELECT DISTINCT r.calificacion_estrellas AS Valor,
           CAST(CONCAT(r.calificacion_estrellas, N' estrella(s)')
                AS NVARCHAR(100)) AS Descripcion
    FROM dbo.resenas_servicio r
    WHERE r.calificacion_estrellas BETWEEN 1 AND 5
) AS oltp
ON oltp.Valor = dim.Valor
WHEN NOT MATCHED THEN
    INSERT (Valor, Descripcion)
    VALUES (oltp.Valor, oltp.Descripcion);

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;

-- Verificacion final: cantidad exacta de filas por dimension.
SELECT N'DimFecha' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimFecha
UNION ALL
SELECT N'DimTipoBuyer' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimTipoBuyer
UNION ALL
SELECT N'DimCanal' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimCanal
UNION ALL
SELECT N'DimPersonal' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimPersonal
UNION ALL
SELECT N'DimRedSocial' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimRedSocial
UNION ALL
SELECT N'DimProducto' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimProducto
UNION ALL
SELECT N'DimCampana' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimCampana
UNION ALL
SELECT N'DimAnuncio' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimAnuncio
UNION ALL
SELECT N'DimBuyer' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimBuyer
UNION ALL
SELECT N'DimLead' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimLead
UNION ALL
SELECT N'DimEstadoLead' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimEstadoLead
UNION ALL
SELECT N'DimPerfilGustos' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimPerfilGustos
UNION ALL
SELECT N'DimReservaPedido' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimReservaPedido
UNION ALL
SELECT N'DimPago' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimPago
UNION ALL
SELECT N'DimMedioPago' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimMedioPago
UNION ALL
SELECT N'DimComprobante' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimComprobante
UNION ALL
SELECT N'DimMesa' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimMesa
UNION ALL
SELECT N'DimServicio' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimServicio
UNION ALL
SELECT N'DimTipoAlerta' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimTipoAlerta
UNION ALL
SELECT N'DimCalificacion' AS Tabla, COUNT_BIG(*) AS CantidadFilas
FROM [mart_parrilla].dbo.DimCalificacion
ORDER BY Tabla;
