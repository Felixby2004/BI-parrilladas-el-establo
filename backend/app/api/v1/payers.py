"""
ROUTER: PAYERS — Caja y cobro del saldo restante
"""
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.core.config import settings
from app.models.payers_models import Mesa, Payer, InstruccionPago, Comprobante
from app.models.leads_models import Pedido, Pago
from app.models.buyers_models import Lead
from app.models.base_models import Buyer
from app.schemas.payers_schemas import (
    MesaCreate, MesaUpdate, MesaRead,
    PayerCreate, PayerUpdate, PayerRead,
    CobrarSaldoRequest, CobrarSaldoResponse,
    InstruccionPagoRead, ComprobanteRead, EstadoMesa,
)

router = APIRouter(tags=["💳 PAYERS — Caja"])

mesas_router  = APIRouter(prefix="/mesas")
payers_router = APIRouter(prefix="/payers")
caja_router   = APIRouter(prefix="/caja")


# ═══════════════════════════════════════════════════════════
# MESAS
# ═══════════════════════════════════════════════════════════
@mesas_router.get("", response_model=list[MesaRead])
async def listar_mesas(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Mesa).where(Mesa.activa == True).order_by(Mesa.numero))
    return r.scalars().all()


@mesas_router.post("", response_model=MesaRead, status_code=201)
async def crear_mesa(payload: MesaCreate, db: AsyncSession = Depends(get_db)):
    mesa = Mesa(**payload.model_dump())
    db.add(mesa); await db.flush()
    return mesa


@mesas_router.patch("/{id_mesa}/estado", response_model=MesaRead)
async def actualizar_estado_mesa(id_mesa: int, estado: EstadoMesa, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Mesa).where(Mesa.id_mesa == id_mesa))
    mesa = r.scalar_one_or_none()
    if not mesa:
        raise HTTPException(404, "Mesa no encontrada")
    mesa.estado = estado
    return mesa


# ═══════════════════════════════════════════════════════════
# PAYERS — Lista de clientes que deben pagar en caja
# ═══════════════════════════════════════════════════════════
@payers_router.get("", response_model=list[PayerRead])
async def listar_payers(
    estado: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Payer)
        .options(selectinload(Payer.mesa), selectinload(Payer.buyer))
        .order_by(Payer.created_at.desc())
    )
    if estado:
        q = q.where(Payer.estado == estado)
    r = await db.execute(q)
    payers = r.scalars().all()

    result = []
    for p in payers:
        pr = PayerRead.model_validate(p)
        if p.buyer:
            pr.buyer_nombre = f"{p.buyer.nombre} {p.buyer.apellido or ''}".strip()
            pr.buyer_telefono = p.buyer.telefono
        if p.mesa:
            pr.mesa_numero = p.mesa.numero
        result.append(pr)
    return result


@payers_router.post("", response_model=PayerRead, status_code=201)
async def crear_payer(payload: PayerCreate, db: AsyncSession = Depends(get_db)):
    """Registra la llegada de un cliente a caja para pagar el saldo."""
    # Bloquear el pedido serializa altas concurrentes para la misma cuenta.
    r = await db.execute(select(Pedido).where(Pedido.id_pedido == payload.id_pedido).with_for_update())
    pedido = r.scalar_one_or_none()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    if (pedido.id_lead, pedido.id_buyer) != (payload.id_lead, payload.id_buyer):
        raise HTTPException(422, "Lead y buyer no corresponden al pedido")
    if pedido.estado in ("cancelado", "completado"):
        raise HTTPException(409, "El pedido está cerrado")
    existing = await db.execute(select(Payer.id_payer).where(Payer.id_pedido == payload.id_pedido).limit(1))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(409, "El pedido ya tiene un payer")
    if payload.id_mesa is not None:
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa, Mesa.activa == True))
        if mesa_r.scalar_one_or_none() is None:
            raise HTTPException(404, "Mesa no encontrada o inactiva")
    pagos_r = await db.execute(select(Pago).where(Pago.id_pedido == payload.id_pedido, Pago.estado == "aprobado"))
    adelanto = sum((p.monto for p in pagos_r.scalars().all()), Decimal("0.00"))
    if adelanto > pedido.total:
        raise HTTPException(409, "Los pagos aprobados superan el total del pedido")
    # Los importes son contables, no valores confiables del navegador.
    data = payload.model_dump(exclude={"monto_adelanto_pagado", "monto_saldo", "total_pedido"})
    payer = Payer(**data, fecha_llegada=datetime.utcnow(),
                  monto_adelanto_pagado=adelanto, monto_saldo=pedido.total - adelanto,
                  total_pedido=pedido.total)
    db.add(payer)
    await db.flush()
    if adelanto > 0:
        pedido.estado = "pagado_adelanto"

    result = PayerRead.model_validate(payer)

    buyer_r = await db.execute(select(Buyer).where(Buyer.id_buyer == payload.id_buyer))
    buyer = buyer_r.scalar_one_or_none()
    if buyer:
        result.buyer_nombre = f"{buyer.nombre} {buyer.apellido or ''}".strip()
        result.buyer_telefono = buyer.telefono

    return result


