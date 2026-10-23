"""Recibos idempotentes de mensajes Hermes.

Revision ID: 20261023_hermes
Revises: 9b7a4d4335ff

La versión de desarrollo anterior creaba tablas en startup. Si ya existe la
misma tabla se adopta sin borrar datos; alembic check verifica la coincidencia.
"""
from alembic import op
import sqlalchemy as sa

revision = "20261023_hermes"
down_revision = "9b7a4d4335ff"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("hermes_mensajes"):
        expected = {"message_id", "payload_sha256", "id_negociacion", "created_at"}
        if {c["name"] for c in inspector.get_columns("hermes_mensajes")} != expected:
            raise RuntimeError("La tabla Hermes existente no coincide. Revisar el esquema antes de migrar; no se borraron datos.")
        return
    op.create_table(
        "hermes_mensajes",
        sa.Column("message_id", sa.String(255), nullable=False),
        sa.Column("payload_sha256", sa.String(64), nullable=False),
        sa.Column("id_negociacion", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["id_negociacion"], ["negociacion_leads.id_negociacion"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("message_id"),
        sa.UniqueConstraint("id_negociacion"),
    )


def downgrade() -> None:
    op.drop_table("hermes_mensajes")
