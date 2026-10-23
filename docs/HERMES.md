# Hermes: recepción de mensajes de WhatsApp

## Alcance

`POST /api/v1/integraciones/hermes/mensajes` recibe texto observado por Hermes y lo guarda en `negociacion_leads`. No consulta servicios externos, no genera respuestas, no envía WhatsApp y no realiza cobros. Registrar una dirección saliente **no envía** ese mensaje: Hermes debe haberlo enviado previamente por su cuenta.

## Montaje y migración

El router se exporta como `app.api.v1.hermes.router` y `app.api.v1.hermes_router`. En el punto de composición de la aplicación:

```python
from app.api.v1 import hermes_router
app.include_router(hermes_router, prefix=settings.API_PREFIX)
```

Configurar `settings.HERMES_WEBHOOK_TOKEN` en backend (cadena secreta no vacía, sin valor predeterminado real). No incluirlo en variables `VITE_*`, navegador, repositorio ni logs. Se lee exclusivamente desde settings; si falta, la ruta devuelve **503**. No se requiere firma adicional del webhook: HTTPS + token Bearer es el contrato.

Registrar/aplicar migración antes de usar la ruta. El modelo `HermesMensaje` está registrado en `app.models`; tabla nueva:

| Columna | Contrato |
|---|---|
| `message_id` | `varchar(255)` PK, único global para este emisor Hermes |
| `payload_sha256` | `varchar(64)` NOT NULL |
| `id_negociacion` | integer NOT NULL UNIQUE, FK `negociacion_leads.id_negociacion`, ON DELETE RESTRICT |
| `created_at` | timestamptz NOT NULL DEFAULT now() |

La migración [20261023_hermes_mensajes.py](../backend/alembic/versions/20261023_hermes_mensajes.py) está aplicada y el router ya está montado en la aplicación. Para otra instalación ejecuta `alembic upgrade head`. Se generó un token local en [backend/.env](../backend/.env); comparte su valor con Hermes por un canal seguro, no en este documento. La FK RESTRICT conserva la idempotencia: no borrar conversaciones/recibos Hermes por separado; una eliminación del lead que afecte estos mensajes también queda restringida. Limpiar recibos permitiría reingestar mensajes antiguos; definir retención explícita antes de hacerlo.

## JSON

```json
{
  "mensaje": "Hola, quisiera reservar una mesa",
  "telefono": "+51999123456",
  "nombre": "Ana",
  "message_id": "identificador-estable-de-hermes"
}
```

- `mensaje`: string, 1–4096 caracteres, no vacío tras trim.
- `telefono`: string, máximo 40 caracteres de entrada; dígitos ASCII, `+` inicial y separadores espacio/paréntesis/punto/guion. Se normaliza a `+` y 10–15 dígitos internacionales; `00` inicial equivale a `+`. Un móvil peruano local de 9 dígitos que comienza por 9 recibe el prefijo `+51`. No se adivinan otros países; para ellos usar código internacional.
- `nombre`: opcional, 1–100 caracteres no vacíos si se proporciona. Se usa para un buyer nuevo; no sobrescribe identidad existente. Sin nombre se usa `Contacto WhatsApp`.
- `message_id`: obligatorio, string 1–255 caracteres, sin whitespace interior ni controles. Debe conservarse en todos los reintentos; no generar uno nuevo por intento.
- `direccion`: `entrante` (default) o `saliente`.
- `remitente`: `cliente` (default), `agente` o `bot`.
- `agente`/`bot` requieren `direccion: "saliente"` explícita. `cliente` requiere `entrante`.
- Se rechazan claves desconocidas, NUL y tipos incorrectos. Se recortan extremos de strings; no se aceptan mensajes/IDs/nombres compuestos solo por whitespace. No se admiten adjuntos ni timestamps de origen: el servidor asigna fecha UTC aware al recibir.

Texto saliente ya enviado por Hermes:

```json
{
  "mensaje": "Su reserva está confirmada",
  "telefono": "+51999123456",
  "message_id": "id-saliente-estable",
  "direccion": "saliente",
  "remitente": "agente"
}
```

## Respuestas e idempotencia

**201** nuevo; **200** reintento idéntico. Ambos devuelven:

```json
{
  "message_id": "identificador-estable-de-hermes",
  "duplicado": false,
  "id_buyer": 123,
  "id_lead": 45,
  "id_negociacion": 678,
  "created_at": "2026-01-01T12:00:00Z"
}
```

**401** Bearer ausente/incorrecto (`WWW-Authenticate: Bearer`), **503** token no configurado, **422** JSON inválido, **409** ID reutilizado con contenido diferente o varios buyers con el mismo teléfono normalizado. No devuelve credenciales. Se compara el token en tiempo constante.

