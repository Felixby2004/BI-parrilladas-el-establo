"""
ROUTER: Campañas y Anuncios — CRUD completo
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.buyers_models import Campana, Anuncio
from app.schemas.buyers_schemas import (
    CampanaCreate, CampanaUpdate, CampanaRead,
    AnuncioCreate, AnuncioUpdate, AnuncioRead,
)

router = APIRouter(tags=["📣 Campañas y Anuncios"])


# ═══════════════════════════════════════════════════════
# CAMPAÑAS
# ═══════════════════════════════════════════════════════
campanas_router = APIRouter(prefix="/campanas")


@campanas_router.get("", response_model=list[CampanaRead], summary="Listar campañas")
async def listar_campanas(
    skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Campana)
        .options(selectinload(Campana.buyer_persona))
        .order_by(Campana.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@campanas_router.post("", response_model=CampanaRead, status_code=201, summary="Crear campaña")
async def crear_campana(payload: CampanaCreate, db: AsyncSession = Depends(get_db)):
    campana = Campana(**payload.model_dump())
    db.add(campana)
    await db.flush()
    result = await db.execute(
        select(Campana).options(selectinload(Campana.buyer_persona)).where(
            Campana.id_campana == campana.id_campana
        )
    )
    return result.scalar_one()


@campanas_router.get("/{id_campana}", response_model=CampanaRead, summary="Detalle campaña")
async def detalle_campana(id_campana: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campana)
        .options(selectinload(Campana.buyer_persona), selectinload(Campana.anuncios))
        .where(Campana.id_campana == id_campana)
    )
    campana = result.scalar_one_or_none()
    if not campana:
        raise HTTPException(404, "Campaña no encontrada")
    return campana


@campanas_router.put("/{id_campana}", response_model=CampanaRead, summary="Actualizar campaña")
async def actualizar_campana(
    id_campana: int, payload: CampanaUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Campana).where(Campana.id_campana == id_campana))
    campana = result.scalar_one_or_none()
    if not campana:
        raise HTTPException(404, "Campaña no encontrada")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(campana, key, value)
    return campana


@campanas_router.delete("/{id_campana}", status_code=204, summary="Eliminar campaña")
async def eliminar_campana(id_campana: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campana).where(Campana.id_campana == id_campana))
    campana = result.scalar_one_or_none()
    if not campana:
        raise HTTPException(404, "Campaña no encontrada")
    await db.delete(campana)


# ═══════════════════════════════════════════════════════
# ANUNCIOS
# ═══════════════════════════════════════════════════════
anuncios_router = APIRouter(prefix="/anuncios")


@anuncios_router.get("", response_model=list[AnuncioRead], summary="Listar anuncios")
async def listar_anuncios(
    id_campana: int | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = select(Anuncio).order_by(Anuncio.created_at.desc()).offset(skip).limit(limit)
    if id_campana:
        q = q.where(Anuncio.id_campana == id_campana)
    result = await db.execute(q)
    return result.scalars().all()


@anuncios_router.post("", response_model=AnuncioRead, status_code=201, summary="Crear anuncio")
async def crear_anuncio(payload: AnuncioCreate, db: AsyncSession = Depends(get_db)):
    # Verificar campaña existe
    r = await db.execute(select(Campana).where(Campana.id_campana == payload.id_campana))
    if not r.scalar_one_or_none():
        raise HTTPException(404, "Campaña no encontrada")
    anuncio = Anuncio(**payload.model_dump())
    db.add(anuncio)
    await db.flush()
    return anuncio


@anuncios_router.put("/{id_anuncio}", response_model=AnuncioRead, summary="Actualizar anuncio")
async def actualizar_anuncio(
    id_anuncio: int, payload: AnuncioUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Anuncio).where(Anuncio.id_anuncio == id_anuncio))
    anuncio = result.scalar_one_or_none()
    if not anuncio:
        raise HTTPException(404, "Anuncio no encontrado")
    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(anuncio, key, value)
    return anuncio


@anuncios_router.delete("/{id_anuncio}", status_code=204, summary="Eliminar anuncio")
async def eliminar_anuncio(id_anuncio: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Anuncio).where(Anuncio.id_anuncio == id_anuncio))
    anuncio = result.scalar_one_or_none()
    if not anuncio:
        raise HTTPException(404, "Anuncio no encontrado")
    await db.delete(anuncio)


# Combinar sub-routers bajo el router principal
router.include_router(campanas_router)
router.include_router(anuncios_router)
