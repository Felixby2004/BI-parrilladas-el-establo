"""
ROUTER: Pagos con Mercado Pago (Sandbox)
==========================================
Flujo:
  1. Frontend llama POST /pagos/adelanto con id_pedido y %
  2. Backend crea Preference en MP y guarda el registro Pago
  3. Devuelve init_point (URL de checkout MP sandbox)
  4. MP llama al webhook POST /pagos/webhook cuando el pago es procesado
  5. El webhook actualiza Pago, Pedido y Buyer.etapa_impulse → "payer"
"""
import logging
import uuid
from uuid import UUID
from decimal import Decimal

import mercadopago
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.db.database import get_db
from app.models.base_models import Buyer
from app.models.buyers_models import Lead
from app.models.leads_models import Pago, Pedido
from app.schemas.leads_schemas import (
    GenerarAdelanto,
    MercadoPagoPreferenceResponse,
    PagoRead,
    WebhookMPPayload,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pagos", tags=["💳 Pagos / Mercado Pago"])


def _get_mp_sdk() -> mercadopago.SDK:
    return mercadopago.SDK(settings.MP_ACCESS_TOKEN)


# ─── POST /pagos/adelanto ─────────────────────────────────────────
@router.post(
    "/adelanto",
    response_model=MercadoPagoPreferenceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generar link de pago del adelanto (10%) vía Mercado Pago",
)
async def generar_adelanto(
    payload: GenerarAdelanto, db: AsyncSession = Depends(get_db)
):
    # 1. Obtener pedido
    ped_r = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles), selectinload(Pedido.lead))
        .where(Pedido.id_pedido == payload.id_pedido)
    )
    pedido = ped_r.scalar_one_or_none()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    if pedido.estado in ("cancelado", "completado", "pagado_adelanto"):
        raise HTTPException(409, "El pedido está cerrado o ya tiene adelanto aprobado")

    # 2. Calcular monto del adelanto
    monto_adelanto = (pedido.total * payload.porcentaje / Decimal("100")).quantize(
        Decimal("0.01")
    )

    # 3. Referencia externa única para trazabilidad
    external_ref = f"ESTABLO-PED{pedido.id_pedido}-LEAD{pedido.id_lead}-{uuid.uuid4().hex[:8].upper()}"

    # 4. Crear Preference en Mercado Pago
    sdk = _get_mp_sdk()

    preference_data = {
        "items": [
            {
                "id": f"adelanto-pedido-{pedido.id_pedido}",
                "title": f"Adelanto Reserva - Parrilladas El Establo",
                "description": (
                    f"Adelanto del {payload.porcentaje}% sobre pedido #{pedido.id_pedido}. "
                    f"Total del pedido: ${pedido.total}"
                ),
                "quantity": 1,
                "unit_price": float(monto_adelanto),
                "currency_id": "MXN",
            }
        ],
        "payer": {
            "name": payload.pagador_nombre or "Cliente",
            "email": payload.pagador_email or "cliente@establo.com",
        },
        "back_urls": {
            "success": f"{payload.url_retorno}?pago=exitoso&ref={external_ref}",
            "failure": f"{payload.url_retorno}?pago=fallido&ref={external_ref}",
            "pending": f"{payload.url_retorno}?pago=pendiente&ref={external_ref}",
        },
        "auto_return": "approved",
        "notification_url": settings.MP_WEBHOOK_URL,
        "external_reference": external_ref,
        "statement_descriptor": "PARRILLADAS EL ESTABLO",
        "expires": False,
    }

    mp_response = await run_in_threadpool(sdk.preference().create, preference_data)
    mp_data = mp_response.get("response", {})

    if mp_response.get("status") not in (200, 201):
        logger.error(f"MP Error: {mp_data}")
        raise HTTPException(
            502,
            f"Error creando preferencia en Mercado Pago: {mp_data.get('message', 'Sin detalles')}",
        )

    preference_id: str = mp_data["id"]
    # En sandbox usar sandbox_init_point; en prod usar init_point
    init_point: str = mp_data.get("sandbox_init_point") or mp_data.get("init_point", "")

    # 5. Registrar el pago en BD
    pago = Pago(
        id_pedido=pedido.id_pedido,
        id_lead=pedido.id_lead,
        tipo_pago="adelanto",
        porcentaje=payload.porcentaje,
        monto=monto_adelanto,
        metodo_pago="MERCADO_PAGO",
        estado_pago="PENDIENTE",
        estado="pendiente",
        mp_preference_id=preference_id,
        mp_external_reference=external_ref,
        mp_init_point=init_point,
        pagador_nombre=payload.pagador_nombre,
        pagador_email=payload.pagador_email,
    )
    db.add(pago)

    # 6. Marcar pedido como confirmado
    pedido.estado = "confirmado"
    await db.flush()

    logger.info(f"✅ Preferencia MP creada: {preference_id} por ${monto_adelanto} MXN")

    return MercadoPagoPreferenceResponse(
        id_pago=pago.id_pago,
        preference_id=preference_id,
        init_point=init_point,
        monto_adelanto=monto_adelanto,
        total_pedido=pedido.total,
        mensaje=(
            f"Link de pago generado. Adelanto: ${monto_adelanto} MXN "
            f"({payload.porcentaje}% de ${pedido.total} MXN)"
        ),
    )


