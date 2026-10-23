"""
SCHEMAS PYDANTIC — FASE PAYERS
"""
from datetime import datetime
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID


# ─── MESAS ──────────────────────────────────────────────────
SectorMesa = Literal["salon", "terraza", "privado", "barra"]
EstadoMesa = Literal["disponible", "ocupada", "reservada", "mantenimiento"]


class MesaBase(BaseModel):
    numero: str
    capacidad: int = Field(4, ge=1, le=50)
    sector: Optional[SectorMesa] = "salon"
    estado: EstadoMesa = "disponible"
    descripcion: Optional[str] = None
    activa: bool = True


class MesaCreate(MesaBase):
    pass


class MesaUpdate(MesaBase):
    numero: Optional[str] = None


class MesaRead(MesaBase):
    model_config = ConfigDict(from_attributes=True)
    id_mesa: int
    created_at: datetime
    updated_at: datetime


# ─── PAYERS ─────────────────────────────────────────────────
EstadoPayer = Literal["esperando", "en_proceso", "saldo_pagado", "finalizado"]


class PayerCreate(BaseModel):
    id_lead: UUID
    id_pedido: UUID
    id_buyer: UUID
    id_mesa: Optional[int] = None
    monto_adelanto_pagado: Decimal = Field(Decimal("0.00"), ge=0)
    monto_saldo: Decimal = Field(Decimal("0.00"), ge=0)
    total_pedido: Decimal = Field(Decimal("0.00"), ge=0)
    notas: Optional[str] = None


class PayerUpdate(BaseModel):
    estado: Optional[EstadoPayer] = None
    id_mesa: Optional[int] = None
    notas: Optional[str] = None


class PayerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_payer: UUID
    id_lead: UUID
    id_pedido: UUID
    id_buyer: UUID
    id_mesa: Optional[int]
    estado: str
    fecha_llegada: Optional[datetime]
    fecha_pago_saldo: Optional[datetime]
    monto_adelanto_pagado: Decimal
    monto_saldo: Decimal
    total_pedido: Decimal
    notas: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Relaciones
    buyer_nombre: Optional[str] = None
    buyer_telefono: Optional[str] = None
    mesa_numero: Optional[str] = None


# ─── COBRO DEL SALDO ────────────────────────────────────────
class CobrarSaldoRequest(BaseModel):
    id_payer: UUID
    tipo_pago: Literal["efectivo", "tarjeta", "mercado_pago", "transferencia"] = "mercado_pago"
    monto: Optional[Decimal] = Field(None, gt=0, max_digits=10, decimal_places=2)
    procesado_por: Optional[str] = "Cajero"
    notas: Optional[str] = None


class CobrarSaldoResponse(BaseModel):
    id_instruccion: UUID
    id_comprobante: UUID
    folio: str
    total_cobrado: Decimal
    estado: str
    mensaje: str


# ─── INSTRUCCION_PAGO ───────────────────────────────────────
class InstruccionPagoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_instruccion: UUID
    id_payer: UUID
    tipo_pago: str
    monto: Decimal
    estado: str
    mp_payment_id: Optional[str]
    referencia: Optional[str]
    created_at: datetime


# ─── COMPROBANTE ────────────────────────────────────────────
class ComprobanteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_comprobante: UUID
    id_payer: UUID
    id_pedido: UUID
    folio: str
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    adelanto_aplicado: Decimal
    saldo_cobrado: Decimal
    metodo_pago_saldo: Optional[str]
    generado_por: Optional[str]
    cliente_nombre: Optional[str]
    cliente_telefono: Optional[str]
    observaciones: Optional[str]
    created_at: datetime
