r"""Regresiones Hermes sin dependencias nuevas ni llamadas externas.

Desde backend:
  .venv\Scripts\python.exe scripts/check_hermes.py
  .venv\Scripts\python.exe scripts/check_hermes.py --postgres

PostgreSQL local: requiere esquema migrado; todos los datos se revierten.
No importa app.main, no crea tablas, no ejecuta startup ni usa Mercado Pago.
"""
import argparse
import asyncio
import hashlib
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi import FastAPI
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app import models
from app.api.v1 import hermes, perfiles, leads
from app.db.database import Base, engine, get_db
from app.schemas.hermes_schemas import normalizar_telefono

PATH = "/api/v1/integraciones/hermes/mensajes"


def app_factory():
    app = FastAPI()
    for router in (hermes.router, perfiles.router, leads.router):
        app.include_router(router, prefix="/api/v1")
    return app


async def post(client, payload, status, token="test-only-token"):
    headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
    r = await client.post(PATH, json=payload, headers=headers)
    assert r.status_code == status, (r.status_code, r.text)
    return r.json()


async def offline():
    app = app_factory()

    class NoDB:
        async def execute(self, *args, **kwargs):
            raise AssertionError("Validación/autenticación no debe consultar DB")

    async def dependency():
        yield NoDB()

    app.dependency_overrides[get_db] = dependency
    original = hermes.settings
    try:
        hermes.settings = SimpleNamespace(HERMES_WEBHOOK_TOKEN=None)
        body = {"message_id": "offline-1", "telefono": "999123456", "mensaje": "Hola"}
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
            await post(c, body, 503)
            hermes.settings = SimpleNamespace(HERMES_WEBHOOK_TOKEN="test-only-token")
            await post(c, body, 401, token=None)
            await post(c, body, 401, token="wrong")
            for changes in (
                {"mensaje": "  \n "}, {"mensaje": "x" * 4097}, {"mensaje": "a\x00b"},
                {"telefono": "abc999123456"}, {"telefono": "123"}, {"telefono": 999123456},
                {"telefono": "+0000000000"}, {"telefono": "９９９１２３４５６"},
                {"nombre": "  "}, {"nombre": "x" * 101}, {"message_id": " "},
                {"message_id": "a b"}, {"message_id": "x" * 256},
                {"remitente": "agente"}, {"remitente": "bot"},
                {"direccion": "saliente"}, {"otro": True},
            ):
                await post(c, dict(body, **changes), 422)
            await post(c, {k: v for k, v in body.items() if k != "message_id"}, 422)
        assert normalizar_telefono("999 123 456") == "+51999123456"
        assert normalizar_telefono("+51 (999) 123-456") == "+51999123456"
        assert normalizar_telefono("0051 999123456") == "+51999123456"
        list(Base.metadata.sorted_tables)
        table = Base.metadata.tables["hermes_mensajes"]
        assert table.c.message_id.primary_key
        assert next(iter(table.c.id_negociacion.foreign_keys)).target_fullname == "negociacion_leads.id_negociacion"
        print("OK: Hermes offline, autenticación, validación, normalización y registro FK")
    finally:
        hermes.settings = original


