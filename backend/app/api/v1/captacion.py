"""
ROUTER: Formulario de Captación Público
Endpoint sin autenticación para recibir leads desde la landing page.
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.base_models import Buyer
from app.models.buyers_models import FormularioCaptacion, Lead
from app.schemas.buyers_schemas import (
    FormularioCaptacionCreate,
    FormularioCaptacionResponse,
    FormularioCaptacionRead,
)

router = APIRouter(prefix="/captacion", tags=["📋 Captación Pública"])


@router.post(
    "/formulario",
    response_model=FormularioCaptacionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar formulario público",
    description="Recibe datos del formulario público, crea un Buyer y un Lead en estado 'nuevo'.",
)
async def registrar_formulario(
    payload: FormularioCaptacionCreate,
    db: AsyncSession = Depends(get_db),
):
    # 1. Buscar si ya existe un buyer con ese teléfono o email
    buyer = None
    if payload.telefono:
        result = await db.execute(
            select(Buyer).where(Buyer.telefono == payload.telefono).limit(2)
        )
        matches = result.scalars().all()
        if len(matches) > 1:
            raise HTTPException(409, "Hay varios buyers con ese teléfono; requiere revisión")
        buyer = matches[0] if matches else None

    if buyer is None and payload.email:
        result = await db.execute(
            select(Buyer).where(Buyer.email == payload.email).limit(2)
        )
        matches = result.scalars().all()
        if len(matches) > 1:
            raise HTTPException(409, "Hay varios buyers con ese email; requiere revisión")
        buyer = matches[0] if matches else None

    # 2. Crear buyer si no existe
    if buyer is None:
        nombre_parts = payload.nombre.strip().split(" ", 1)
        buyer = Buyer(
            nombre=nombre_parts[0],
            apellido=nombre_parts[1] if len(nombre_parts) > 1 else None,
            telefono=payload.telefono,
            email=payload.email,
            canal_captacion=payload.canal or "web",
            utm_source=payload.utm_source,
            utm_medium=payload.utm_medium,
            utm_campaign=payload.utm_campaign,
            etapa_impulse="buyer",
            fecha_primer_contacto=datetime.utcnow().date(),
        )
        db.add(buyer)
        await db.flush()  # Obtener id_buyer sin commit

    # 3. Registrar el formulario
    formulario = FormularioCaptacion(
        id_buyer=buyer.id_buyer,
        nombre=payload.nombre,
        telefono=payload.telefono,
        email=payload.email,
        interes=payload.interes,
        mensaje=payload.mensaje,
        personas_aproximadas=payload.personas_aproximadas,
        fecha_preferida=payload.fecha_preferida,
        canal=payload.canal or "web",
        utm_source=payload.utm_source,
        utm_medium=payload.utm_medium,
        utm_campaign=payload.utm_campaign,
    )
    db.add(formulario)
    await db.flush()

    # 4. Crear el Lead en estado "nuevo"
    lead = Lead(
        id_buyer=buyer.id_buyer,
        id_formulario=formulario.id_formulario,
        estado="nuevo",
        interes_confirmado="consulta" if payload.interes == "informacion" else payload.interes,
        personas_estimadas=payload.personas_aproximadas,
        fecha_preferida=payload.fecha_preferida,
    )
    db.add(lead)
    await db.flush()

    # 5. Actualizar etapa del buyer
    if buyer.etapa_impulse not in ("payer", "customer", "turned"):
        buyer.etapa_impulse = "lead"
    formulario.procesado = True

    return FormularioCaptacionResponse(
        id_formulario=formulario.id_formulario,
        id_buyer=buyer.id_buyer,
        id_lead=lead.id_lead,
        mensaje="¡Gracias! Nos pondremos en contacto contigo muy pronto. 🔥",
    )


@router.get(
    "/formularios",
    response_model=list[FormularioCaptacionRead],
    summary="Listar formularios recibidos",
)
async def listar_formularios(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FormularioCaptacion)
        .order_by(FormularioCaptacion.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()
