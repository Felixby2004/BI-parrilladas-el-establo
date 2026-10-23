# Parrilladas El Establo — IMPULSE

Aplicación local React + FastAPI + PostgreSQL. Necesita Docker Desktop (motor Linux), Python 3.13, Node.js 24 y pnpm.

## Inicio habitual (PowerShell, desde este directorio)

```powershell
.\iniciar.ps1
```

Abre dos terminales (backend y frontend). Si Windows bloquea scripts:

```powershell
powershell -ExecutionPolicy Bypass -File .\iniciar.ps1
```

Para reinstalar dependencias y cargar datos de demostración:

```powershell
.\iniciar.ps1 -Instalar -DatosDemo
```

- Interfaz: http://localhost:5173
- Formulario público: http://localhost:5173/formulario
- API/documentación interactiva: http://localhost:8000/docs
- Estado de la API y conexión a PostgreSQL: http://localhost:8000/health
- pgAdmin: http://localhost:5050 (admin@establo.com / admin123, solo desarrollo)

Los datos persisten en el volumen Docker. No ejecutar `docker compose down -v` salvo que se quiera borrar la base.

## Inicio manual

```powershell
docker compose up -d --wait
cd backend
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# Solo si no existe .env: Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe seeds\seed_leads.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

En otra terminal desde la raíz:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

No recrear `frontend` con `npm create vite` ni ejecutar `tailwindcss init`: ya está configurado con Tailwind 3. No generar las cuatro migraciones históricas de las instrucciones originales: una migración inicial consolida los modelos actuales. Para cambios futuros, usar `alembic revision --autogenerate -m descripcion` y revisar antes de `alembic upgrade head`.

## Buyers, Leads y Hermes

- `/buyers`: estudio creativo por prompt para fotografías publicitarias verticales 9:16 o 4:5. No muestra contactos ni métricas inventadas. [Configuración de Gemini/Pomelli](docs/CREATIVOS_GOOGLE.md).
- `/leads`: tablero y tabla de contactos con búsqueda, filtros, orden, creación y cambio persistente de estado. Chat con consulta de mensajes cada 5 segundos, sin respuestas automáticas simuladas.
- `POST /api/v1/integraciones/hermes/mensajes`: recepción protegida por Bearer con idempotencia persistente. [Contrato para el compañero de Hermes](docs/HERMES.md).

El token Hermes local se encuentra en [backend/.env](backend/.env); no se publica ni envía al navegador. La clave Google no está configurada: añadir `GEMINI_API_KEY` al mismo archivo habilita la generación dentro de la app. Pomelli se abre externamente con cuenta Google; copiar un brief no equivale a haber generado una foto en Pomelli.

## Verificación

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe scripts\check_http_flow.py
.\.venv\Scripts\python.exe scripts\check_http_flow.py --postgres
.\.venv\Scripts\python.exe scripts\check_hermes.py --postgres
.\.venv\Scripts\python.exe scripts\check_creativos.py
cd ..\frontend
npm run build
npm audit --omit=dev
```

Verificado: compilación de producción y TypeScript, 15 regresiones HTTP, flujo completo con PostgreSQL y respuestas HTTP 200 de interfaz/API/proxy. La prueba visual automatizada de Edge no se pudo completar porque el navegador dejó de responder al protocolo de depuración; no se considera una prueba E2E visual aprobada.

El flujo HTTP de PostgreSQL usa rollback: no deja clientes ni cobros de prueba en la base. No llama a Mercado Pago. La semilla se puede volver a ejecutar sin duplicar los dos contactos demo. Las versiones Python verificadas están fijadas en [requirements.lock.txt](backend/requirements.lock.txt), usado por el inicio con `-Instalar`; el frontend fija sus versiones en `pnpm-lock.yaml` para `pnpm install --frozen-lockfile`.

## Despliegue (Dokploy)

El despliegue usa `docker-compose.dokploy.yml`: PostgreSQL 18, API FastAPI, frontend Nginx y SQL Server para BI. El frontend publica un solo puerto y redirige `/api` al backend, así que la API y la interfaz comparten origen y no necesitan CORS.

1. Crear una aplicación de tipo **Compose** en Dokploy y apuntar al repositorio; archivo de compose: `docker-compose.dokploy.yml`.
2. Copiar `.env.production.example` a `.env` en el servidor (o cargar las variables en la UI de Dokploy):
   - `POSTGRES_USER`, `POSTGRES_PASSWORD` (solo alfanumérica), `POSTGRES_DB`.
   - `SECRET_KEY` generada con `openssl rand -hex 32`.
   - `MSSQL_SA_PASSWORD` para el servicio de BI (ver sección SQL Server para BI).
   - `MP_ACCESS_TOKEN` y `MP_WEBHOOK_URL` solo si se usará Mercado Pago.
   - `WEB_PORT` (por defecto 3000) es el puerto del host que Dokploy publica.
