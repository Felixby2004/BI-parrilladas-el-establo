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
- Interfaz: tema claro/oscuro conmutable desde la cabecera. La preferencia se guarda en `localStorage` (`establo-theme`) y, si no existe, se toma la del sistema operativo.

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

El despliegue usa `docker-compose.dokploy.yml`: PostgreSQL 18 (OLTP + mart), API FastAPI y frontend Nginx. El frontend escucha en el puerto 80 y redirige `/api` al backend, así que la API y la interfaz comparten origen y no necesitan CORS. El único servicio publicado por Traefik es `web` (labels + red `dokploy-network`); `mssql` es la excepción con loopback para el túnel SSH.

1. Crear una aplicación de tipo **Compose** en Dokploy y apuntar al repositorio; archivo de compose: `docker-compose.dokploy.yml`.
2. Copiar `.env.production.example` a `.env` en el servidor (o cargar las variables en la UI de Dokploy):
   - `POSTGRES_USER`, `POSTGRES_PASSWORD` (solo alfanumérica), `POSTGRES_DB`.
   - `SECRET_KEY` generada con `openssl rand -hex 32`.
   - `MSSQL_SA_PASSWORD` para el servicio de BI (ver sección SQL Server para BI).
   - `MP_ACCESS_TOKEN` y `MP_WEBHOOK_URL` solo si se usará Mercado Pago.
   - `APP_DOMAIN` con el dominio del frontend (sin `https://`, sin barra final).
3. DNS: registro **A** de `APP_DOMAIN` apuntando a la IP del VPS.
4. Verificar que exista la red externa de Traefik: `docker network ls | grep dokploy-network`. Si no existe, crearla con `docker network create dokploy-network`.
5. Desplegar. Traefik toma el dominio de los labels del servicio `web` (`Container Port 80`, Let's Encrypt) y redirige HTTP a HTTPS. No se configuran `ports` en el compose ni el dominio en la UI de Dokploy: si se agrega en ambos lados, se duplican los routers.
6. El contenedor `api` ejecuta `alembic upgrade head` antes de arrancar, así que las migraciones se aplican solas en cada despliegue.
7. Verificar `https://APP_DOMAIN/health` y `https://APP_DOMAIN/formulario`.
8. Si se usa Mercado Pago, configurar `MP_WEBHOOK_URL=https://APP_DOMAIN/api/v1/pagos/webhook` y volver a desplegar.

Notas:

- Los datos viven en el volumen `pg18_data` (el antiguo `postgres_data` tenía datos legacy de Postgres 15 y no es compatible con 18; se conserva como respaldo). Programar respaldos con `docker exec establo_db_oltp pg_dump -U $POSTGRES_USER $POSTGRES_DB > respaldo.sql`.
- No se incluye pgAdmin en producción (el `docker-compose.yml` local lo mantiene).
- No ejecutar `seeds/seed_leads.py` en producción: carga contactos de demostración.
- `ENVIRONMENT=production` desactiva `create_all` y el endpoint `simular-aprobacion`; el esquema lo controla Alembic.

## Base de datos canónica (OLTP + mart)

El esquema transaccional es el de SQL Server, portado a PostgreSQL en
`db/postgres/oltp/` (41 tablas + `hermes_mensajes`, PK UUID donde el origen la
tenía). El mart dimensional está en `db/postgres/mart/` y lee el OLTP por
`postgres_fdw`.

- `db_oltp` (5433 local): esquema canónico + datos demo.
- `db_mart` (5434 local): 35 tablas dimensionales.

Verificación de contrato y endpoints:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\check_api_contract.py
$env:DATABASE_URL="postgresql+asyncpg://postgres:test@127.0.0.1:55432/establo_oltp"
.\.venv\Scripts\python.exe scripts\check_endpoints.py
```

Pendiente: portar el ETL de `db/sqlserver/4_*.sql` y `5_*.sql` (dimensiones y
15 hechos) a PostgreSQL. El DDL del mart y la conexión FDW ya están listos.

## Configuración y límites

La configuración está en `backend/.env`; debe coincidir con las credenciales locales de `docker-compose.yml`. No subir ese archivo a Git. Las migraciones sí deben versionarse.

Mercado Pago requiere credenciales válidas de pruebas y una URL HTTPS pública para recibir webhooks; localhost no sirve como webhook externo. No se realizan cobros reales en la verificación local. Las claves existentes no fueron publicadas ni reemplazadas. Si se compartieron anteriormente, revocarlas y regenerarlas desde Mercado Pago.

Esta configuración es de desarrollo: credenciales locales conocidas y API sin autenticación. No exponerla a Internet ni usarla directamente en producción. La fase TURNED se conserva como pantalla pendiente del proyecto original. El bot de negociación y el catálogo de esa pantalla son demostrativos.

Mercado Pago conserva limitaciones del proyecto original: falta validar la firma del webhook y completar conciliación de devoluciones. No habilitar pagos de producción sin resolverlas.

Se actualizaron Vite, React Router y el parser CSS. `pnpm audit --prod` no detecta vulnerabilidades de producción. La auditoría completa conserva avisos de severidad alta en la cadena de herramientas de Tailwind 3 por `braces` sin versión corregida publicada al realizar esta revisión; no procesar patrones de compilación no confiables.

Para detener, usar Ctrl+C en ambas terminales y `docker compose stop` en la raíz. Si la aplicación ya está en marcha en 8000/5173, no iniciar otra copia.
