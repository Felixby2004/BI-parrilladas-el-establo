"""Modelos canónicos: perfiles, chat, pedidos y pagos."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import (
    BigInteger,
    Boolean,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class PerfilGustos(Base):
    __tablename__ = "perfil_gustos"

    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), primary_key=True)
    id_tipo_corte: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    id_termino_coccion: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Extensiones de la app
    tipos_corte_preferidos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    bebidas_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    entradas_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guarniciones_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    postres_preferidos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    alergias: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    restricciones_dieteticas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    presupuesto_por_persona: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    notas_adicionales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    @property
    def id_perfil_gustos(self) -> UUID:
        return self.id_lead


class PerfilReserva(Base):
    __tablename__ = "perfil_reserva"

    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), primary_key=True)
    fecha_reserva: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hora_inicio: Mapped[Optional[time]] = mapped_column("hora_reserva", Time, nullable=True)
    numero_personas: Mapped[Optional[int]] = mapped_column("cantidad_personas", Integer, nullable=True)

    # Extensiones de la app
    hora_fin: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    numero_adultos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    numero_ninos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ocasion_especial: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    nombre_festejado: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    requiere_decoracion: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requiere_musica: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    requiere_pastel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    peticiones_especiales: Mapped[Optional[str]] = mapped_column("observaciones", String(300), nullable=True)
    estado_reserva: Mapped[str] = mapped_column(String(20), nullable=False, default="tentativa")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    @property
    def id_perfil_reserva(self) -> UUID:
        return self.id_lead


class NegociacionLead(Base):
    """Resumen de negociación por lead. Lo usa el BI, no el chat."""

    __tablename__ = "negociacion_leads"

    id_negociacion: Mapped[UUID] = mapped_column(
        primary_key=True, server_default=text("gen_random_uuid()")
    )
    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), nullable=False, index=True)
    resumen_cliente: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    historial_consumo: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)
    cantidad_interacciones: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    ultima_interaccion: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    estado_negociacion: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVA")
    resultado: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)


class SesionChat(Base):
    __tablename__ = "sesiones_chat"

    id_sesion: Mapped[UUID] = mapped_column(primary_key=True, server_default=text("gen_random_uuid()"))
    id_buyer: Mapped[UUID] = mapped_column(ForeignKey("buyers.id_buyer"), nullable=False, index=True)
    id_lead: Mapped[Optional[UUID]] = mapped_column(ForeignKey("leads.id_lead"), nullable=True, index=True)
    id_formulario: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("formularios_captacion.id_formulario"), nullable=True
    )
    numero_whatsapp_cliente: Mapped[str] = mapped_column(String(20), nullable=False)
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=func.now())
    fecha_hora_ultimo_mensaje: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fecha_abandono: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    intencion_detectada: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado_sesion: Mapped[str] = mapped_column(String(30), nullable=False, default="ABIERTA")
    fecha_cierre: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)


class MensajeChat(Base):
    __tablename__ = "mensajes_chat"

    id_negociacion: Mapped[int] = mapped_column("id_mensaje", BigInteger, primary_key=True)
    id_sesion: Mapped[UUID] = mapped_column(ForeignKey("sesiones_chat.id_sesion"), nullable=False, index=True)
    id_personal: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    remitente: Mapped[str] = mapped_column("remitente_app", String(20), nullable=False, default="bot")
    remitente_canonico: Mapped[str] = mapped_column("tipo_remitente", String(15), nullable=False, default="BOT")
    tipo_mensaje: Mapped[str] = mapped_column("tipo_mensaje_app", String(20), nullable=True)
    mensaje: Mapped[str] = mapped_column("mensaje_contenido", Text, nullable=False)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    leido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_hora_mensaje: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    sesion: Mapped["SesionChat"] = relationship("SesionChat", lazy="selectin")

    @property
    def id_lead(self) -> Optional[UUID]:
        return self.sesion.id_lead if self.sesion else None


class Pedido(Base):
    __tablename__ = "pedidos"

    id_pedido: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), nullable=False, index=True)
    tipo_consumo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    tipo_pedido: Mapped[Optional[str]] = mapped_column("tipo_pedido_app", String(20), nullable=True)
    estado: Mapped[str] = mapped_column("estado_impulse", String(30), nullable=False, default="pendiente")
    estado_pedido: Mapped[str] = mapped_column(String(30), nullable=False, default="PENDIENTE")
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))

    # Extensiones de la app
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0.00"))
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    detalles: Mapped[list["DetallePedido"]] = relationship(
        "DetallePedido", back_populates="pedido", cascade="all, delete-orphan", lazy="selectin"
    )
    pagos: Mapped[list["Pago"]] = relationship("Pago", back_populates="pedido")
    lead: Mapped["Lead"] = relationship("Lead", lazy="selectin")  # type: ignore[name-defined]

    @property
    def id_buyer(self) -> Optional[UUID]:
        return self.lead.id_buyer if self.lead else None


class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id_detalle: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    id_pedido: Mapped[UUID] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=False, index=True)
    id_producto: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("productos.id_producto"), nullable=True
    )
    nombre_producto: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    categoria: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), Computed("cantidad * precio_unitario", persisted=True)
    )
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    notas_especiales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship("Producto", lazy="selectin")  # type: ignore[name-defined]


class Pago(Base):
    __tablename__ = "pagos"

    id_pago: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_pedido: Mapped[UUID] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=False, index=True)
    id_lead: Mapped[Optional[UUID]] = mapped_column(ForeignKey("leads.id_lead"), nullable=True)
    metodo_pago: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDIENTE")
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fecha_pago: Mapped[Optional[datetime]] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Extensiones de la app
    tipo_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="adelanto")
    estado: Mapped[str] = mapped_column("estado_app", String(20), nullable=False, default="pendiente")
    porcentaje: Mapped[Optional[Decimal]] = mapped_column(Numeric(5, 2), nullable=True)
    mp_preference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    mp_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mp_status_detail: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mp_external_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    mp_init_point: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pagador_nombre: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    pagador_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="pagos")
