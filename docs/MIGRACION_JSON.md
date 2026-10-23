# Migración JSON ↔ esquema canónico

Contrato de la API congelado el 2026-10-23. El frontend no cambia de forma:
mismos paths, métodos, códigos, nombres de campo y enums. El único cambio
visible es el tipo de los identificadores (`number` → `string` UUID).

## Reglas

1. `docs/api/openapi.baseline.json` es la referencia. Se regenera solo con
   `python scripts/check_api_contract.py --update` y revisión humana.
2. `python scripts/check_api_contract.py` falla ante cualquier diferencia que
   no sea `integer`/`number` → `string` en un campo `id_*`.
3. Los DTO (`app/schemas/`) son la capa pública. Nunca exponen columnas del
   canónico directamente: los `app/mappers/` traducen.
4. Las columnas que la app necesita y el esquema canónico no tiene viven en
   `db/postgres/02_oltp_extensions.sql`, siempre nullable y aditivas.

## Inventario de endpoints

Ver [endpoints_inventory.md](api/endpoints_inventory.md): 55 operaciones sobre
41 paths, con campos de entrada y salida.

## Mapeo por tabla

`→` indica traducción en el mapper. `ext` indica columna aditiva.

### buyers + buyer_personas

| DTO | Canónico |
|---|---|
| `id_buyer` | `buyers.id_buyer` (uuid) |
| `nombre`, `apellido` | `buyer_personas.nombre`, `buyer_personas.apellido` (ext) |
| `telefono`, `email` | `buyer_personas.telefono`, `buyer_personas.correo` |
| `canal_captacion` | `buyers.canal_origen` (mayúsculas canónicas) |
| `id_tipo_buyer` | `buyer_personas.id_tipo_buyer` |
| `etapa_impulse`, `utm_*`, `notas`, `activo`, `created_at`, `updated_at` | ext en `buyers` |
| `fecha_primer_contacto` | `buyers.fecha_primer_contacto` |

`activo` ↔ `buyers.estado_buyer = 'ACTIVO'` (se mantienen ambos por compatibilidad).

### leads

| DTO | Canónico |
|---|---|
| `id_lead`, `id_buyer` | `leads.id_lead`, `leads.id_buyer` (uuid) |
| `interes_confirmado` | `leads.interes_principal` (valor canónico) |
| `fecha_contacto` | `leads.fecha_calificacion` |
| `id_campana`, `id_formulario`, `estado`, `personas_estimadas`, `fecha_preferida`, `presupuesto_estimado`, `notas`, `motivo_perdida`, `fecha_respuesta`, `created_at`, `updated_at` | ext |

`leads` conserva `UNIQUE (id_buyer)`. `POST /captacion/formulario` busca el lead
del buyer y lo actualiza; no crea uno nuevo.

Cambio de estado (`PATCH /leads/{id}/estado`) actualiza además el resumen
canónico `negociacion_leads.estado_negociacion`:

| app | negociacion_leads |
|---|---|
| `nuevo`, `contactado`, `respondio` | `ACTIVA` |
| `ganado` | `GANADA` |
| `perdido` | `PERDIDA` |

### Chat (`perfiles/chat`)

| DTO | Canónico |
|---|---|
| `id_negociacion` | `mensajes_chat.id_mensaje` |
| `id_lead` | vía `leads → sesiones_chat.id_sesion` |
| `remitente` | `tipo_remitente` (`cliente`→`CLIENTE`, `agente`→`PERSONAL`, `bot`→`BOT`) |
| `mensaje` | `mensaje_contenido` |
| `tipo_mensaje` | `tipo_mensaje` (`NORMAL`/`RESCATE`; el DTO usa `texto/sugerencia/...` → ext `tipo_mensaje_app`) |
| `metadata_json`, `leido`, `created_at` | ext en `mensajes_chat` |

`negociacion_leads` no guarda mensajes: queda como resumen para el BI.

### pedidos + detalle_pedido

| DTO | Canónico |
|---|---|
| `id_pedido`, `id_lead` | `pedidos.id_pedido`, `pedidos.id_lead` |
| `id_buyer` | join `leads.id_buyer` |
| `total` | `pedidos.total` |
| `subtotal`, `descuento`, `notas`, `created_at`, `updated_at` | ext |
| `estado` | `pedidos.estado_pedido` + ext `estado_impulse` |
| `tipo_pedido` | `pedidos.tipo_consumo` (`reserva/delivery/salon` → `RESERVA/DELIVERY/SALON`) |
| `detalle.nombre_producto`, `categoria` | join `productos` |
| `detalle.subtotal` | columna generada `cantidad * precio_unitario` |
| `detalle.termino_coccion`, `notas_especiales`, `created_at` | ext |

### pagos

| DTO | Canónico |
|---|---|
| `id_pago`, `id_pedido` | `pagos.id_pago`, `pagos.id_pedido` |
| `monto`, `fecha_pago` | `pagos.monto`, `pagos.fecha_pago` |
| `estado` | `pagos.estado_pago` |
| `tipo_pago` (`adelanto`/`saldo`) | ext |
| `porcentaje`, `id_lead`, `mp_*`, `pagador_*`, `created_at`, `updated_at` | ext |

| app estado | canónico |
|---|---|
| `pendiente` | `PENDIENTE` |
| `en_proceso` | `PENDIENTE` |
| `aprobado` | `PAGADO` |
| `rechazado` | `RECHAZADO` |

