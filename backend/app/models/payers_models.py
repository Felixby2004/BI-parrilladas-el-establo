"""
MODELOS FASE PAYERS - PARRILLADAS EL ESTABLO
=============================================
Tablas: mesas, payers, instrucciones_pago, comprobante
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric,
    DateTime, Date, ForeignKey, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base


# =============================================================
# 1. MESAS — Distribución del salón
# =============================================================
class Mesa(Base):
    __tablename__ = "mesas"

    id_mesa: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    numero: Mapped[str] = mapped_column(String(10), nullable=False, unique=True)
    capacidad: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    sector: Mapped[Optional[str]] = mapped_column(
        # salon | terraza | privado | barra
        String(30), nullable=True, default="salon"
    )
    estado: Mapped[str] = mapped_column(
        # disponible | ocupada | reservada | mantenimiento
        String(20), nullable=False, default="disponible"
    )
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<Mesa #{self.numero} estado='{self.estado}'>"


# =============================================================
# 2. PAYERS — Clientes que llegaron a caja a pagar el saldo
# =============================================================
class Payer(Base):
    __tablename__ = "payers"

    id_payer: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_lead: Mapped[int] = mapped_column(
        Integer, ForeignKey("leads.id_lead", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_pedido: Mapped[int] = mapped_column(
        Integer, ForeignKey("pedidos.id_pedido", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_buyer: Mapped[int] = mapped_column(
        Integer, ForeignKey("buyers.id_buyer", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_mesa: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("mesas.id_mesa", ondelete="SET NULL"), nullable=True
    )

    estado: Mapped[str] = mapped_column(
        # esperando | en_proceso | saldo_pagado | finalizado
        String(20), nullable=False, default="esperando"
    )

    fecha_llegada: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    fecha_pago_saldo: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Montos
    monto_adelanto_pagado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    monto_saldo: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    total_pedido: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    mesa: Mapped[Optional["Mesa"]] = relationship("Mesa", lazy="selectin")
    buyer: Mapped["Buyer"] = relationship("Buyer", lazy="selectin")       # type: ignore[name-defined]
    pedido: Mapped["Pedido"] = relationship("Pedido", lazy="selectin")    # type: ignore[name-defined]
    instrucciones: Mapped[list["InstruccionPago"]] = relationship("InstruccionPago", back_populates="payer")
    comprobantes: Mapped[list["Comprobante"]] = relationship("Comprobante", back_populates="payer")

    def __repr__(self) -> str:
        return f"<Payer id={self.id_payer} estado='{self.estado}'>"


# =============================================================
# 3. INSTRUCCIONES_PAGO — Registro del método de cobro del saldo
# =============================================================
class InstruccionPago(Base):
    __tablename__ = "instrucciones_pago"

    id_instruccion: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_payer: Mapped[int] = mapped_column(
        Integer, ForeignKey("payers.id_payer", ondelete="CASCADE"),
        nullable=False, index=True
    )

    tipo_pago: Mapped[str] = mapped_column(
        # efectivo | tarjeta | mercado_pago | transferencia | mixto
        String(30), nullable=False, default="mercado_pago"
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    estado: Mapped[str] = mapped_column(
        # pendiente | procesado | rechazado
        String(20), nullable=False, default="pendiente"
    )

    # Mercado Pago Point (terminal física)
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mp_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mp_terminal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    referencia: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    procesado_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    payer: Mapped["Payer"] = relationship("Payer", back_populates="instrucciones")


# =============================================================
# 4. COMPROBANTE — Factura/ticket del consumo completo
# =============================================================
class Comprobante(Base):
    __tablename__ = "comprobante"

    id_comprobante: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_payer: Mapped[int] = mapped_column(
        Integer, ForeignKey("payers.id_payer", ondelete="RESTRICT"),
        nullable=False, index=True
    )
    id_pedido: Mapped[int] = mapped_column(
        Integer, ForeignKey("pedidos.id_pedido", ondelete="RESTRICT"),
        nullable=False, index=True
    )

    folio: Mapped[str] = mapped_column(String(30), nullable=False, unique=True, index=True)

    # Montos finales
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    descuento: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    adelanto_aplicado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    saldo_cobrado: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    metodo_pago_saldo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    generado_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Sistema")

    # Datos del cliente para el comprobante
    cliente_nombre: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    cliente_telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    payer: Mapped["Payer"] = relationship("Payer", back_populates="comprobantes")
    pedido: Mapped["Pedido"] = relationship("Pedido", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Comprobante folio={self.folio} total={self.total}>"
