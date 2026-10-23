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

## Verificación

```powershell
cd backend
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m alembic check
.\.venv\Scripts\python.exe scripts\check_http_flow.py
.\.venv\Scripts\python.exe scripts\check_http_flow.py --postgres
cd ..\frontend
pnpm build
pnpm audit --prod
```

Verificado: compilación de producción y TypeScript, 15 regresiones HTTP, flujo completo con PostgreSQL y respuestas HTTP 200 de interfaz/API/proxy. La prueba visual automatizada de Edge no se pudo completar porque el navegador dejó de responder al protocolo de depuración; no se considera una prueba E2E visual aprobada.

El flujo HTTP de PostgreSQL usa rollback: no deja clientes ni cobros de prueba en la base. No llama a Mercado Pago. La semilla se puede volver a ejecutar sin duplicar los dos contactos demo. Las versiones Python verificadas están fijadas en [requirements.lock.txt](backend/requirements.lock.txt), usado por el inicio con `-Instalar`; el frontend fija sus versiones en `pnpm-lock.yaml` para `pnpm install --frozen-lockfile`.

## Despliegue (Dokploy)

El despliegue usa `docker-compose.dokploy.yml`: PostgreSQL 18, API FastAPI y frontend Nginx. El frontend publica un solo puerto y redirige `/api` al backend, así que la API y la interfaz comparten origen y no necesitan CORS.

1. Crear una aplicación de tipo **Compose** en Dokploy y apuntar al repositorio; archivo de compose: `docker-compose.dokploy.yml`.
2. Copiar `.env.production.example` a `.env` en el servidor (o cargar las variables en la UI de Dokploy):
   - `POSTGRES_USER`, `POSTGRES_PASSWORD` (solo alfanumérica), `POSTGRES_DB`.
   - `SECRET_KEY` generada con `openssl rand -hex 32`.
   - `MP_ACCESS_TOKEN` y `MP_WEBHOOK_URL` solo si se usará Mercado Pago.
   - `WEB_PORT` (por defecto 3000) es el puerto del host que Dokploy publica.
3. Asignar el dominio en Dokploy al servicio `web`, puerto `80`, con certificado Let's Encrypt.
4. Desplegar. El contenedor `api` ejecuta `alembic upgrade head` antes de arrancar, así que las migraciones se aplican solas en cada despliegue.
5. Verificar `https://tu-dominio/health` y `https://tu-dominio/formulario`.
6. Si se usa Mercado Pago, configurar `MP_WEBHOOK_URL=https://tu-dominio/api/v1/pagos/webhook` y volver a desplegar.

Notas:

- Los datos viven en el volumen `postgres_data`. Programar respaldos con `docker exec <db> pg_dump -U $POSTGRES_USER $POSTGRES_DB > respaldo.sql`.
- No se incluye pgAdmin en producción (el `docker-compose.yml` local lo mantiene).
- No ejecutar `seeds/seed_leads.py` en producción: carga contactos de demostración.
- `ENVIRONMENT=production` desactiva `create_all` y el endpoint `simular-aprobacion`; el esquema lo controla Alembic.

## Configuración y límites

La configuración está en `backend/.env`; debe coincidir con las credenciales locales de `docker-compose.yml`. No subir ese archivo a Git. Las migraciones sí deben versionarse.

Mercado Pago requiere credenciales válidas de pruebas y una URL HTTPS pública para recibir webhooks; localhost no sirve como webhook externo. No se realizan cobros reales en la verificación local. Las claves existentes no fueron publicadas ni reemplazadas. Si se compartieron anteriormente, revocarlas y regenerarlas desde Mercado Pago.

Esta configuración nació como desarrollo: credenciales locales conocidas y API sin autenticación. El stack ya se puede desplegar, pero mientras la API siga sin autenticación no debe quedar abierta al público: restringir el acceso al dominio (por ejemplo, con autenticación básica en Dokploy/Traefik o una lista de IPs). La fase TURNED se conserva como pantalla pendiente del proyecto original. El bot de negociación y el catálogo de esa pantalla son demostrativos.

Mercado Pago conserva limitaciones del proyecto original: falta validar la firma del webhook y completar conciliación de devoluciones. No habilitar pagos de producción sin resolverlas.

Se actualizaron Vite, React Router y el parser CSS. `pnpm audit --prod` no detecta vulnerabilidades de producción. La auditoría completa conserva avisos de severidad alta en la cadena de herramientas de Tailwind 3 por `braces` sin versión corregida publicada al realizar esta revisión; no procesar patrones de compilación no confiables.

Para detener, usar Ctrl+C en ambas terminales y `docker compose stop` en la raíz. Si la aplicación ya está en marcha en 8000/5173, no iniciar otra copia.
