"""
ROUTER: PAYERS - Caja y cobro del saldo restante
"""
import uuid
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.database import get_db
from app.models.base_models import Buyer
from app.models.buyers_models import Lead
from app.models.leads_models import Pago, Pedido
from app.models.payers_models import Comprobante, InstruccionPago, Mesa, Payer
from app.schemas.payers_schemas import (
    CobrarSaldoRequest,
    CobrarSaldoResponse,
    ComprobanteRead,
    EstadoMesa,
    MesaCreate,
    MesaRead,
    MesaUpdate,
    PayerCreate,
    PayerRead,
    PayerUpdate,
)

router = APIRouter(tags=["💵 PAYERS - Caja"])

mesas_router = APIRouter(prefix="/mesas")
payers_router = APIRouter(prefix="/payers")
caja_router = APIRouter(prefix="/caja")

ESTADO_MESA_CANONICO = {
    "disponible": "DISPONIBLE",
    "ocupada": "OCUPADA",
    "reservada": "RESERVADA",
    "mantenimiento": "MANTENIMIENTO",
}
METODO_CANONICO = {
    "efectivo": "EFECTIVO",
    "tarjeta": "TARJETA",
    "mercado_pago": "MERCADO_PAGO",
    "transferencia": "TRANSFERENCIA",
    "mixto": "OTRO",
}
ESTADO_PEDIDO_CANONICO = {
    "borrador": "PENDIENTE",
    "pendiente": "PENDIENTE",
    "confirmado": "PENDIENTE",
    "pagado_adelanto": "PENDIENTE",
    "completado": "ENTREGADO",
    "cancelado": "CANCELADO",
}


# ─────────────────────────────────────────────────────────────
# MESAS
# ─────────────────────────────────────────────────────────────
@mesas_router.get("", response_model=list[MesaRead])
async def listar_mesas(db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Mesa).where(Mesa.activa.is_(True)).order_by(Mesa.numero))
    return r.scalars().all()


@mesas_router.post("", response_model=MesaRead, status_code=201)
async def crear_mesa(payload: MesaCreate, db: AsyncSession = Depends(get_db)):
    mesa = Mesa(**payload.model_dump())
    mesa.estado = ESTADO_MESA_CANONICO.get((payload.estado or "disponible").lower(), "DISPONIBLE")
    mesa.sector = (payload.sector or "salon").upper()
    db.add(mesa)
    await db.flush()
    return mesa


@mesas_router.patch("/{id_mesa}/estado", response_model=MesaRead)
async def actualizar_estado_mesa(id_mesa: int, estado: EstadoMesa, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Mesa).where(Mesa.id_mesa == id_mesa))
    mesa = r.scalar_one_or_none()
    if not mesa:
        raise HTTPException(404, "Mesa no encontrada")
    mesa.estado = ESTADO_MESA_CANONICO.get(str(estado).lower(), "DISPONIBLE")
    return mesa


# ─────────────────────────────────────────────────────────────
# PAYERS
# ─────────────────────────────────────────────────────────────
@payers_router.get("", response_model=list[PayerRead])
async def listar_payers(estado: str | None = None, db: AsyncSession = Depends(get_db)):
    q = (
        select(Payer)
        .options(selectinload(Payer.mesa), selectinload(Payer.buyer))
        .order_by(Payer.created_at.desc())
    )
    if estado:
        q = q.where(Payer.estado == estado)
    r = await db.execute(q)

    result = []
    for p in r.scalars().all():
        pr = PayerRead.model_validate(p)
        if p.buyer:
            pr.buyer_nombre = p.buyer.nombre
            pr.buyer_telefono = p.buyer.telefono
        if p.mesa:
            pr.mesa_numero = p.mesa.numero
        result.append(pr)
    return result


@payers_router.post("", response_model=PayerRead, status_code=201)
async def crear_payer(payload: PayerCreate, db: AsyncSession = Depends(get_db)):
    """Registra la llegada de un cliente a caja para pagar el saldo."""
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
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa, Mesa.activa.is_(True)))
        if mesa_r.scalar_one_or_none() is None:
            raise HTTPException(404, "Mesa no encontrada o inactiva")

    pagos_r = await db.execute(
        select(Pago).where(Pago.id_pedido == payload.id_pedido, Pago.estado == "aprobado")
    )
    pagos_aprobados = list(pagos_r.scalars().all())
    adelanto = sum((p.monto for p in pagos_aprobados), Decimal("0.00"))
    if adelanto > pedido.total:
        raise HTTPException(409, "Los pagos aprobados superan el total del pedido")

    # El esquema canónico exige que el payer apunte a un pago.
    if pagos_aprobados:
        pago = pagos_aprobados[0]
    else:
        pago = Pago(
            id_pedido=pedido.id_pedido,
            id_lead=pedido.id_lead,
            metodo_pago="EFECTIVO",
            estado_pago="PENDIENTE",
            monto=Decimal("0.00"),
            tipo_pago="adelanto",
            estado="pendiente",
        )
        db.add(pago)
        await db.flush()

    datos = payload.model_dump(exclude={"monto_adelanto_pagado", "monto_saldo", "total_pedido"})
    payer = Payer(
        **datos,
        id_pago=pago.id_pago,
        fecha_llegada=datetime.utcnow(),
        monto_adelanto_pagado=adelanto,
        monto_saldo=pedido.total - adelanto,
        total_pedido=pedido.total,
    )
    db.add(payer)
    await db.flush()
    if adelanto > 0:
        pedido.estado = "pagado_adelanto"
        pedido.estado_pedido = ESTADO_PEDIDO_CANONICO["pagado_adelanto"]

    result = PayerRead.model_validate(payer)
    buyer_r = await db.execute(select(Buyer).where(Buyer.id_buyer == payload.id_buyer))
    buyer = buyer_r.scalar_one_or_none()
    if buyer:
        result.buyer_nombre = buyer.nombre
        result.buyer_telefono = buyer.telefono
    return result