@payers_router.patch("/{id_payer}", response_model=PayerRead)
async def actualizar_payer(id_payer: int, payload: PayerUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Payer).options(selectinload(Payer.buyer), selectinload(Payer.mesa)).where(Payer.id_payer == id_payer))
    payer = r.scalar_one_or_none()
    if not payer:
        raise HTTPException(404, "Payer no encontrado")
    if payload.id_mesa is not None:
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa, Mesa.activa == True))
        mesa = mesa_r.scalar_one_or_none()
        if mesa is None:
            raise HTTPException(404, "Mesa no encontrada o inactiva")
        payer.mesa = mesa
    # No permitir saltarse caja ni reabrir una cuenta cobrada desde PATCH.
    if payload.estado is not None and payload.estado != payer.estado:
        if (payload.estado == "saldo_pagado"
                or payer.estado == "finalizado"
                or (payer.estado == "saldo_pagado" and payload.estado != "finalizado")
                or (payload.estado == "finalizado" and payer.estado != "saldo_pagado")):
            raise HTTPException(409, "El estado de cobro sólo se modifica desde caja")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(payer, k, v)
    await db.flush()
    await db.refresh(payer, attribute_names=["updated_at"])

    result = PayerRead.model_validate(payer)
    if payer.buyer:
        result.buyer_nombre = f"{payer.buyer.nombre} {payer.buyer.apellido or ''}".strip()
        result.buyer_telefono = payer.buyer.telefono
    if payer.mesa:
        result.mesa_numero = payer.mesa.numero
    return result


# ═══════════════════════════════════════════════════════════
# CAJA — Cobro del saldo + generación de comprobante
# ═══════════════════════════════════════════════════════════
@caja_router.post(
    "/cobrar-saldo",
    response_model=CobrarSaldoResponse,
    status_code=201,
    summary="Cobrar el saldo restante y generar comprobante",
)
async def cobrar_saldo(payload: CobrarSaldoRequest, db: AsyncSession = Depends(get_db)):
    # Este router sólo simula Point; nunca declarar un cobro MP real como aprobado.
    if payload.tipo_pago == "mercado_pago" and settings.ENVIRONMENT != "development":
        raise HTTPException(501, "Cobro Mercado Pago Point no implementado fuera de desarrollo")
    # Obtener payer
    r = await db.execute(
        select(Payer)
        .options(selectinload(Payer.buyer), selectinload(Payer.pedido))
        .where(Payer.id_payer == payload.id_payer)
        .with_for_update()
    )
    payer = r.scalar_one_or_none()
    if not payer:
        raise HTTPException(404, "Payer no encontrado")
    if payer.estado in ("saldo_pagado", "finalizado") or payer.fecha_pago_saldo is not None:
        raise HTTPException(409, "El saldo de este payer ya fue cobrado")

    monto_a_cobrar = payload.monto if payload.monto is not None else payer.monto_saldo
    if monto_a_cobrar != payer.monto_saldo or monto_a_cobrar < 0:
        raise HTTPException(422, "Debe cobrarse exactamente el saldo pendiente")

    # Registrar instrucción de pago
    instruccion = InstruccionPago(
        id_payer=payload.id_payer,
        tipo_pago=payload.tipo_pago,
        monto=monto_a_cobrar,
        estado="procesado",
        procesado_por=payload.procesado_por,
        notas=payload.notas,
        mp_payment_id=f"POINT-{uuid.uuid4().hex[:12].upper()}" if payload.tipo_pago == "mercado_pago" else None,
        mp_status="approved" if payload.tipo_pago == "mercado_pago" else None,
    )
    db.add(instruccion)
    await db.flush()

    # Generar folio único
    folio = f"EST-{datetime.utcnow().strftime('%Y%m%d')}-{payer.id_payer:04d}"

    # Crear comprobante
    comprobante = Comprobante(
        id_payer=payload.id_payer,
        id_pedido=payer.id_pedido,
        folio=folio,
        subtotal=payer.pedido.subtotal,
        descuento=payer.pedido.descuento,
        total=payer.total_pedido,
        adelanto_aplicado=payer.monto_adelanto_pagado,
        saldo_cobrado=monto_a_cobrar,
        metodo_pago_saldo=payload.tipo_pago,
        generado_por=payload.procesado_por,
        cliente_nombre=f"{payer.buyer.nombre} {payer.buyer.apellido or ''}".strip() if payer.buyer else None,
        cliente_telefono=payer.buyer.telefono if payer.buyer else None,
    )
    db.add(comprobante)

    # Actualizar estados en cascada
    payer.estado = "saldo_pagado"
    payer.fecha_pago_saldo = datetime.utcnow()

    if payer.pedido:
        payer.pedido.estado = "completado"

    # Actualizar buyer etapa → customer
    buyer_r = await db.execute(select(Buyer).where(Buyer.id_buyer == payer.id_buyer))
    buyer = buyer_r.scalar_one_or_none()
    if buyer:
        buyer.etapa_impulse = "customer"

    # Lead → customer
    lead_r = await db.execute(select(Lead).where(Lead.id_lead == payer.id_lead))
    lead = lead_r.scalar_one_or_none()
    if lead:
        lead.estado = "ganado"

    await db.flush()

    return CobrarSaldoResponse(
        id_instruccion=instruccion.id_instruccion,
        id_comprobante=comprobante.id_comprobante,
        folio=folio,
        total_cobrado=monto_a_cobrar,
        estado="procesado",
        mensaje=f"✅ Saldo cobrado exitosamente. Folio: {folio}",
    )


@caja_router.get("/comprobante/{id_payer}", response_model=ComprobanteRead)
async def get_comprobante(id_payer: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(Comprobante)
        .options(selectinload(Comprobante.pedido))
        .where(Comprobante.id_payer == id_payer)
        .order_by(Comprobante.created_at.desc())
        .limit(1)
    )
    comp = r.scalar_one_or_none()
    if not comp:
        raise HTTPException(404, "Comprobante no encontrado")
    return comp


# ── Combinar sub-routers ──────────────────────────────────────
router.include_router(mesas_router)
router.include_router(payers_router)
router.include_router(caja_router)
