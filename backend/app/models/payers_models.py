"""Modelos canónicos: mesas, payers, instrucciones de pago y comprobantes."""
from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Mesa(Base):
    __tablename__ = "mesas"

    id_mesa: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    numero: Mapped[str] = mapped_column("numero_mesa", String(10), nullable=False, unique=True)
    capacidad: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    zona: Mapped[Optional[str]] = mapped_column("zona", String(20), nullable=True)
    estado_mesa: Mapped[str] = mapped_column("estado_mesa", String(20), nullable=False, default="DISPONIBLE")
    descripcion: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    activa: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # El DTO usa minúsculas; la columna canónica usa el CHECK en mayúsculas.
    @property
    def sector(self) -> Optional[str]:
        return {"SALON": "salon", "TERRAZA": "terraza", "BARRA": "barra"}.get(self.zona or "", None)

    @sector.setter
    def sector(self, value: Optional[str]) -> None:
        self.zona = {
            "salon": "SALON",
            "terraza": "TERRAZA",
            "privado": "SALON",
            "barra": "BARRA",
        }.get((value or "").lower(), "SALON")

    @property
    def estado(self) -> str:
        return {
            "DISPONIBLE": "disponible",
            "OCUPADA": "ocupada",
            "RESERVADA": "reservada",
            "MANTENIMIENTO": "mantenimiento",
        }.get(self.estado_mesa, "disponible")

    @estado.setter
    def estado(self, value: str) -> None:
        self.estado_mesa = {
            "disponible": "DISPONIBLE",
            "ocupada": "OCUPADA",
            "reservada": "RESERVADA",
            "mantenimiento": "MANTENIMIENTO",
        }.get((value or "").lower(), value if value and value.isupper() else "DISPONIBLE")


class Payer(Base):
    __tablename__ = "payers"

    id_payer: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_lead: Mapped[UUID] = mapped_column(ForeignKey("leads.id_lead"), nullable=False, index=True)
    id_pago: Mapped[UUID] = mapped_column(ForeignKey("pagos.id_pago"), nullable=False)
    id_personal_cajero: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_activacion_servicio: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=func.now()
    )

    # Extensiones de la app
    id_pedido: Mapped[Optional[UUID]] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=True, index=True)
    id_buyer: Mapped[Optional[UUID]] = mapped_column(ForeignKey("buyers.id_buyer"), nullable=True, index=True)
    id_mesa: Mapped[Optional[int]] = mapped_column(ForeignKey("mesas.id_mesa"), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="esperando")
    fecha_llegada: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fecha_pago_saldo: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    monto_adelanto_pagado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    monto_saldo: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_pedido: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    mesa: Mapped[Optional["Mesa"]] = relationship("Mesa", lazy="selectin")
    buyer: Mapped[Optional["Buyer"]] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]
    pedido: Mapped[Optional["Pedido"]] = relationship("Pedido", lazy="selectin")  # type: ignore[name-defined]
    instrucciones: Mapped[list["InstruccionPago"]] = relationship("InstruccionPago", back_populates="payer")
    comprobantes: Mapped[list["Comprobante"]] = relationship("Comprobante", back_populates="payer")


class InstruccionPago(Base):
    __tablename__ = "instrucciones_pago"

    id_instruccion: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_pedido: Mapped[UUID] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=False, index=True)
    canal_pago: Mapped[str] = mapped_column(String(30), nullable=False, default="EFECTIVO")
    monto: Mapped[Decimal] = mapped_column("monto_informado", Numeric(10, 2), nullable=False)
    fecha_envio: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    # Extensiones de la app
    id_payer: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payers.id_payer"), nullable=True, index=True)
    tipo_pago: Mapped[str] = mapped_column(String(30), nullable=False, default="mercado_pago")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    mp_payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mp_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    mp_terminal_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    referencia: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    procesado_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    payer: Mapped[Optional["Payer"]] = relationship("Payer", back_populates="instrucciones")


class Comprobante(Base):
    __tablename__ = "comprobante"

    id_comprobante: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_pago: Mapped[UUID] = mapped_column(ForeignKey("pagos.id_pago"), nullable=False, index=True)
    tipo_comprobante: Mapped[str] = mapped_column(String(30), nullable=False, default="BOLETA_SIMPLE")
    numero_documento_cliente: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    razon_social_cliente: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    serie: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    numero_correlativo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_emision: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    emitido: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Extensiones de la app
    id_payer: Mapped[Optional[UUID]] = mapped_column(ForeignKey("payers.id_payer"), nullable=True, index=True)
    id_pedido: Mapped[Optional[UUID]] = mapped_column(ForeignKey("pedidos.id_pedido"), nullable=True, index=True)
    folio: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    adelanto_aplicado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    saldo_cobrado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    metodo_pago_saldo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    generado_por: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, default="Sistema")
    cliente_nombre: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    cliente_telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    observaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    payer: Mapped[Optional["Payer"]] = relationship("Payer", back_populates="comprobantes")
    pedido: Mapped[Optional["Pedido"]] = relationship("Pedido", lazy="selectin")  # type: ignore[name-defined]
