"""
ROUTER: Leads — Kanban de Oportunidades
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.buyers_models import Lead, Campana
from app.models.base_models import Buyer
from app.models.leads_models import Pedido
from app.schemas.buyers_schemas import (
    LeadRead,
    LeadKanbanRead,
    LeadUpdateEstado,
    LeadUpdate,
    KanbanStats,
)

router = APIRouter(prefix="/leads", tags=["🎯 Leads / Kanban"])


# ── Helper para construir LeadKanbanRead ─────────────────────────
def _to_kanban(lead: Lead) -> LeadKanbanRead:
    return LeadKanbanRead(
        id_lead=lead.id_lead,
        estado=lead.estado,
        interes_confirmado=lead.interes_confirmado,
        personas_estimadas=lead.personas_estimadas,
        fecha_preferida=lead.fecha_preferida,
        presupuesto_estimado=lead.presupuesto_estimado,
        notas=lead.notas,
        created_at=lead.created_at,
        buyer_nombre=(
            f"{lead.buyer.nombre} {lead.buyer.apellido or ''}".strip()
            if lead.buyer else None
        ),
        buyer_telefono=lead.buyer.telefono if lead.buyer else None,
        buyer_email=lead.buyer.email if lead.buyer else None,
        campana_nombre=lead.campana.nombre if lead.campana else None,
    )


# ── GET /leads ────────────────────────────────────────────────────
@router.get(
    "",
    response_model=list[LeadKanbanRead],
    summary="Listar leads para el Kanban",
)
async def listar_leads(
    estado: Optional[str] = Query(None, description="Filtrar por estado del Kanban"),
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).options(
        selectinload(Lead.buyer),
        selectinload(Lead.campana),
    ).order_by(Lead.created_at.desc()).offset(skip).limit(limit)

    if estado:
        q = q.where(Lead.estado == estado)

    result = await db.execute(q)
    leads = result.scalars().all()
    return [_to_kanban(l) for l in leads]


# ── GET /leads/stats ──────────────────────────────────────────────
@router.get(
    "/stats",
    response_model=KanbanStats,
    summary="Estadísticas del Kanban",
)
async def stats_leads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lead.estado, func.count(Lead.id_lead)).group_by(Lead.estado)
    )
    rows = result.all()
    data = {row[0]: row[1] for row in rows}
    total = sum(data.values())
    return KanbanStats(
        nuevo=data.get("nuevo", 0),
        contactado=data.get("contactado", 0),
        respondio=data.get("respondio", 0),
        ganado=data.get("ganado", 0),
        perdido=data.get("perdido", 0),
        total=total,
    )


# ── GET /leads/{id} ───────────────────────────────────────────────
@router.get(
    "/{id_lead}",
    response_model=LeadRead,
    summary="Detalle de un lead",
)
async def detalle_lead(id_lead: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Lead)
        .options(selectinload(Lead.buyer), selectinload(Lead.campana).selectinload(Campana.buyer_persona))
        .where(Lead.id_lead == id_lead)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    return lead


# ── PATCH /leads/{id}/estado ──────────────────────────────────────
@router.patch(
    "/{id_lead}/estado",
    response_model=LeadKanbanRead,
    summary="Mover tarjeta en el Kanban",
)
async def actualizar_estado(
    id_lead: int,
    payload: LeadUpdateEstado,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Lead)
        .options(selectinload(Lead.buyer), selectinload(Lead.campana).selectinload(Campana.buyer_persona))
        .where(Lead.id_lead == id_lead)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")

    lead.estado = payload.estado
    if payload.notas is not None:
        lead.notas = payload.notas
    if payload.motivo_perdida is not None:
        lead.motivo_perdida = payload.motivo_perdida

    # Timestamps automáticos por estado
    now = datetime.utcnow()
    if payload.estado == "contactado" and not lead.fecha_contacto:
        lead.fecha_contacto = now
    elif payload.estado == "respondio" and not lead.fecha_respuesta:
        lead.fecha_respuesta = now

    # Actualizar etapa del buyer
    if payload.estado in ("ganado",):
        await db.execute(
            select(Buyer).where(Buyer.id_buyer == lead.id_buyer)
        )

    return _to_kanban(lead)


# ── DELETE /leads/{id} ────────────────────────────────────────────
@router.delete(
    "/{id_lead}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar un lead",
)
async def eliminar_lead(id_lead: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).where(Lead.id_lead == id_lead))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead no encontrado")
    pedidos_r = await db.execute(select(Pedido.id_pedido).where(Pedido.id_lead == id_lead).limit(1))
    if pedidos_r.scalar_one_or_none() is not None:
        raise HTTPException(409, "No se puede eliminar un lead con pedidos")
    await db.delete(lead)