async def postgres():
    if engine.url.host not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError("--postgres requiere DATABASE_URL con host local")
    engine.echo = False
    app = app_factory()
    original = hermes.settings
    hermes.settings = SimpleNamespace(HERMES_WEBHOOK_TOKEN="test-only-token")
    try:
        async with engine.connect() as connection:
            transaction = await connection.begin()

            async def dependency():
                async with AsyncSession(bind=connection, expire_on_commit=False, autoflush=False,
                                        join_transaction_mode="create_savepoint") as session:
                    try:
                        yield session
                        await session.commit()
                    except Exception:
                        await session.rollback()
                        raise

            app.dependency_overrides[get_db] = dependency
            try:
                async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
                    key = uuid4().hex
                    phone = "+519" + str(int(key[:12], 16) % 100000000).zfill(8)
                    body = {"message_id": key, "telefono": phone, "mensaje": " Hola Hermes ", "nombre": "Prueba"}
                    first = await post(c, body, 201)
                    duplicate = await post(c, body, 200)
                    assert first["id_negociacion"] == duplicate["id_negociacion"]
                    assert duplicate["duplicado"] is True
                    assert datetime.fromisoformat(first["created_at"]).utcoffset() is not None
                    await post(c, dict(body, mensaje="Otro texto"), 409)
                    # Un worker independiente no puede tomar el lock hasta commit/rollback.
                    lock_key = int.from_bytes(hashlib.sha256(f"hermes:message:{key}".encode()).digest()[:8],
                                              "big", signed=True)
                    async with engine.connect() as other:
                        t2 = await other.begin()
                        try:
                            assert (await other.execute(select(func.pg_try_advisory_xact_lock(lock_key)))).scalar_one() is False
                        finally:
                            await t2.rollback()
                    async with AsyncSession(bind=connection, expire_on_commit=False,
                                            join_transaction_mode="create_savepoint") as setup:
                        buyer = await setup.get(models.Buyer, first["id_buyer"])
                        buyer.etapa_impulse = "customer"
                        buyer.telefono = phone[3:]  # Formato local histórico.
                        lead = await setup.get(models.Lead, first["id_lead"])
                        lead.estado = "ganado"
                        await setup.commit()
                    out = await post(c, dict(body, message_id=key + "-out", direccion="saliente", remitente="agente"), 201)
                    assert out["id_buyer"] == first["id_buyer"] and out["id_lead"] == first["id_lead"]
                    await post(c, dict(body, message_id=key + "-bot", direccion="saliente", remitente="bot"), 201)
                    async with AsyncSession(bind=connection, expire_on_commit=False,
                                            join_transaction_mode="create_savepoint") as setup:
                        buyer = await setup.get(models.Buyer, first["id_buyer"])
                        lead = await setup.get(models.Lead, first["id_lead"])
                        assert buyer.etapa_impulse == "customer" and lead.estado == "ganado"
                        # Seeds empatados: el desempate debe ser por PK ascendente.
                        same_time = datetime(2020, 1, 1, tzinfo=timezone.utc)
                        seeds = [models.NegociacionLead(id_lead=lead.id_lead, remitente="cliente",
                                                       mensaje=f"seed-{i}", created_at=same_time) for i in range(3)]
                        setup.add_all(seeds)
                        await setup.commit()
                    chat = (await c.get(f"/api/v1/perfiles/chat/{first['id_lead']}")).json()
                    assert [m["mensaje"] for m in chat[:3]] == ["seed-0", "seed-1", "seed-2"]
                    profile = (await c.get(f"/api/v1/perfiles/{first['id_lead']}/360")).json()
                    assert [m["mensaje"] for m in profile["mensajes_recientes"][:3]] == ["seed-0", "seed-1", "seed-2"]
                    kanban = (await c.get("/api/v1/leads")).json()
                    assert next(l for l in kanban if l["id_lead"] == first["id_lead"])["buyer_canal"] == "whatsapp"
                    latest = (await c.get(f"/api/v1/perfiles/chat/{first['id_lead']}?limit=2")).json()
                    assert len(latest) == 2 and latest[-1]["remitente"] == "bot"
                    assert latest[-1]["id_negociacion"] > latest[0]["id_negociacion"]
                    for invalid_limit in (0, 201, -1):
                        assert (await c.get(f"/api/v1/perfiles/chat/{first['id_lead']}?limit={invalid_limit}")).status_code == 422
                    assert (await c.delete(f"/api/v1/leads/{first['id_lead']}")).status_code == 409
                    async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint") as setup:
                        assert (await setup.execute(select(func.count()).select_from(models.HermesMensaje)
                                                    .where(models.HermesMensaje.message_id == key))).scalar_one() == 1
                        # La FK debe impedir recibos huérfanos, no solo estar declarada.
                        try:
                            async with setup.begin_nested():
                                setup.add(models.HermesMensaje(message_id=key + "-orphan",
                                                               payload_sha256="0" * 64,
                                                               id_negociacion=-2147483647))
                                await setup.flush()
                        except IntegrityError:
                            pass
                        else:
                            raise AssertionError("Se aceptó un recibo sin negociación")
                        # Ambigüedad histórica debe rechazar sin crear otro mensaje.
                        setup.add(models.Buyer(nombre="Duplicado", telefono=phone, etapa_impulse="payer"))
                        await setup.commit()
                    await post(c, dict(body, message_id=key + "-ambiguous"), 409)
                    # Buyer payer existente sin lead: se crea el FK lead, sin degradar etapa.
                    phone2 = "+519" + str((int(key[:12], 16) + 1) % 100000000).zfill(8)
                    async with AsyncSession(bind=connection, expire_on_commit=False,
                                            join_transaction_mode="create_savepoint") as setup:
                        payer_buyer = models.Buyer(nombre="Payer existente", telefono=phone2, etapa_impulse="payer")
                        setup.add(payer_buyer)
                        await setup.commit()
                        payer_id = payer_buyer.id_buyer
                    linked = await post(c, dict(body, message_id=key + "-payer", telefono=phone2), 201)
                    assert linked["id_buyer"] == payer_id
                    async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint") as check:
                        assert (await check.get(models.Buyer, payer_id)).etapa_impulse == "payer"
                        assert (await check.get(models.Lead, linked["id_lead"])).id_buyer == payer_id
                print("OK: Hermes PostgreSQL, rollback, idempotencia, lock entre conexiones, enlaces y orden estable")
            finally:
                await transaction.rollback()
    finally:
        hermes.settings = original
        await engine.dispose()


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--postgres", action="store_true")
    args = parser.parse_args()
    logging.disable(logging.CRITICAL)
    await offline()
    if args.postgres:
        await postgres()


if __name__ == "__main__":
    asyncio.run(main())
