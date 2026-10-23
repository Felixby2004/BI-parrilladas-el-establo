"""Webhook de ingesta Hermes. Sin llamadas externas ni respuestas automáticas."""
import hashlib
import json
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.database import get_db
from app.models.base_models import Buyer, Personal
from app.models.buyers_models import BuyerPersona, Lead
from app.models.hermes_models import HermesMensaje
from app.models.leads_models import MensajeChat, SesionChat
from app.schemas.hermes_schemas import HermesMensajeCreate, HermesMensajeRead

bearer = HTTPBearer(auto_error=False)

REMITENTE_CANONICO = {"cliente": "CLIENTE", "agente": "PERSONAL", "bot": "BOT"}


async def verificar_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> None:
    configured = getattr(settings, "HERMES_WEBHOOK_TOKEN", None)
    if hasattr(configured, "get_secret_value"):
        configured = configured.get_secret_value()
    if not isinstance(configured, str) or not configured.strip():
        raise HTTPException(503, "Recepción Hermes no configurada")
    candidate = credentials.credentials if credentials else ""
    valid = secrets.compare_digest(candidate.encode("utf-8"), configured.encode("utf-8"))
    if not credentials or credentials.scheme.lower() != "bearer" or not valid:
        raise HTTPException(401, "Token inválido", headers={"WWW-Authenticate": "Bearer"})


router = APIRouter(
    prefix="/integraciones/hermes", tags=["Hermes"],
    dependencies=[Depends(verificar_token)],
)


async def _lock(db: AsyncSession, namespace: str, value: str) -> None:
    key = int.from_bytes(hashlib.sha256(f"hermes:{namespace}:{value}".encode()).digest()[:8],
                         "big", signed=True)
    await db.execute(select(func.pg_advisory_xact_lock(key)))


def _fingerprint(payload: HermesMensajeCreate) -> str:
    canonical = json.dumps(payload.model_dump(), ensure_ascii=False, sort_keys=True,
                           separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


@router.post("/mensajes", response_model=HermesMensajeRead, status_code=201,
             summary="Recibir texto de WhatsApp registrado por Hermes")
async def recibir_mensaje(
    payload: HermesMensajeCreate, response: Response, db: AsyncSession = Depends(get_db),
):
    await _lock(db, "message", payload.message_id)
    fingerprint = _fingerprint(payload)
    receipt = await db.get(HermesMensaje, payload.message_id)
    if receipt is not None:
        if receipt.payload_sha256 != fingerprint:
            raise HTTPException(409, "message_id ya utilizado con otro contenido")
        row = (await db.execute(
            select(MensajeChat, SesionChat.id_lead)
            .join(SesionChat, SesionChat.id_sesion == MensajeChat.id_sesion)
            .where(MensajeChat.id_negociacion == receipt.id_mensaje)
        )).one()
        msg, id_lead = row
        response.status_code = 200
        return HermesMensajeRead(message_id=payload.message_id, duplicado=True,
                                 id_buyer=None, id_lead=id_lead,
                                 id_negociacion=msg.id_negociacion, created_at=msg.created_at)

    await _lock(db, "phone", payload.telefono)
    # Compatibilidad con registros históricos: +51..., 0051..., espacios/guiones,
    # y móviles peruanos locales. No se reescribe el teléfono/nombre de un buyer existente.
    digits = func.regexp_replace(BuyerPersona.telefono, "[^0-9]", "", "g")
    digits = func.regexp_replace(digits, "^00", "")
    normalized = case((digits.op("~")("^9[0-9]{8}$"), "51" + digits), else_=digits)
    matches = (await db.execute(
        select(Buyer)
        .join(BuyerPersona, Buyer.id_persona == BuyerPersona.id_buyer_persona)
        .where(normalized == payload.telefono[1:])
        .order_by(Buyer.id_buyer).limit(2).with_for_update()
    )).scalars().all()
    if len(matches) > 1:
        raise HTTPException(409, "Teléfono vinculado a varios buyers; requiere revisión")
    now = datetime.utcnow()
    buyer = matches[0] if matches else None
    if buyer is None:
        buyer = Buyer(nombre=payload.nombre or "Contacto WhatsApp", telefono=payload.telefono,
                      canal_captacion="WHATSAPP_DIRECTO", etapa_impulse="lead",
                      fecha_primer_contacto=now.date())
        db.add(buyer)
        await db.flush()
    elif buyer.etapa_impulse == "buyer":
        buyer.etapa_impulse = "lead"

    lead = (await db.execute(
        select(Lead).where(Lead.id_buyer == buyer.id_buyer)
        .order_by(Lead.created_at.desc()).limit(1).with_for_update()
    )).scalar_one_or_none()
    if lead is None:
        lead = Lead(id_buyer=buyer.id_buyer, estado="nuevo", interes_principal="OTRO",
                    interes_confirmado="consulta")
        db.add(lead)
        await db.flush()

    sesion = (await db.execute(
        select(SesionChat).where(SesionChat.id_lead == lead.id_lead)
        .order_by(SesionChat.fecha_inicio.desc()).limit(1).with_for_update()
    )).scalar_one_or_none()
    if sesion is None:
        sesion = SesionChat(
            id_buyer=buyer.id_buyer,
            id_lead=lead.id_lead,
            numero_whatsapp_cliente=payload.telefono,
            fecha_inicio=now,
        )
        db.add(sesion)
        await db.flush()

    remitente = payload.remitente or "cliente"
    id_personal = None
    if remitente == "agente":
        agente = (await db.execute(
            select(Personal).where(Personal.cargo == "AGENTE", Personal.estado_activo.is_(True)).limit(1)
        )).scalar_one_or_none()
        id_personal = agente.id_personal if agente else None

    msg = MensajeChat(
        id_sesion=sesion.id_sesion,
        id_personal=id_personal,
        remitente=remitente,
        remitente_canonico=REMITENTE_CANONICO.get(remitente, "CLIENTE"),
        tipo_mensaje="texto",
        mensaje=payload.mensaje,
        metadata_json=json.dumps({"origen": "hermes", "message_id": payload.message_id,
                                  "direccion": payload.direccion}, ensure_ascii=False),
        fecha_hora_mensaje=now,
    )
    db.add(msg)
    await db.flush()
    db.add(HermesMensaje(message_id=payload.message_id, payload_sha256=fingerprint,
                         id_mensaje=msg.id_negociacion))
    await db.flush()
    return HermesMensajeRead(message_id=payload.message_id, duplicado=False,
                             id_buyer=buyer.id_buyer, id_lead=lead.id_lead,
                             id_negociacion=msg.id_negociacion, created_at=msg.created_at)