| app método | canónico `metodo_pago` |
|---|---|
| `efectivo` | `EFECTIVO` |
| `tarjeta` | `TARJETA` |
| `transferencia` | `TRANSFERENCIA` |
| `mercado_pago` | `MERCADO_PAGO` (agregado al CHECK) |

### payers, comprobante, caja

Columnas canónicas: `id_payer`, `id_lead`, `id_pago`, `id_personal_cajero`,
`fecha_activacion_servicio`. El resto del DTO (`id_pedido`, `id_buyer`,
`id_mesa`, `estado`, montos, fechas, `notas`, `created_at`, `updated_at`) va a ext.

`comprobante` canónico aporta `tipo_comprobante`, `numero_documento_cliente`,
`razon_social_cliente`, `serie`, `numero_correlativo`, `fecha_emision`, `emitido`.
El DTO conserva `folio`, totales, `metodo_pago_saldo`, `generado_por`,
`cliente_*`, `observaciones`, `id_payer`, `id_pedido`, `created_at` (ext).

### servicios + servicio_detalle

| DTO | Canónico |
|---|---|
| `id_servicio`, `id_payer`, `id_mesa` | `servicios.*` |
| `estado` | `servicios.estado_servicio` + ext `estado_impulse` |
| `hora_inicio`, `hora_fin` | `fecha_inicio_servicio`, `fecha_fin_servicio` |
| `id_parrillero`, `prioridad`, `notas_cocina`, `created_at`, `updated_at` | ext |
| `detalle.id_servicio_detalle` | `servicio_detalle.id_detalle` |
| `detalle.nombre_item` | join `productos.nombre` |
| `detalle.id_detalle_pedido`, `termino_coccion`, `prioridad`, `notas_cocina`, `tiempo_preparacion_min`, `created_at`, `updated_at` | ext |

| app `estado` | canónico `estado_servicio` |
|---|---|
| `en_espera` | `EN_PREPARACION` |
| `preparando` | `EN_PREPARACION` |
| `servido` | `SERVIDO` |
| `finalizado` | `FINALIZADO` |
| `cancelado` | `CON_INCIDENCIA` |

| app `estado_item` | canónico `estado_item` |
|---|---|
| `pendiente` | `PENDIENTE` |
| `preparando` | `EN_COCINA` |
| `listo` | `EN_COCINA` |
| `entregado` | `SERVIDO` |
| `cancelado` | `DEVUELTO` |

### mesas, personal, productos

| DTO | Canónico |
|---|---|
| `mesa.numero` | `numero_mesa` |
| `mesa.sector` | `zona` |
| `mesa.estado` | `estado_mesa` (mayúsculas) |
| `mesa.descripcion`, `activa`, `created_at`, `updated_at` | ext |
| `personal.nombre` | `nombres + ' ' + apellidos` |
| `personal.activo` | `estado_activo` |
| `producto.disponible` | `estado_activo` |
| `producto.imagen_url`, `created_at`, `updated_at` | ext |

### campanas, anuncios

| DTO | Canónico |
|---|---|
| `campana.nombre` | `campanas.nombre` |
| `campana.estado` | ext `estado_impulse` (canónico solo tiene `estado_activo`) |
| `campana.descripcion`, `objetivo`, `presupuesto_*`, `id_buyer_persona`, `created_at`, `updated_at` | ext |
| `anuncio.titulo` | `anuncios.nombre` |
| `anuncio.copy_texto` | `anuncios.texto_cta` |
| `anuncio.estado` | ext `estado_impulse` |
| `anuncio.imagen_url`, `plataforma`, `url_destino`, `impresiones`, `clics`, `created_at`, `updated_at` | ext |

### formularios_captacion

| DTO | Canónico |
|---|---|
| `nombre` | `nombre_ingresado` |
| `telefono` | `telefono_ingresado` |
| `fecha_captacion` | `fecha_envio` |
| `interes` | `interes_declarado` (se guarda el valor canónico en mayúsculas) |
| `email`, `mensaje`, `personas_aproximadas`, `fecha_preferida`, `canal`, `utm_*`, `procesado`, `created_at` | ext |

### perfiles

`perfil_gustos`: `id_tipo_corte`, `id_termino_coccion`,
`descripcion_preferencia`, `fecha_actualizacion` son canónicos; los campos del
DTO (`tipos_corte_preferidos`, `bebidas_preferidas`, etc.) van a ext `text[]`.

`perfil_reserva`: `id_lead`, `fecha_reserva`, `hora_reserva` ↔ `hora_inicio`,
`cantidad_personas` ↔ `numero_personas`, `observaciones` ↔
`peticiones_especiales`; el resto del DTO va a ext.

### alertas y reseñas

`alertas_consumo`: canónico `id_producto_sugerido`, `mensaje_enviado`,
`fecha_envio`, `aceptada`. DTO: `tipo_alerta`, `descripcion`, `nivel`,
`atendida`, `atendida_por`, `created_at` → ext. El tipo de alerta del DTO no
cabe en el CHECK canónico, por eso no se reutiliza `tipo_alerta` canónico.

`resenas_servicio`: `calificacion_general` ↔ `calificacion_estrellas`;
`id_buyer` se resuelve por join `leads.id_buyer`; el resto de calificaciones,
`comentario`, `recomendaria`, `publicar`, `created_at` → ext.

### hermes_mensajes

Tabla solo de la app. `id_negociacion` pasa a `id_mensaje` con FK a
`mensajes_chat`.

## Verificación

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\check_api_contract.py
.\.venv\Scripts\python.exe scripts\check_endpoints.py
```
