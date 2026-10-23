"""Modelos canónicos: servicios de salón, alertas y reseñas."""
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Servicio(Base):
    __tablename__ = "servicios"

    id_servicio: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), nullable=False, index=True)
    id_payer: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payers.id_payer"), nullable=True, index=True)
    id_mesa: Mapped[Optional[int]] = mapped_column(ForeignKey("mesas.id_mesa"), nullable=True, index=True)
    tipo_servicio: Mapped[str] = mapped_column(String(30), nullable=False, default="SALON")
    estado_servicio: Mapped[str] = mapped_column(String(30), nullable=False, default="EN_PREPARACION")

    # Extensiones de la app
    estado: Mapped[str] = mapped_column("estado_impulse", String(20), nullable=False, default="en_espera")
    hora_inicio: Mapped[Optional[datetime]] = mapped_column(
        "fecha_inicio_servicio", DateTime, server_default=func.now(), nullable=False
    )
    hora_fin: Mapped[Optional[datetime]] = mapped_column("fecha_fin_servicio", DateTime, nullable=True)
    id_parrillero: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    notas_cocina: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    detalles: Mapped[list["ServicioDetalle"]] = relationship(
        "ServicioDetalle", back_populates="servicio", cascade="all, delete-orphan", lazy="selectin"
    )
    alertas: Mapped[list["AlertaConsumo"]] = relationship("AlertaConsumo", back_populates="servicio")
    resenas: Mapped[list["ResenaServicio"]] = relationship("ResenaServicio", back_populates="servicio")
    mesa: Mapped[Optional["Mesa"]] = relationship("Mesa", lazy="selectin")  # type: ignore[name-defined]


class ServicioDetalle(Base):
    __tablename__ = "servicio_detalle"

    id_servicio_detalle: Mapped[UUID] = mapped_column(
        "id_detalle", primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_servicio: Mapped[UUID] = mapped_column(ForeignKey("servicios.id_servicio"), nullable=False, index=True)
    id_detalle_pedido: Mapped[Optional[int]] = mapped_column(
        ForeignKey("detalle_pedido.id_detalle"), nullable=True
    )
    nombre_item: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado_item: Mapped[str] = mapped_column("estado_item_app", String(20), nullable=False, default="pendiente")
    estado_item_canonico: Mapped[str] = mapped_column("estado_item", String(30), nullable=False, default="PENDIENTE")
    prioridad: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    notas_cocina: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tiempo_preparacion_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="detalles")


class AlertaConsumo(Base):
    __tablename__ = "alertas_consumo"

    id_alerta: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_servicio: Mapped[UUID] = mapped_column(ForeignKey("servicios.id_servicio"), nullable=False, index=True)
    tipo_alerta_canonico: Mapped[str] = mapped_column("tipo_alerta", String(30), nullable=False, default="RECORDATORIO_CUENTA")
    descripcion: Mapped[str] = mapped_column("mensaje_enviado", String(150), nullable=False, default="")
    atendida: Mapped[bool] = mapped_column("aceptada", Boolean, default=False, nullable=False)

    # Extensiones de la app
    tipo_alerta: Mapped[str] = mapped_column("tipo_alerta_app", String(30), nullable=False)
    nivel: Mapped[str] = mapped_column(String(15), nullable=False, default="info")
    atendida_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="alertas")


class ResenaServicio(Base):
    __tablename__ = "resenas_servicio"

    id_resena: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_servicio: Mapped[UUID] = mapped_column(ForeignKey("servicios.id_servicio"), nullable=False, index=True)
    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), nullable=False, index=True)
    calificacion_general: Mapped[int] = mapped_column("calificacion_estrellas", Integer, nullable=False)
    comentario: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Extensiones de la app
    id_buyer: Mapped[Optional[UUID]] = mapped_column(ForeignKey("buyers.id_buyer"), nullable=True)
    calificacion_comida: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_servicio: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_ambiente: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    calificacion_precio: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recomendaria: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    publicar: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    servicio: Mapped["Servicio"] = relationship("Servicio", back_populates="resenas")