# ─── POST /pagos/webhook ──────────────────────────────────────────
@router.post(
    "/webhook",
    status_code=status.HTTP_200_OK,
    summary="Webhook de Mercado Pago (notificaciones IPN)",
)
async def webhook_mercadopago(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Recibe notificaciones de Mercado Pago cuando un pago cambia de estado.
    Mercado Pago envía notificaciones con type="payment" y data.id=<payment_id>.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    if not isinstance(body, dict):
        body = {}
    data = body.get("data")
    if not isinstance(data, dict):
        data = {}
    notification_type = body.get("type") or request.query_params.get("type")
    payment_id = (
        data.get("id")
        or request.query_params.get("data.id")
        or request.query_params.get("id")
    )

    logger.info(f"📩 Webhook MP recibido: type={notification_type} id={payment_id}")

    if notification_type != "payment" or not payment_id:
        return {"status": "ignored"}

    # Consultar el pago en MP
    sdk = _get_mp_sdk()
    mp_result = await run_in_threadpool(sdk.payment().get, payment_id)
    mp_payment = mp_result.get("response", {})

    if mp_result.get("status") != 200:
        logger.warning(f"No se pudo consultar pago {payment_id}: {mp_payment}")
        return {"status": "error", "detail": "Payment not found in MP"}

    mp_status: str = mp_payment.get("status", "")
    mp_detail: str = mp_payment.get("status_detail", "")
    external_ref: str = mp_payment.get("external_reference", "")
    payer_email: str = mp_payment.get("payer", {}).get("email", "")

    # Buscar el Pago por external_reference
    pago_r = await db.execute(
        select(Pago).where(Pago.mp_external_reference == external_ref)
    )
    pago = pago_r.scalar_one_or_none()

    if not pago:
        logger.warning(f"Pago con ref {external_ref} no encontrado en BD")
        return {"status": "not_found"}

    # Actualizar estado del pago
    pago.mp_payment_id = str(payment_id)
    pago.mp_status = mp_status
    pago.mp_status_detail = mp_detail
    pago.pagador_email = payer_email or pago.pagador_email

    from datetime import datetime
    if mp_status == "approved":
        pago.estado = "aprobado"
        pago.estado_pago = "PAGADO"
        pago.fecha_pago = datetime.utcnow()

        # Actualizar pedido
        ped_r = await db.execute(
            select(Pedido).where(Pedido.id_pedido == pago.id_pedido)
        )
        pedido = ped_r.scalar_one_or_none()
        if pedido and pedido.estado not in ("completado", "cancelado"):
            pedido.estado = "pagado_adelanto"

        # Actualizar Lead → "ganado" y Buyer → "payer"
        lead_r = await db.execute(
            select(Lead).where(Lead.id_lead == pago.id_lead)
        )
        lead = lead_r.scalar_one_or_none()
        if lead:
            lead.estado = "ganado"
            buyer_r = await db.execute(
                select(Buyer).where(Buyer.id_buyer == lead.id_buyer)
            )
            buyer = buyer_r.scalar_one_or_none()
            if buyer and buyer.etapa_impulse not in ("customer", "turned"):
                buyer.etapa_impulse = "payer"

        logger.info(f"✅ Pago {payment_id} APROBADO — Lead→ganado, Buyer→payer")

    elif mp_status in ("rejected", "cancelled"):
        pago.estado = "rechazado"
        pago.estado_pago = "RECHAZADO"
        logger.info(f"❌ Pago {payment_id} RECHAZADO: {mp_detail}")

    elif mp_status == "in_process":
        pago.estado = "en_proceso"
        pago.estado_pago = "PENDIENTE"

    await db.flush()
    return {"status": "processed", "mp_status": mp_status}


# ─── GET /pagos/{id_pago} ─────────────────────────────────────────
@router.get("/{id_pago}", response_model=PagoRead, summary="Detalle de un pago")
async def detalle_pago(id_pago: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(select(Pago).where(Pago.id_pago == id_pago))
    pago = r.scalar_one_or_none()
    if not pago:
        raise HTTPException(404, "Pago no encontrado")
    return pago


# ─── GET /pagos/pedido/{id_pedido} ───────────────────────────────
@router.get(
    "/pedido/{id_pedido}",
    response_model=list[PagoRead],
    summary="Pagos de un pedido",
)
async def pagos_por_pedido(id_pedido: UUID, db: AsyncSession = Depends(get_db)):
    r = await db.execute(
        select(Pago)
        .where(Pago.id_pedido == id_pedido)
        .order_by(Pago.created_at.desc())
    )
    return r.scalars().all()


# ─── POST /pagos/simular-aprobacion ──────────────────────────────
@router.post(
    "/simular-aprobacion",
    response_model=PagoRead,
    summary="⚠️ Solo Sandbox: Simular aprobación de pago",
)
async def simular_aprobacion(
    id_pago: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Endpoint exclusivo para pruebas en sandbox.
    Simula la aprobación de un pago sin necesidad de la UI de MP.
    """
    if settings.ENVIRONMENT != "development":
        raise HTTPException(403, "Solo disponible en entorno de desarrollo")

    from datetime import datetime

    r = await db.execute(select(Pago).where(Pago.id_pago == id_pago))
    pago = r.scalar_one_or_none()
    if not pago:
        raise HTTPException(404, "Pago no encontrado")

    pago.estado = "aprobado"
    pago.estado_pago = "PAGADO"
    pago.mp_status = "approved"
    pago.mp_status_detail = "accredited"
    pago.mp_payment_id = f"SANDBOX-SIM-{id_pago}"
    pago.fecha_pago = datetime.utcnow()

    # Actualizar pedido
    ped_r = await db.execute(select(Pedido).where(Pedido.id_pedido == pago.id_pedido))
    pedido = ped_r.scalar_one_or_none()
    if pedido and pedido.estado not in ("completado", "cancelado"):
        pedido.estado = "pagado_adelanto"

    # Lead → ganado, Buyer → payer
    lead_r = await db.execute(select(Lead).where(Lead.id_lead == pago.id_lead))
    lead = lead_r.scalar_one_or_none()
    if lead:
        lead.estado = "ganado"
        buyer_r = await db.execute(select(Buyer).where(Buyer.id_buyer == lead.id_buyer))
        buyer = buyer_r.scalar_one_or_none()
        if buyer and buyer.etapa_impulse not in ("customer", "turned"):
            buyer.etapa_impulse = "payer"

    await db.flush()
    return pago
