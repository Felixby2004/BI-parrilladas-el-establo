"""Recibos durables para la idempotencia global del emisor Hermes."""
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class HermesMensaje(Base):
    __tablename__ = "hermes_mensajes"

    message_id: Mapped[str] = mapped_column(String(255), primary_key=True)
    payload_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    id_negociacion: Mapped[int] = mapped_column(
        Integer, ForeignKey("negociacion_leads.id_negociacion", ondelete="RESTRICT"),
        nullable=False, unique=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
