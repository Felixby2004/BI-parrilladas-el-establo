"""Baseline del esquema canónico.

El DDL real vive en db/postgres/oltp/*.sql y lo aplica el initdb del servicio
db_oltp. Alembic queda como baseline para que `alembic upgrade head` no intente
recrear el esquema anterior (ids int) sobre la base canónica.
"""

revision = "20261023_canonical"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
