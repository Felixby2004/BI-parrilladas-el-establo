"""
ROUTER: CUSTOMERS — Salón, Cocina, Alertas y Reseñas
"""
from datetime import datetime
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.customers_models import Servicio, ServicioDetalle, AlertaConsumo, ResenaServicio
from app.models.payers_models import Mesa, Payer
from app.models.leads_models import DetallePedido
from app.schemas.customers_schemas import (
    ServicioCreate, ServicioUpdate, ServicioRead,
    ServicioDetalleRead, ActualizarItemEstado,
    AlertaCreate, AlertaRead,
    ResenaCreate, ResenaRead,
    ComandaCocinaRead, EstadoServicio,
)

router = APIRouter(tags=["🍽️ CUSTOMERS — Salón"])

servicios_router = APIRouter(prefix="/servicios")
alertas_router   = APIRouter(prefix="/alertas")
resenas_router   = APIRouter(prefix="/resenas")

ESTADO_SERVICIO_CANONICO = {
    "en_espera": "EN_PREPARACION",
    "preparando": "EN_PREPARACION",
    "servido": "SERVIDO",
    "finalizado": "FINALIZADO",
    "cancelado": "CON_INCIDENCIA",
}
ESTADO_ITEM_CANONICO = {
    "pendiente": "PENDIENTE",
    "preparando": "EN_COCINA",
    "listo": "EN_COCINA",
    "entregado": "SERVIDO",
    "cancelado": "DEVUELTO",
}
TIPO_ALERTA_CANONICO = {
    "tiempo_espera": "RECORDATORIO_CUENTA",
    "demora_cocina": "RECORDATORIO_CUENTA",
    "pedido_adicional": "SUGERENCIA_BEBIDA",
    "vip_mesa": "SUGERENCIA_POSTRE",
    "incidencia": "SUGERENCIA_POSTRE",
}



# ═══════════════════════════════════════════════════════════
# SERVICIOS / COMANDAS
# ═══════════════════════════════════════════════════════════
@servicios_router.post("", response_model=ServicioRead, status_code=201, summary="Enviar comanda a cocina")
async def crear_servicio(payload: ServicioCreate, db: AsyncSession = Depends(get_db)):
    payer_r = await db.execute(select(Payer).where(Payer.id_payer == payload.id_payer))
    payer = payer_r.scalar_one_or_none()
    if payer is None:
        raise HTTPException(404, "Payer no encontrado")
    if payload.id_mesa is not None:
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa, Mesa.activa == True))
        if mesa_r.scalar_one_or_none() is None:
            raise HTTPException(404, "Mesa no encontrada o inactiva")
    ids = {d.id_detalle_pedido for d in payload.detalles if d.id_detalle_pedido is not None}
    if ids:
        detalles_r = await db.execute(select(DetallePedido.id_detalle).where(
            DetallePedido.id_detalle.in_(ids), DetallePedido.id_pedido == payer.id_pedido))
        if ids - set(detalles_r.scalars().all()):
            raise HTTPException(422, "Los detalles no corresponden al pedido del payer")
    servicio = Servicio(
        id_payer=payload.id_payer,
        id_lead=payer.id_lead,
        id_mesa=payload.id_mesa,
        prioridad=payload.prioridad,
        notas_cocina=payload.notas_cocina,
        hora_inicio=datetime.utcnow(),
        estado="en_espera",
        estado_servicio="EN_PREPARACION",
        tipo_servicio="SALON",
    )
    db.add(servicio); await db.flush()

    for det in payload.detalles:
        item = ServicioDetalle(
            id_servicio=servicio.id_servicio,
            **det.model_dump(),
            estado_item="pendiente",
            estado_item_canonico="PENDIENTE",
        )
        db.add(item)

    # Actualizar estado de la mesa
    if payload.id_mesa:
        mesa_r = await db.execute(select(Mesa).where(Mesa.id_mesa == payload.id_mesa))
        mesa = mesa_r.scalar_one_or_none()
        if mesa:
            mesa.estado = "OCUPADA"

    await db.flush()

    result = await db.execute(
        select(Servicio)
        .options(selectinload(Servicio.detalles), selectinload(Servicio.mesa))
        .where(Servicio.id_servicio == servicio.id_servicio)
    )
    s = result.scalar_one()
    sr = ServicioRead.model_validate(s)
    sr.mesa_numero = s.mesa.numero if s.mesa else None
    return sr


