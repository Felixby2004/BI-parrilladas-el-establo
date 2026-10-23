"""Recibos idempotentes del webhook Hermes."""
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class HermesMensaje(Base):
    __tablename__ = "hermes_mensajes"

    message_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    payload_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    id_mensaje: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("mensajes_chat.id_mensaje", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