3. Asignar el dominio en Dokploy al servicio `web`, puerto `80`, con certificado Let's Encrypt.
4. Desplegar. El contenedor `api` ejecuta `alembic upgrade head` antes de arrancar, así que las migraciones se aplican solas en cada despliegue.
5. Verificar `https://tu-dominio/health` y `https://tu-dominio/formulario`.
6. Si se usa Mercado Pago, configurar `MP_WEBHOOK_URL=https://tu-dominio/api/v1/pagos/webhook` y volver a desplegar.

Notas:

- Los datos viven en el volumen `pg18_data` (el antiguo `postgres_data` tenía datos legacy de Postgres 15 y no es compatible con 18; se conserva como respaldo). Programar respaldos con `docker exec <db> pg_dump -U $POSTGRES_USER $POSTGRES_DB > respaldo.sql`.
- No se incluye pgAdmin en producción (el `docker-compose.yml` local lo mantiene).
- No ejecutar `seeds/seed_leads.py` en producción: carga contactos de demostración.
- `ENVIRONMENT=production` desactiva `create_all` y el endpoint `simular-aprobacion`; el esquema lo controla Alembic.

## SQL Server para BI (mismo stack, Dokploy)

El esquema `db/oltp_elestablo_v1.sql` es T-SQL para SQL Server y corre en el servicio `mssql` del mismo `docker-compose.dokploy.yml`. No reemplaza al PostgreSQL 18 del servicio `db`.

1. Cargar `MSSQL_SA_PASSWORD` en el entorno de Dokploy, junto a las demás variables. Debe tener 8+ caracteres con mayúscula, minúscula, número y símbolo, o el contenedor no arranca. Si contiene `$`, escaparlo como `$$`.
2. Desplegar. El contenedor escucha en `127.0.0.1:1433` del host, no en la IP pública.
3. Importar el esquema una sola vez (el script es idempotente):

   ```bash
   docker compose exec mssql bash -c \
     '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -f 65001 -i /scripts/oltp_elestablo_v1.sql'
   ```

   `-f 65001` es obligatorio: el archivo es UTF-8 sin BOM y sin eso se corrompen los acentos.

4. Conectar desde fuera con túnel SSH: `ssh -L 1433:127.0.0.1:1433 root@vmi3492739` y apuntar la herramienta BI o SSMS a `localhost,1433` con usuario `sa`.

Notas:

- RAM: el contenedor está limitado a 2 GB (`MSSQL_MEMORY_LIMIT_MB`). SQL Server no arranca con menos de 2 GB.
- Edición `Developer`: gratis, sin límite de tamaño, pero sin licencia para producción comercial. Para uso interno de BI es válida.
- Los datos viven en el volumen `mssql_data`. Respaldo: `docker compose exec mssql bash -c '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$MSSQL_SA_PASSWORD" -C -Q "BACKUP DATABASE database_parrilla TO DISK = N\"/var/opt/mssql/backup/parrilla.bak\""'`.
- El servicio no tiene dominio asignado ni puerto público: el acceso es solo por túnel.
- `MSSQL_SA_PASSWORD` solo se aplica al inicializar el volumen. Cambiarla después no altera la contraseña existente.

## Configuración y límites

La configuración está en `backend/.env`; debe coincidir con las credenciales locales de `docker-compose.yml`. No subir ese archivo a Git. Las migraciones sí deben versionarse.

Mercado Pago requiere credenciales válidas de pruebas y una URL HTTPS pública para recibir webhooks; localhost no sirve como webhook externo. No se realizan cobros reales en la verificación local. Las claves existentes no fueron publicadas ni reemplazadas. Si se compartieron anteriormente, revocarlas y regenerarlas desde Mercado Pago.

Esta configuración es de desarrollo: credenciales locales conocidas y API sin autenticación. No exponerla a Internet ni usarla directamente en producción. La fase TURNED se conserva como pantalla pendiente del proyecto original. El bot de negociación y el catálogo de esa pantalla son demostrativos.

Mercado Pago conserva limitaciones del proyecto original: falta validar la firma del webhook y completar conciliación de devoluciones. No habilitar pagos de producción sin resolverlas.

Se actualizaron Vite, React Router y el parser CSS. `pnpm audit --prod` no detecta vulnerabilidades de producción. La auditoría completa conserva avisos de severidad alta en la cadena de herramientas de Tailwind 3 por `braces` sin versión corregida publicada al realizar esta revisión; no procesar patrones de compilación no confiables.

Para detener, usar Ctrl+C en ambas terminales y `docker compose stop` en la raíz. Si la aplicación ya está en marcha en 8000/5173, no iniciar otra copia.
