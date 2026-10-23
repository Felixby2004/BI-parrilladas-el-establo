r"""Regresiones HTTP locales, sin MercadoPago ni servidores externos.

Desde backend:
  .venv\Scripts\python.exe scripts/check_http_flow.py
  .venv\Scripts\python.exe scripts/check_http_flow.py --postgres

Por defecto comprueba validaciones y errores HTTP con una sesión simulada.
--postgres usa DATABASE_URL local, tablas existentes y rollback de todos los datos.
No importa app.main, no ejecuta startup ni llama endpoints de pagos.
"""
import argparse
import asyncio
import logging
import sys
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncSession

from app import models  # Registra todas las FK, incluida personal.
from app.api.v1 import captacion, leads, pedidos, payers, customers, perfiles
from app.db.database import Base, engine, get_db


def make_app():
    app = FastAPI()
    for module in (captacion, leads, pedidos, payers, customers, perfiles):
        app.include_router(module.router, prefix="/api/v1")
    return app


class FakeResult:
    def __init__(self, value=None):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class FakeDB:
    """Sólo para rutas que terminan antes de escribir; no imita una BD real."""
    def __init__(self, *values):
        self.values = iter(values)

    async def execute(self, statement):
        return FakeResult(next(self.values, None))


async def expect(client, method, path, status, **kwargs):
    response = await client.request(method, "/api/v1" + path, **kwargs)
    assert response.status_code == status, (method, path, response.status_code, response.text)
    return response.json() if response.content else None


async def offline():
    app = make_app()
    fake = FakeDB()

    async def dependency():
        yield fake

    app.dependency_overrides[get_db] = dependency
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        await expect(c, "POST", "/captacion/formulario", 422,
                     json={"nombre": "   ", "telefono": "1234567"})
        await expect(c, "PATCH", "/pedidos/1", 422, json={"detalles": []})
        await expect(c, "POST", "/servicios", 422, json={"id_payer": 1, "detalles": []})
        await expect(c, "PATCH", "/mesas/1/estado?estado=invalido", 422)
        await expect(c, "PATCH", "/servicios/1/estado?estado=invalido", 422)
        for amount in ("-1", "0", "1.001"):
            await expect(c, "POST", "/caja/cobrar-saldo", 422,
                         json={"id_payer": 1, "tipo_pago": "efectivo", "monto": amount})
        await expect(c, "POST", "/payers", 404,
                     json={"id_lead": 1, "id_buyer": 1, "id_pedido": 1})
        await expect(c, "POST", "/servicios", 404,
                     json={"id_payer": 1, "detalles": [{"nombre_item": "Prueba"}]})
        await expect(c, "POST", "/alertas", 404,
                     json={"id_servicio": 1, "tipo_alerta": "incidencia", "descripcion": "Prueba"})
        await expect(c, "POST", "/resenas", 404,
                     json={"id_servicio": 1, "calificacion_general": 5})
        fake = FakeDB(SimpleNamespace(id_buyer=2))
        await expect(c, "POST", "/pedidos", 422, json={
            "id_lead": 1, "id_buyer": 1,
            "detalles": [{"nombre_producto": "Prueba", "precio_unitario": "10.00"}]})
        fake = FakeDB(SimpleNamespace(estado="esperando", fecha_pago_saldo=None,
                                     monto_saldo=Decimal("10.00")))
        await expect(c, "POST", "/caja/cobrar-saldo", 422,
                     json={"id_payer": 1, "tipo_pago": "efectivo", "monto": "1.00"})
        fake = FakeDB(SimpleNamespace(estado="finalizado", fecha_pago_saldo=None))
        await expect(c, "POST", "/caja/cobrar-saldo", 409,
                     json={"id_payer": 1, "tipo_pago": "efectivo"})
    assert "personal" in Base.metadata.tables
    list(Base.metadata.sorted_tables)  # Detecta FK sin tabla de destino.
    print("OK: 15 regresiones HTTP offline y resolución de FK")


