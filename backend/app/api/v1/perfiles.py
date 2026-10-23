"""
ROUTER: Perfiles del Lead (Gustos, Reserva y Chat)
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.base_models import Buyer, Personal
from app.models.buyers_models import Lead
from app.models.leads_models import (
    MensajeChat,
    NegociacionLead,
    Pago,
    Pedido,
    PerfilGustos,
    PerfilReserva,
    SesionChat,
)
from app.schemas.leads_schemas import (
    NegociacionCreate,
    NegociacionRead,
    PagoRead,
    PedidoRead,
    Perfil360Read,
    PerfilGustosCreate,
    PerfilGustosRead,
    PerfilGustosUpdate,
    PerfilReservaCreate,
    PerfilReservaRead,
    PerfilReservaUpdate,
)

router = APIRouter(prefix="/perfiles", tags=["👤 Perfiles Lead"])

REMITENTE_CANONICO = {"cliente": "CLIENTE", "agente": "PERSONAL", "bot": "BOT"}


async def _get_lead_or_404(id_lead: UUID, db: AsyncSession) -> Lead:
    r = await db.execute(
        select(Lead).options(selectinload(Lead.buyer)).where(Lead.id_lead == id_lead)
    )
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, f"Lead {id_lead} no encontrado")
    return lead


def _mensaje_to_read(mensaje: MensajeChat, id_lead: UUID) -> NegociacionRead:
    return NegociacionRead(
        id_negociacion=mensaje.id_negociacion,
        id_lead=id_lead,
        remitente=mensaje.remitente,
        mensaje=mensaje.mensaje,
        tipo_mensaje=mensaje.tipo_mensaje or "texto",
        leido=mensaje.leido,
        created_at=mensaje.created_at,
    )


async def _sesion_del_lead(lead: Lead, db: AsyncSession) -> SesionChat:
    r = await db.execute(
        select(SesionChat)
        .where(SesionChat.id_lead == lead.id_lead)
        .order_by(SesionChat.fecha_inicio.desc())
        .limit(1)
    )
    sesion = r.scalar_one_or_none()
    if sesion is None:
        sesion = SesionChat(
            id_buyer=lead.id_buyer,
            id_lead=lead.id_lead,
            numero_whatsapp_cliente=lead.buyer.telefono if lead.buyer and lead.buyer.telefono else "sin-telefono",
        )
        db.add(sesion)
        await db.flush()
    return sesion


# ─────────────────────────────────────────────────────────────
# PERFIL 360
# ─────────────────────────────────────────────────────────────
@router.get(
    "/{id_lead}/360",
    response_model=Perfil360Read,
    summary="Perfil 360 del Lead",
)
async def perfil_360(id_lead: UUID, db: AsyncSession = Depends(get_db)):
    lead = await _get_lead_or_404(id_lead, db)

    buyer_r = await db.execute(select(Buyer).where(Buyer.id_buyer == lead.id_buyer))
    buyer = buyer_r.scalar_one_or_none()

    pg_r = await db.execute(select(PerfilGustos).where(PerfilGustos.id_lead == id_lead))
    perfil_gustos = pg_r.scalar_one_or_none()

    pr_r = await db.execute(select(PerfilReserva).where(PerfilReserva.id_lead == id_lead))
    perfil_reserva = pr_r.scalar_one_or_none()

    ped_r = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .where(Pedido.id_lead == id_lead)
        .where(Pedido.estado != "cancelado")
        .order_by(Pedido.created_at.desc())
        .limit(1)
    )
    pedido = ped_r.scalar_one_or_none()

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

    msg_r = await db.execute(
        select(MensajeChat)
        .join(SesionChat, SesionChat.id_sesion == MensajeChat.id_sesion)
        .where(SesionChat.id_lead == id_lead)
        .order_by(MensajeChat.id_negociacion.desc())
        .limit(20)
    )
    mensajes = list(reversed(msg_r.scalars().all()))

    return Perfil360Read(
        id_lead=id_lead,
        estado_lead=lead.estado,
        buyer_nombre=lead.buyer.nombre if lead.buyer else None,
        buyer_telefono=lead.buyer.telefono if lead.buyer else None,
        buyer_email=lead.buyer.email if lead.buyer else None,
        buyer_canal=lead.buyer.canal_captacion if lead.buyer else None,
        buyer_etapa=lead.buyer.etapa_impulse if lead.buyer else None,
        perfil_gustos=PerfilGustosRead.model_validate(perfil_gustos) if perfil_gustos else None,
        perfil_reserva=PerfilReservaRead.model_validate(perfil_reserva) if perfil_reserva else None,
        pedido_activo=PedidoRead.model_validate(pedido, from_attributes=True) if pedido else None,
        pago_adelanto=PagoRead.model_validate(pago, from_attributes=True) if pago else None,
        mensajes_recientes=[_mensaje_to_read(m, id_lead) for m in mensajes],
    )


# ─────────────────────────────────────────────────────────────
# PERFIL_GUSTOS
# ─────────────────────────────────────────────────────────────
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

    r = await db.execute(select(PerfilGustos).where(PerfilGustos.id_lead == payload.id_lead))
    perfil = r.scalar_one_or_none()

    if perfil:
        for k, v in payload.model_dump(exclude={"id_lead"}).items():
            setattr(perfil, k, v)
    else:
        perfil = PerfilGustos(**payload.model_dump())
        db.add(perfil)

    await db.flush()
    await db.refresh(perfil, attribute_names=["updated_at"])
    return perfil


@router.get(
    "/gustos/{id_lead}",
    response_model=PerfilGustosRead,
    summary="Obtener perfil de gustos",
)
async def get_perfil_gustos(id_lead: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(PerfilGustos).where(PerfilGustos.id_lead == id_lead))
    perfil = r.scalar_one_or_none()
    if not perfil:
        raise HTTPException(404, "Perfil de gustos no encontrado")
    return perfil


# ─────────────────────────────────────────────────────────────
# PERFIL_RESERVA
# ─────────────────────────────────────────────────────────────
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

    r = await db.execute(select(PerfilReserva).where(PerfilReserva.id_lead == payload.id_lead))
    perfil = r.scalar_one_or_none()

    if perfil:
        for k, v in payload.model_dump(exclude={"id_lead"}).items():
            setattr(perfil, k, v)
    else:
        perfil = PerfilReserva(**payload.model_dump())
        db.add(perfil)

    await db.flush()
    await db.refresh(perfil, attribute_names=["updated_at"])
    return perfil


@router.get(
    "/reserva/{id_lead}",
    response_model=PerfilReservaRead,
    summary="Obtener perfil de reserva",
)
async def get_perfil_reserva(id_lead: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(PerfilReserva).where(PerfilReserva.id_lead == id_lead))
    perfil = r.scalar_one_or_none()
    if not perfil:
        raise HTTPException(404, "Perfil de reserva no encontrado")
    return perfil


# ─────────────────────────────────────────────────────────────
# CHAT (log en mensajes_chat; negociacion_leads queda para el BI)
# ─────────────────────────────────────────────────────────────
@router.post(
    "/chat",
    response_model=NegociacionRead,
    status_code=201,
    summary="Enviar mensaje al chat de negociación",
)
async def enviar_mensaje(
    payload: NegociacionCreate, db: AsyncSession = Depends(get_db)
):
    lead = await _get_lead_or_404(payload.id_lead, db)
    sesion = await _sesion_del_lead(lead, db)

    remitente = payload.remitente or "bot"
    id_personal = None
    if remitente == "agente":
        r = await db.execute(
            select(Personal).where(Personal.cargo == "AGENTE", Personal.estado_activo.is_(True)).limit(1)
        )
        agente = r.scalar_one_or_none()
        id_personal = agente.id_personal if agente else None

    msg = MensajeChat(
        id_sesion=sesion.id_sesion,
        id_personal=id_personal,
        remitente=remitente,
        remitente_canonico=REMITENTE_CANONICO.get(remitente, "BOT"),
        tipo_mensaje=payload.tipo_mensaje or "texto",
        mensaje=payload.mensaje,
        metadata_json=payload.metadata_json,
    )
    db.add(msg)
    await db.flush()
    return _mensaje_to_read(msg, lead.id_lead)


@router.get(
    "/chat/{id_lead}",
    response_model=list[NegociacionRead],
    summary="Historial de mensajes del chat",
)
async def historial_chat(
    id_lead: UUID,
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(MensajeChat)
        .join(SesionChat, SesionChat.id_sesion == MensajeChat.id_sesion)
        .where(SesionChat.id_lead == id_lead)
        .order_by(MensajeChat.id_negociacion.desc())
        .limit(limit)
    )
    return [_mensaje_to_read(m, id_lead) for m in reversed(r.scalars().all())]
