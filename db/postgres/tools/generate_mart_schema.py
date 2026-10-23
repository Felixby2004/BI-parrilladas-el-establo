"""Genera el DDL PostgreSQL del mart a partir del script T-SQL canónico.

Fuente: db/sqlserver/3_mart_parrilla_estructura_v1.sql
Salida: db/postgres/mart/04_mart_schema.sql

Los nombres CamelCase del origen quedan sin comillas: Postgres los pliega a
minúsculas igual que SQL Server ignora mayúsculas, así el ETL se escribe una
sola vez y no hay que citar 200 identificadores.

Uso:  python db/postgres/tools/generate_mart_schema.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from generate_oltp_schema import convert_column_lines  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
SOURCE = ROOT / "db" / "sqlserver" / "3_mart_parrilla_estructura_v1.sql"
TARGET = ROOT / "db" / "postgres" / "mart" / "04_mart_schema.sql"

TABLE_RE = re.compile(r"CREATE TABLE dbo\.(\w+)\s*\((.*?)\n\s*\);", re.S)


def main() -> None:
    sql = SOURCE.read_text(encoding="utf-8", errors="replace")
    blocks: list[str] = []
    names: list[str] = []
    for match in TABLE_RE.finditer(sql):
        table = match.group(1)
        names.append(table)
        body = convert_column_lines(match.group(2), table)
        blocks.append(f"CREATE TABLE IF NOT EXISTS {table} ({body}\n);")

    header = f"""\
-- GENERADO por db/postgres/tools/generate_mart_schema.py
-- Fuente: db/sqlserver/3_mart_parrilla_estructura_v1.sql
-- Mart dimensional: {len(names)} tablas (dimensiones y hechos).
-- Sin comillas: Postgres pliega a minúsculas, igual que SQL Server ignora
-- mayúsculas. El ETL usa los mismos nombres sin citar.
--
-- No editar a mano: cambiar el origen y regenerar.

SET client_min_messages = warning;

"""
    TARGET.parent.mkdir(parents=True, exist_ok=True)
    TARGET.write_text(header + "\n\n".join(blocks) + "\n", encoding="utf-8")
    print(f"generado {TARGET} ({len(names)} tablas)")


if __name__ == "__main__":
    main()
