#!/usr/bin/env bash
# Configura postgres_fdw en db_mart apuntando a db_oltp.
# Se ejecuta al inicializar el volumen. Las credenciales vienen del entorno
# del contenedor (docker compose), nunca del repositorio.
# Re-ejecutable: refresca el user mapping y vuelve a importar el schema src.
set -euo pipefail

: "${OLTP_HOST:?falta OLTP_HOST}"
: "${OLTP_PORT:?falta OLTP_PORT}"
: "${OLTP_DB:?falta OLTP_DB}"
: "${OLTP_USER:?falta OLTP_USER}"
: "${OLTP_PASSWORD:?falta OLTP_PASSWORD}"

# psql NO interpola variables dentro de DO $$ ... $$. Por eso se genera el SQL
# con format() y se ejecuta con \gexec, donde sí funcionan los :'parametros'.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v host="$OLTP_HOST" -v port="$OLTP_PORT" -v dbname="$OLTP_DB" \
    -v oltp_user="$OLTP_USER" -v oltp_password="$OLTP_PASSWORD" <<'SQL'
CREATE EXTENSION IF NOT EXISTS postgres_fdw;

SELECT format(
    'CREATE SERVER oltp FOREIGN DATA WRAPPER postgres_fdw '
    'OPTIONS (host %L, port %L, dbname %L)',
    :'host', :'port', :'dbname'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_foreign_server WHERE srvname = 'oltp')
\gexec

SELECT format(
    'CREATE USER MAPPING FOR %I SERVER oltp OPTIONS (user %L, password %L)',
    current_user, :'oltp_user', :'oltp_password'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_user_mappings WHERE srvname = 'oltp' AND usename = current_user
)
\gexec

SELECT format(
    'ALTER USER MAPPING FOR %I SERVER oltp OPTIONS (SET user %L, SET password %L)',
    current_user, :'oltp_user', :'oltp_password'
)
WHERE EXISTS (
    SELECT 1 FROM pg_user_mappings WHERE srvname = 'oltp' AND usename = current_user
)
\gexec

DROP SCHEMA IF EXISTS src CASCADE;
CREATE SCHEMA src;
IMPORT FOREIGN SCHEMA public FROM SERVER oltp INTO src;
SQL