La huella incluye todos los campos normalizados, incluso nombre/dirección/remitente. Un reintento con otro teléfono/texto/nombre no reasigna el mensaje: recibe 409. Recibo, buyer, lead y mensaje se guardan en una sola transacción. La PK persistente y locks `pg_advisory_xact_lock` por ID y por teléfono coordinan workers PostgreSQL concurrentes; un proceso reiniciado no pierde los recibos. Si la transacción falla, se revierte todo y se puede reintentar.

Se reutiliza el buyer cuyo teléfono normalizado coincide; los formatos históricos locales/internacionales con separadores también se comparan. Si hay varios, se exige revisión manual (409), no se fusionan. Se reutiliza el lead más reciente por `(created_at DESC, id_lead DESC)` incluso ganado/perdido; si no existe, se crea `nuevo`. Solo se promueve `buyer` a `lead`: `payer`, `customer`, `turned` y estados existentes no se degradan. No se modifica el nombre/canal/teléfono de buyers existentes. El lock de teléfono coordina esta integración, no escritores externos que ignoren el mismo protocolo; otras rutas de captación aún pueden crear contactos duplicados y requerir revisión.

GET chat selecciona los últimos 100 por defecto (`limit` entre 1 y 200), por `(created_at DESC, id_negociacion DESC)`, y los devuelve en orden cronológico ASC. Así el polling no se queda detenido en los primeros mensajes al superar el límite. Los últimos 20 del perfil360 usan la misma estrategia; los seeds con fecha idéntica conservan el orden de inserción por PK. No introduce cursor. El chat frontend consulta este endpoint cada 5 segundos y conserva los borradores.

## Ejemplos sin secretos embebidos

PowerShell, token ya suministrado en el entorno del proceso por un mecanismo seguro:

```powershell
$uri = 'http://127.0.0.1:8000/api/v1/integraciones/hermes/mensajes'
$headers = @{ Authorization = "Bearer $env:HERMES_WEBHOOK_TOKEN" }
$payload = @{
  mensaje = 'Hola, quisiera reservar'
  telefono = '+51999123456'
  nombre = 'Ana'
  message_id = 'hermes-ejemplo-001'
} | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload))
```

curl (shell POSIX; en Windows usar `curl.exe` con las reglas de quoting de PowerShell):

```sh
curl --fail-with-body 'http://127.0.0.1:8000/api/v1/integraciones/hermes/mensajes' \
  -H "Authorization: Bearer $HERMES_WEBHOOK_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"mensaje":"Hola, quisiera reservar","telefono":"+51999123456","nombre":"Ana","message_id":"hermes-ejemplo-001"}'
```

No compartir volcados de headers ni capturas con el token. Repetir el mismo ejemplo devuelve 200 sin crear otro mensaje.

## URL local, proxy frontend y URL pública

- Backend local: `http://127.0.0.1:8000/api/v1/integraciones/hermes/mensajes` (o puerto real configurado).
- El frontend en desarrollo puede tener un proxy `/api` desde `http://localhost:5173`; es una comodidad local del navegador, no una dirección pública de Hermes. El token pertenece al backend, no al frontend. Hermes debe invocar directamente la URL de API.
- Para Hermes en otro equipo, `localhost` apunta al equipo de Hermes, no al tuyo. Publicar la API mediante reverse proxy/dominio o túnel administrado con **HTTPS**, por ejemplo `https://api.tu-dominio.example/api/v1/integraciones/hermes/mensajes`; sustituir por dominio real. El proxy debe preservar `Authorization` y la ruta, limitar tamaño de body y aplicar rate limiting. No basta publicar solo la página frontend.
- No se configura dominio/túnel/firewall ni salida desde Hermes aquí. El chat consulta mensajes cada 5 segundos; el tablero se actualiza cada 30 segundos y tiene botón de refresco. Una respuesta escrita en el chat interno no se enviará automáticamente a WhatsApp sin una integración de salida adicional.
- Si expones el webhook a Internet, publica **solo esta ruta** detrás del proxy y limita frecuencia/tamaño. El resto de la API y el estudio creativo no tienen autenticación de usuarios y no deben publicarse como si fueran seguros para producción.

## Verificación

Desde `backend`, sin nuevas dependencias:

```powershell
.\.venv\Scripts\python.exe scripts/check_hermes.py
.\.venv\Scripts\python.exe scripts/check_hermes.py --postgres
```

Offline: autenticación/503, validaciones, normalización, PK y resolución de FK, sin conexión DB. PostgreSQL: solo acepta host local, exige tablas ya migradas, usa transacción exterior y savepoints y revierte todos los datos; verifica persistencia, duplicados/conflictos, lock desde otra conexión, asociación teléfono/lead, conservación de etapa y orden estable de seeds. No importa `app.main`, no ejecuta startup, no hace llamadas externas ni pagos. La comprobación de lock es entre conexiones reales; no pretende simular commits simultáneos con sesiones falsas.