@servicios_router.get("", response_model=list[ServicioRead], summary="Listar servicios activos")
async def listar_servicios(
    estado: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Servicio)
        .options(selectinload(Servicio.detalles), selectinload(Servicio.mesa))
        .order_by(Servicio.created_at.asc())
    )
    if estado:
        q = q.where(Servicio.estado == estado)
    else:
        q = q.where(Servicio.estado.not_in(["finalizado", "cancelado"]))

    result = await db.execute(q)
    servicios = result.scalars().all()

    out = []
    for s in servicios:
        sr = ServicioRead.model_validate(s)
        sr.mesa_numero = s.mesa.numero if s.mesa else None
        out.append(sr)
    return out


@servicios_router.get("/cocina", response_model=list[ComandaCocinaRead], summary="Vista de cocina")
async def vista_cocina(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Servicio)
        .options(selectinload(Servicio.detalles), selectinload(Servicio.mesa))
        .where(Servicio.estado.in_(["en_espera", "preparando"]))
        .order_by(Servicio.prioridad.desc(), Servicio.created_at.asc())
    )
    servicios = result.scalars().all()

    out = []
    for s in servicios:
        tiempo = None
        if s.hora_inicio:
            diff = datetime.utcnow() - s.hora_inicio.replace(tzinfo=None)
            tiempo = int(diff.total_seconds() / 60)

        detalles = [ServicioDetalleRead.model_validate(d) for d in s.detalles]
        out.append(ComandaCocinaRead(
            id_servicio=s.id_servicio,
            mesa_numero=s.mesa.numero if s.mesa else None,
            prioridad=s.prioridad,
            estado=s.estado,
            tiempo_espera_min=tiempo,
            items=detalles,
            created_at=s.created_at,
        ))
    return out


@servicios_router.patch("/{id_servicio}/estado", response_model=ServicioRead, summary="Actualizar estado comanda")
async def actualizar_estado_servicio(
    id_servicio: UUID, estado: EstadoServicio, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Servicio)
        .options(selectinload(Servicio.detalles), selectinload(Servicio.mesa))
        .where(Servicio.id_servicio == id_servicio)
    )
    servicio = result.scalar_one_or_none()
    if not servicio:
        raise HTTPException(404, "Servicio no encontrado")

    servicio.estado = str(estado)
    servicio.estado_servicio = ESTADO_SERVICIO_CANONICO.get(str(estado), "EN_PREPARACION")
    if estado == "finalizado":
        servicio.hora_fin = datetime.utcnow()
        if servicio.id_mesa and servicio.mesa:
            servicio.mesa.estado = "DISPONIBLE"

    sr = ServicioRead.model_validate(servicio)
    sr.mesa_numero = servicio.mesa.numero if servicio.mesa else None
    return sr


