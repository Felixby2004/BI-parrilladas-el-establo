"""
MODELOS FASE CUSTOMERS - PARRILLADAS EL ESTABLO
================================================
Tablas: servicios, servicio_detalle, alertas_consumo, resenas_servicio
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric,
    DateTime, ForeignKey, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


# =============================================================
# 1. SERVICIOS — Comanda del servicio en salón
# =============================================================
class Servicio(Base):
    __tablename__ = "servicios"

    id_servicio: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_payer: Mapped[int] = mapped_column(
        Integer, ForeignKey("payers.id_payer", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_mesa: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mesas.id_mesa", ondelete="SET NULL"),
        nullable=True, index=True
    )

    estado: Mapped[str] = mapped_column(
        # en_espera | preparando | servido | finalizado | cancelado
        String(20), nullable=False, default="en_espera"
    )

    hora_inicio: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    hora_fin: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Parrillero asignado
    id_parrillero: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("personal.id_personal", ondelete="SET NULL"), nullable=True
    )

    prioridad: Mapped[str] = mapped_column(
        # normal | urgente | vip
        String(15), nullable=False, default="normal"
    )
    notas_cocina: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    detalles: Mapped[list["ServicioDetalle"]] = relationship(
        "ServicioDetalle", back_populates="servicio", cascade="all, delete-orphan"
    )
    alertas: Mapped[list["AlertaConsumo"]] = relationship("AlertaConsumo", back_populates="servicio")
    resenas: Mapped[list["ResenaServicio"]] = relationship("ResenaServicio", back_populates="servicio")
    mesa: Mapped[Optional["Mesa"]] = relationship("Mesa", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Servicio id={self.id_servicio} estado='{self.estado}'>"


# =============================================================
# 2. SERVICIO_DETALLE — Ítems de la comanda
# =============================================================
class ServicioDetalle(Base):
    __tablename__ = "servicio_detalle"

    id_servicio_detalle: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_servicio: Mapped[int] = mapped_column(
        Integer, ForeignKey("servicios.id_servicio", ondelete="CASCADE"),
        nullable=False, index=True
    )
    id_detalle_pedido: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("detalle_pedido.id_detalle", ondelete="SET NULL"), nullable=True
    )

    nombre_item: Mapped[str] = mapped_column(String(200), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    estado_item: Mapped[str] = mapped_column(
        # pendiente | preparando | listo | entregado | cancelado
        String(20), nullable=False, default="pendiente"
    )

    prioridad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notas_cocina: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tiempo_preparacion_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="detalles")


# =============================================================
# 3. ALERTAS_CONSUMO — Avisos en tiempo real para el personal
# =============================================================
class AlertaConsumo(Base):
    __tablename__ = "alertas_consumo"

    id_alerta: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_servicio: Mapped[int] = mapped_column(
        Integer, ForeignKey("servicios.id_servicio", ondelete="CASCADE"),
        nullable=False, index=True
    )

    tipo_alerta: Mapped[str] = mapped_column(
        # tiempo_espera | pedido_adicional | incidencia | vip_mesa | demora_cocina
        String(30), nullable=False
    )
    descripcion: Mapped[str] = mapped_column(Text, nullable=False)
    nivel: Mapped[str] = mapped_column(
        # info | warning | critical
        String(15), nullable=False, default="info"
    )
    atendida: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    atendida_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="alertas")


# =============================================================
# 4. RESENAS_SERVICIO — Reseña de 5 estrellas del cliente
# =============================================================
class ResenaServicio(Base):
    __tablename__ = "resenas_servicio"

    id_resena: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_servicio: Mapped[int] = mapped_column(
        Integer, ForeignKey("servicios.id_servicio", ondelete="CASCADE"),
        nullable=False, index=True
    )
    id_buyer: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("buyers.id_buyer", ondelete="SET NULL"), nullable=True
    )

    calificacion_general: Mapped[int] = mapped_column(Integer, nullable=False)  # 1–5
    calificacion_comida: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_servicio: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_ambiente: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_precio: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    comentario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recomendaria: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    publicar: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="resenas")
    buyer: Mapped[Optional["Buyer"]] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Resena id={self.id_resena} estrellas={self.calificacion_general}>"