@payers_router.patch("/{id_payer}", response_model=PayerRead)
async def actualizar_payer(id_payer: UUID, payload: PayerUpdate, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(Payer)
        .options(selectinload(Payer.buyer), selectinload(Payer.mesa))
        .where(Payer.id_payer == id_payer)
    )
    payer = r.scalar_one_or_none()
    if not payer:
        raise HTTPException(404, "Payer no encontrado")
    if payload.id_mesa is not None:
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa, Mesa.activa.is_(True)))
        mesa = mesa_r.scalar_one_or_none()
        if mesa is None:
            raise HTTPException(404, "Mesa no encontrada o inactiva")
        payer.mesa = mesa
    if payload.estado is not None and payload.estado != payer.estado:
        if (
            payload.estado == "saldo_pagado"
            or payer.estado == "finalizado"
            or (payer.estado == "saldo_pagado" and payload.estado != "finalizado")
            or (payload.estado == "finalizado" and payer.estado != "saldo_pagado")
        ):
            raise HTTPException(409, "El estado de cobro sólo se modifica desde caja")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(payer, k, v)
    await db.flush()
    await db.refresh(payer, attribute_names=["updated_at"])

    result = PayerRead.model_validate(payer)
    if payer.buyer:
        result.buyer_nombre = payer.buyer.nombre
        result.buyer_telefono = payer.buyer.telefono
    if payer.mesa:
        result.mesa_numero = payer.mesa.numero
    return result


# ─────────────────────────────────────────────────────────────
# CAJA
# ─────────────────────────────────────────────────────────────
@caja_router.post(
    "/cobrar-saldo",
    response_model=CobrarSaldoResponse,
    status_code=201,
    summary="Cobrar el saldo restante y generar comprobante",
)
async def cobrar_saldo(payload: CobrarSaldoRequest, db: AsyncSession = Depends(get_db)):
    if payload.tipo_pago == "mercado_pago" and settings.ENVIRONMENT != "development":
        raise HTTPException(501, "Cobro Mercado Pago Point no implementado fuera de desarrollo")

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

    metodo = METODO_CANONICO.get(payload.tipo_pago, "OTRO")

    # Pago del saldo: el comprobante canónico exige id_pago.
    pago_saldo = Pago(
        id_pedido=payer.id_pedido,
        id_lead=payer.id_lead,
        metodo_pago=metodo,
        estado_pago="PAGADO",
        monto=monto_a_cobrar,
        fecha_pago=datetime.utcnow(),
        tipo_pago="saldo",
        estado="aprobado",
        pagador_nombre=payer.buyer.nombre if payer.buyer else None,
        pagador_email=payer.buyer.email if payer.buyer else None,
    )
    db.add(pago_saldo)
    await db.flush()

    instruccion = InstruccionPago(
        id_pedido=payer.id_pedido,
        id_payer=payload.id_payer,
        canal_pago=metodo,
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

    folio = f"EST-{datetime.utcnow().strftime('%Y%m%d')}-{str(payer.id_payer)[:8].upper()}"

    comprobante = Comprobante(
        id_pago=pago_saldo.id_pago,
        id_payer=payload.id_payer,
        id_pedido=payer.id_pedido,
        folio=folio,
        tipo_comprobante="BOLETA_SIMPLE",
        fecha_emision=datetime.utcnow(),
        emitido=True,
        subtotal=payer.pedido.subtotal if payer.pedido else payer.total_pedido,
        descuento=payer.pedido.descuento if payer.pedido else Decimal("0.00"),
        total=payer.total_pedido,
        adelanto_aplicado=payer.monto_adelanto_pagado,
        saldo_cobrado=monto_a_cobrar,
        metodo_pago_saldo=payload.tipo_pago,
        generado_por=payload.procesado_por,
        cliente_nombre=payer.buyer.nombre if payer.buyer else None,
        cliente_telefono=payer.buyer.telefono if payer.buyer else None,
    )
    db.add(comprobante)

    payer.estado = "saldo_pagado"
    payer.fecha_pago_saldo = datetime.utcnow()

    if payer.pedido:
        payer.pedido.estado = "completado"
        payer.pedido.estado_pedido = "ENTREGADO"

    if payer.buyer:
        payer.buyer.etapa_impulse = "customer"

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
        mensaje=f"Saldo cobrado exitosamente. Folio: {folio}",
    )


@caja_router.get("/comprobante/{id_payer}", response_model=ComprobanteRead)
async def get_comprobante(id_payer: UUID, db: AsyncSession = Depends(get_db)):
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


router.include_router(mesas_router)
router.include_router(payers_router)
router.include_router(caja_router)