@servicios_router.patch("/{id_servicio}/items/{id_item}", response_model=ServicioDetalleRead, summary="Actualizar estado de ítem")
async def actualizar_item(
    id_servicio: UUID,
    id_item: UUID,
    payload: ActualizarItemEstado,
    db: AsyncSession = Depends(get_db),
):
    r = await db.execute(
        select(ServicioDetalle)
        .where(ServicioDetalle.id_servicio == id_servicio)
        .where(ServicioDetalle.id_servicio_detalle == id_item)
    )
    item = r.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Ítem no encontrado")

    item.estado_item = payload.estado_item
    item.estado_item_canonico = ESTADO_ITEM_CANONICO.get(payload.estado_item, "PENDIENTE")

    # Si todos los items están listos, poner servicio en "servido"
    if payload.estado_item == "listo":
        todos_r = await db.execute(
            select(ServicioDetalle).where(ServicioDetalle.id_servicio == id_servicio)
        )
        todos = todos_r.scalars().all()
        if all(d.estado_item in ("listo", "entregado", "cancelado") for d in todos):
            serv_r = await db.execute(select(Servicio).where(Servicio.id_servicio == id_servicio))
            serv = serv_r.scalar_one_or_none()
            if serv and serv.estado == "preparando":
                serv.estado = "servido"
                serv.estado_servicio = "SERVIDO"

    await db.flush()
    await db.refresh(item, attribute_names=["updated_at"])
    return item


# ═══════════════════════════════════════════════════════════
# ALERTAS
# ═══════════════════════════════════════════════════════════
@alertas_router.get("", response_model=list[AlertaRead], summary="Alertas activas")
async def listar_alertas(db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(AlertaConsumo)
        .where(AlertaConsumo.atendida == False)
        .order_by(AlertaConsumo.created_at.desc())
    )
    return r.scalars().all()


@alertas_router.post("", response_model=AlertaRead, status_code=201)
async def crear_alerta(payload: AlertaCreate, db: AsyncSession = Depends(get_db)):
    servicio_r = await db.execute(select(Servicio.id_servicio).where(Servicio.id_servicio == payload.id_servicio))
    if servicio_r.scalar_one_or_none() is None:
        raise HTTPException(404, "Servicio no encontrado")
    datos = payload.model_dump()
    datos["tipo_alerta_canonico"] = TIPO_ALERTA_CANONICO.get(datos.get("tipo_alerta", ""), "RECORDATORIO_CUENTA")
    alerta = AlertaConsumo(**datos)
    db.add(alerta); await db.flush()
    return alerta


@alertas_router.patch("/{id_alerta}/atender", response_model=AlertaRead)
async def atender_alerta(id_alerta: UUID, atendida_por: str = "Personal", db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(AlertaConsumo).where(AlertaConsumo.id_alerta == id_alerta))
    alerta = r.scalar_one_or_none()
    if not alerta:
        raise HTTPException(404, "Alerta no encontrada")
    alerta.atendida = True
    alerta.atendida_por = atendida_por
    return alerta


# ═══════════════════════════════════════════════════════════
# RESEÑAS
# ═══════════════════════════════════════════════════════════
@resenas_router.post("", response_model=ResenaRead, status_code=201, summary="Enviar reseña de 5 estrellas")
async def crear_resena(payload: ResenaCreate, db: AsyncSession = Depends(get_db)):
    servicio_r = await db.execute(select(Servicio).where(Servicio.id_servicio == payload.id_servicio))
    servicio = servicio_r.scalar_one_or_none()
    if servicio is None:
        raise HTTPException(404, "Servicio no encontrado")
    if payload.id_buyer is not None:
        payer_r = await db.execute(select(Payer.id_buyer).where(Payer.id_payer == servicio.id_payer))
        if payer_r.scalar_one_or_none() != payload.id_buyer:
            raise HTTPException(422, "El buyer no corresponde al servicio")
    resena = ResenaServicio(**payload.model_dump(), id_lead=servicio.id_lead)
    db.add(resena); await db.flush()
    return resena


@resenas_router.get("", response_model=list[ResenaRead], summary="Listar reseñas")
async def listar_resenas(db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(ResenaServicio)
        .where(ResenaServicio.publicar == True)
        .order_by(ResenaServicio.created_at.desc())
        .limit(50)
    )
    return r.scalars().all()


# Combinar sub-routers
router.include_router(servicios_router)
router.include_router(alertas_router)
router.include_router(resenas_router)
