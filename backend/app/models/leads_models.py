"""
MODELOS FASE LEADS/NEGOCIACIÓN - PARRILLADAS EL ESTABLO
=========================================================
Tablas: perfil_gustos, perfil_reserva, negociacion_leads,
        pedidos, detalle_pedido, pagos
"""
from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric,
    DateTime, Date, Time, ForeignKey, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


# =============================================================
# 1. PERFIL_GUSTOS — Preferencias gastronómicas del lead
# =============================================================
class PerfilGustos(Base):
    __tablename__ = "perfil_gustos"

    id_perfil_gustos: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )

    # Preferencias de corte (JSON-like, ej: "ribeye,t-bone,picaña")
    tipos_corte_preferidos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Término de cocción (inglés | tres cuartos | bien cocido | a punto)
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Bebidas preferidas
    bebidas_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Entradas, postres, guarniciones
    entradas_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    guarniciones_preferidas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    postres_preferidos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Restricciones
    alergias: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    restricciones_dieteticas: Mapped[Optional[str]] = mapped_column(
        # vegetariano | vegano | sin_gluten | sin_lactosa | ninguna
        String(100), nullable=True
    )

    # Nivel de gasto esperado
    presupuesto_por_persona: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )

    notas_adicionales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    lead: Mapped["Lead"] = relationship("Lead", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<PerfilGustos id={self.id_perfil_gustos} lead={self.id_lead}>"


# =============================================================
# 2. PERFIL_RESERVA — Detalles de la reserva confirmada
# =============================================================
class PerfilReserva(Base):
    __tablename__ = "perfil_reserva"

    id_perfil_reserva: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="CASCADE"),
        nullable=False, unique=True, index=True
    )

    # Cuándo
    fecha_reserva: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hora_inicio: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    hora_fin: Mapped[Optional[time]] = mapped_column(Time, nullable=True)

    # Quiénes
    numero_personas: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    numero_adultos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    numero_ninos: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Ocasión
    ocasion_especial: Mapped[Optional[str]] = mapped_column(
        # cumpleanos | aniversario | empresa | ninguna | otro
        String(50), nullable=True
    )
    nombre_festejado: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    # Servicios adicionales
    requiere_decoracion: Mapped[bool] = mapped_column(Boolean, default=False)
    requiere_musica: Mapped[bool] = mapped_column(Boolean, default=False)
    requiere_pastel: Mapped[bool] = mapped_column(Boolean, default=False)

    peticiones_especiales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Estado de la reserva
    estado_reserva: Mapped[str] = mapped_column(
        # tentativa | confirmada | cancelada
        String(20), nullable=False, default="tentativa"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    lead: Mapped["Lead"] = relationship("Lead", lazy="selectin")  # type: ignore[name-defined]


# =============================================================
# 3. NEGOCIACION_LEADS — Log de mensajes del chat
# =============================================================
class NegociacionLead(Base):
    __tablename__ = "negociacion_leads"

    id_negociacion: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="CASCADE"),
        nullable=False, index=True
    )

    # Quién envía: bot | agente | cliente
    remitente: Mapped[str] = mapped_column(String(20), nullable=False, default="bot")
    mensaje: Mapped[str] = mapped_column(Text, nullable=False)

    # Metadata del mensaje
    tipo_mensaje: Mapped[Optional[str]] = mapped_column(
        # texto | sugerencia | pedido | pago | sistema
        String(30), nullable=True, default="texto"
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    leido: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    lead: Mapped["Lead"] = relationship("Lead")  # type: ignore[name-defined]


# =============================================================
# 4. PEDIDOS — Cabecera del pedido
# =============================================================
class Pedido(Base):
    __tablename__ = "pedidos"

    id_pedido: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_buyer: Mapped[int] = mapped_column(
        Integer, ForeignKey("buyers.id_buyer", ondelete="RESTRICT"),
        nullable=False, index=True
    )

    # Montos
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    descuento: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    # Estado
    estado: Mapped[str] = mapped_column(
        # borrador | confirmado | pagado_adelanto | completado | cancelado
        String(30), nullable=False, default="borrador"
    )
    tipo_pedido: Mapped[Optional[str]] = mapped_column(
        # reserva | delivery | salon
        String(20), nullable=True, default="reserva"
    )
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    detalles: Mapped[list["DetallePedido"]] = relationship(
        "DetallePedido", back_populates="pedido", cascade="all, delete-orphan"
    )
    pagos: Mapped[list["Pago"]] = relationship("Pago", back_populates="pedido")
    buyer: Mapped["Buyer"] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]
    lead: Mapped["Lead"] = relationship("Lead", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Pedido id={self.id_pedido} total={self.total} estado='{self.estado}'>"


# =============================================================
# 5. DETALLE_PEDIDO — Ítems del pedido
# =============================================================
class DetallePedido(Base):
    __tablename__ = "detalle_pedido"

    id_detalle: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_pedido: Mapped[int] = mapped_column(
        Integer, ForeignKey("pedidos.id_pedido", ondelete="CASCADE"),
        nullable=False, index=True
    )
    id_producto: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("productos.id_producto", ondelete="SET NULL"),
        nullable=True
    )

    # Nombre capturado en el momento del pedido (para trazabilidad)
    nombre_producto: Mapped[str] = mapped_column(String(200), nullable=False)
    categoria: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Personalizaciones
    termino_coccion: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notas_especiales: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="detalles")
    producto: Mapped[Optional["Producto"]] = relationship("Producto", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<DetallePedido id={self.id_detalle} '{self.nombre_producto}' x{self.cantidad}>"


# =============================================================
# 6. PAGOS — Registro de transacciones (adelanto y saldo)
# =============================================================
class Pago(Base):
    __tablename__ = "pagos"

    id_pago: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_pedido: Mapped[int] = mapped_column(
        Integer, ForeignKey("pedidos.id_pedido", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="RESTRICT"),
        nullable=False, index=True
    )

    # Tipo y monto
    tipo_pago: Mapped[str] = mapped_column(
        # adelanto | saldo | total
        String(20), nullable=False, default="adelanto"
    )
    porcentaje: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True  # ej: 10.00 para el 10%
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    # Estado del pago
    estado: Mapped[str] = mapped_column(
        # pendiente | aprobado | rechazado | reembolsado | en_proceso
        String(20), nullable=False, default="pendiente"
    )

    # Mercado Pago
    mp_preference_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    mp_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mp_status_detail: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mp_external_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mp_init_point: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Datos del pagador
    pagador_nombre: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    pagador_email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)

    fecha_pago: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    pedido: Mapped["Pedido"] = relationship("Pedido", back_populates="pagos")

    def __repr__(self) -> str:
        return f"<Pago id={self.id_pago} tipo='{self.tipo_pago}' monto={self.monto} estado='{self.estado}'>"