async def postgres():
    # No permite apuntar accidentalmente al entorno remoto ni imprime credenciales.
    if engine.url.host not in ("localhost", "127.0.0.1", "::1"):
        raise RuntimeError("--postgres requiere DATABASE_URL con host local")
    app = make_app()
    engine.echo = False
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
                token = uuid4().hex[:10]
                captured = await expect(c, "POST", "/captacion/formulario", 201,
                                        json={"nombre": "HTTP Prueba", "telefono": "T" + token})
                lid, bid = captured["id_lead"], captured["id_buyer"]
                async with AsyncSession(bind=connection, join_transaction_mode="create_savepoint") as setup:
                    persona = models.BuyerPersona(nombre="HTTP Persona")
                    campaign = models.Campana(nombre="HTTP Campaña", buyer_persona=persona)
                    setup.add(campaign)
                    await setup.flush()
                    lead_row = await setup.get(models.Lead, lid)
                    lead_row.id_campana = campaign.id_campana
                    await setup.commit()
                lead = await expect(c, "GET", f"/leads/{lid}", 200)
                assert lead["interes_confirmado"] == "consulta"
                assert lead["campana"]["buyer_persona"]["nombre"] == "HTTP Persona"
                for endpoint in ("gustos", "reserva"):
                    await expect(c, "POST", f"/perfiles/{endpoint}", 201, json={"id_lead": lid})
                    await expect(c, "POST", f"/perfiles/{endpoint}", 201,
                                 json={"id_lead": lid, "notas_adicionales": "actualizado"} if endpoint == "gustos"
                                 else {"id_lead": lid, "numero_personas": 3})
                detail = {"nombre_producto": "Prueba", "precio_unitario": "20.00", "cantidad": 2}
                order = await expect(c, "POST", "/pedidos", 201,
                                     json={"id_lead": lid, "id_buyer": bid, "detalles": [detail]})
                oid = order["id_pedido"]
                await expect(c, "DELETE", f"/leads/{lid}", 409)
                detail["cantidad"] = 3
                order = await expect(c, "PATCH", f"/pedidos/{oid}", 200, json={"detalles": [detail]})
                assert len(order["detalles"]) == 1 and order["detalles"][0]["cantidad"] == 3
                assert Decimal(order["total"]) == Decimal("60.00")
                payer = await expect(c, "POST", "/payers", 201, json={
                    "id_lead": lid, "id_buyer": bid, "id_pedido": oid,
                    "total_pedido": "0.01", "monto_saldo": "0.01", "monto_adelanto_pagado": "0.00"})
                pid = payer["id_payer"]
                assert Decimal(payer["total_pedido"]) == Decimal("60.00")
                assert Decimal(payer["monto_saldo"]) == Decimal("60.00")
                await expect(c, "POST", "/payers", 409,
                             json={"id_lead": lid, "id_buyer": bid, "id_pedido": oid})
                await expect(c, "PATCH", f"/pedidos/{oid}", 409, json={"detalles": [detail]})
                await expect(c, "PATCH", f"/payers/{pid}", 409, json={"estado": "saldo_pagado"})
                await expect(c, "POST", "/caja/cobrar-saldo", 422,
                             json={"id_payer": pid, "tipo_pago": "efectivo", "monto": "1.00"})
                await expect(c, "POST", "/caja/cobrar-saldo", 201,
                             json={"id_payer": pid, "tipo_pago": "efectivo"})
                await expect(c, "POST", "/caja/cobrar-saldo", 409,
                             json={"id_payer": pid, "tipo_pago": "efectivo"})
                await expect(c, "GET", f"/caja/comprobante/{pid}", 200)
                service = await expect(c, "POST", "/servicios", 201, json={
                    "id_payer": pid, "detalles": [{"nombre_item": "Prueba", "id_detalle_pedido": order["detalles"][0]["id_detalle"]}]})
                sid = service["id_servicio"]
                await expect(c, "PATCH", f"/servicios/{sid}/estado?estado=preparando", 200)
                iid = service["detalles"][0]["id_servicio_detalle"]
                await expect(c, "PATCH", f"/servicios/{sid}/items/{iid}", 200, json={"estado_item": "listo"})
                services = await expect(c, "GET", "/servicios?estado=servido", 200)
                assert any(s["id_servicio"] == sid for s in services)
                lead = await expect(c, "GET", f"/leads/{lid}", 200)
                assert lead["buyer"]["etapa_impulse"] == "customer"
                # Una nueva captación no debe degradar customer -> lead.
                await expect(c, "POST", "/captacion/formulario", 201,
                             json={"nombre": "HTTP Prueba", "telefono": "T" + token})
                lead = await expect(c, "GET", f"/leads/{lid}", 200)
                assert lead["buyer"]["etapa_impulse"] == "customer"
            print("OK: flujo PostgreSQL buyers -> leads -> pedidos -> payers -> customers (rollback)")
        finally:
            await transaction.rollback()
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--postgres", action="store_true")
    options = parser.parse_args()
    logging.basicConfig(level=logging.WARNING)
    asyncio.run(postgres() if options.postgres else offline())
