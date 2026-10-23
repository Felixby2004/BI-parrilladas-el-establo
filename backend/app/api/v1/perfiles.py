"""
ROUTER: Perfiles del Lead (Gustos y Reserva)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.leads_models import PerfilGustos, PerfilReserva, NegociacionLead
from app.models.buyers_models import Lead
from app.schemas.leads_schemas import (
    PerfilGustosCreate, PerfilGustosUpdate, PerfilGustosRead,
    PerfilReservaCreate, PerfilReservaUpdate, PerfilReservaRead,
    NegociacionCreate, NegociacionRead,
    Perfil360Read, PedidoRead, PagoRead,
)
from app.models.leads_models import Pedido, Pago
from app.models.base_models import Buyer

router = APIRouter(prefix="/perfiles", tags=["👤 Perfiles Lead"])


# ─── Helper: verificar lead existe ───────────────────────────
async def _get_lead_or_404(id_lead: int, db: AsyncSession) -> Lead:
    r = await db.execute(
        select(Lead).options(selectinload(Lead.buyer)).where(Lead.id_lead == id_lead)
    )
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, f"Lead {id_lead} no encontrado")
    return lead


# ═══════════════════════════════════════════════════════════
# PERFIL 360 — Vista completa
# ═══════════════════════════════════════════════════════════
@router.get(
    "/{id_lead}/360",
    response_model=Perfil360Read,
    summary="Perfil 360 del Lead",
)
async def perfil_360(id_lead: int, db: AsyncSession = Depends(get_db)):
    lead = await _get_lead_or_404(id_lead, db)

    # Buyer
    buyer_r = await db.execute(
        select(Buyer).where(Buyer.id_buyer == lead.id_buyer)
    )
    buyer = buyer_r.scalar_one_or_none()

    # Perfil gustos
    pg_r = await db.execute(
        select(PerfilGustos).where(PerfilGustos.id_lead == id_lead)
    )
    perfil_gustos = pg_r.scalar_one_or_none()

    # Perfil reserva
    pr_r = await db.execute(
        select(PerfilReserva).where(PerfilReserva.id_lead == id_lead)
    )
    perfil_reserva = pr_r.scalar_one_or_none()

    # Pedido activo (más reciente, no cancelado)
    ped_r = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .where(Pedido.id_lead == id_lead)
        .where(Pedido.estado != "cancelado")
        .order_by(Pedido.created_at.desc())
        .limit(1)
    )
    pedido = ped_r.scalar_one_or_none()

    # Pago de adelanto
    pago = None
    if pedido:
        pago_r = await db.execute(
            select(Pago)
            .where(Pago.id_pedido == pedido.id_pedido)
            .where(Pago.tipo_pago == "adelanto")
            .order_by(Pago.created_at.desc())
            .limit(1)
        )
        pago = pago_r.scalar_one_or_none()

    # Mensajes (últimos 20)
    msg_r = await db.execute(
        select(NegociacionLead)
        .where(NegociacionLead.id_lead == id_lead)
        .order_by(NegociacionLead.created_at.desc(), NegociacionLead.id_negociacion.desc())
        .limit(20)
    )
    mensajes = list(reversed(msg_r.scalars().all()))

    return Perfil360Read(
        id_lead=id_lead,
        estado_lead=lead.estado,
        buyer_nombre=f"{buyer.nombre} {buyer.apellido or ''}".strip() if buyer else None,
        buyer_telefono=buyer.telefono if buyer else None,
        buyer_email=buyer.email if buyer else None,
        buyer_canal=buyer.canal_captacion if buyer else None,
        buyer_etapa=buyer.etapa_impulse if buyer else None,
        perfil_gustos=PerfilGustosRead.model_validate(perfil_gustos) if perfil_gustos else None,
        perfil_reserva=PerfilReservaRead.model_validate(perfil_reserva) if perfil_reserva else None,
        pedido_activo=PedidoRead.model_validate(pedido) if pedido else None,
        pago_adelanto=PagoRead.model_validate(pago) if pago else None,
        mensajes_recientes=[NegociacionRead.model_validate(m) for m in mensajes],
    )


# ═══════════════════════════════════════════════════════════
# PERFIL_GUSTOS
# ═══════════════════════════════════════════════════════════
@router.post(
    "/gustos",
    response_model=PerfilGustosRead,
    status_code=201,
    summary="Crear o actualizar perfil de gustos",
)
async def upsert_perfil_gustos(
    payload: PerfilGustosCreate, db: AsyncSession = Depends(get_db)
):
    await _get_lead_or_404(payload.id_lead, db)

    # Upsert: si ya existe, actualizar
    r = await db.execute(
        select(PerfilGustos).where(PerfilGustos.id_lead == payload.id_lead)
    )
    perfil = r.scalar_one_or_none()

    if perfil:
        for k, v in payload.model_dump(exclude={"id_lead"}).items():
            setattr(perfil, k, v)
    else:
        perfil = PerfilGustos(**payload.model_dump())
        db.add(perfil)

    await db.flush()
    # onupdate=func.now() expira esta columna; serializarla sin refresh causa MissingGreenlet.
    await db.refresh(perfil, attribute_names=["updated_at"])
    return perfil


@router.get(
    "/gustos/{id_lead}",
    response_model=PerfilGustosRead,
    summary="Obtener perfil de gustos",
)
async def get_perfil_gustos(id_lead: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(PerfilGustos).where(PerfilGustos.id_lead == id_lead)
    )
    perfil = r.scalar_one_or_none()
    if not perfil:
        raise HTTPException(404, "Perfil de gustos no encontrado")
    return perfil


# ═══════════════════════════════════════════════════════════
# PERFIL_RESERVA
# ═══════════════════════════════════════════════════════════
@router.post(
    "/reserva",
    response_model=PerfilReservaRead,
    status_code=201,
    summary="Crear o actualizar perfil de reserva",
)
async def upsert_perfil_reserva(
    payload: PerfilReservaCreate, db: AsyncSession = Depends(get_db)
):
    await _get_lead_or_404(payload.id_lead, db)

    r = await db.execute(
        select(PerfilReserva).where(PerfilReserva.id_lead == payload.id_lead)
    )
    perfil = r.scalar_one_or_none()

    if perfil:
        for k, v in payload.model_dump(exclude={"id_lead"}).items():
            setattr(perfil, k, v)
    else:
        perfil = PerfilReserva(**payload.model_dump())
        db.add(perfil)

    await db.flush()
    # onupdate=func.now() expira esta columna; serializarla sin refresh causa MissingGreenlet.
    await db.refresh(perfil, attribute_names=["updated_at"])
    return perfil


@router.get(
    "/reserva/{id_lead}",
    response_model=PerfilReservaRead,
    summary="Obtener perfil de reserva",
)
async def get_perfil_reserva(id_lead: int, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(PerfilReserva).where(PerfilReserva.id_lead == id_lead)
    )
    perfil = r.scalar_one_or_none()
    if not perfil:
        raise HTTPException(404, "Perfil de reserva no encontrado")
    return perfil


# ═══════════════════════════════════════════════════════════
# NEGOCIACION / CHAT
# ═══════════════════════════════════════════════════════════
@router.post(
    "/chat",
    response_model=NegociacionRead,
    status_code=201,
    summary="Enviar mensaje al chat de negociación",
)
async def enviar_mensaje(
    payload: NegociacionCreate, db: AsyncSession = Depends(get_db)
):
    await _get_lead_or_404(payload.id_lead, db)
    msg = NegociacionLead(**payload.model_dump())
    db.add(msg)
    await db.flush()
    return msg


@router.get(
    "/chat/{id_lead}",
    response_model=list[NegociacionRead],
    summary="Historial de mensajes del chat",
)
async def historial_chat(
    id_lead: int,
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(NegociacionLead)
        .where(NegociacionLead.id_lead == id_lead)
        .order_by(NegociacionLead.created_at.desc(), NegociacionLead.id_negociacion.desc())
        .limit(limit)
    )
    return list(reversed(r.scalars().all()))
