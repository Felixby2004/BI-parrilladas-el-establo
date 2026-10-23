"""Regresión HTTP de todos los endpoints contra PostgreSQL real.

Cada request corre dentro de una transacción exterior que se revierte al final:
no deja datos de prueba. Mercado Pago, Gemini y Hermes se simulan.

Uso:
    DATABASE_URL=postgresql+asyncpg://... python scripts/check_endpoints.py
"""
from __future__ import annotations

import asyncio
import base64
import os
import struct
import sys
import zlib
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1 import creativos, pagos
from app.core.config import settings
from app.db.database import engine, get_db
from app.main import app
from app.models.leads_models import Pago

RESULTS: list[tuple[str, int, str]] = []


def png_vertical(width: int = 90, height: int = 160) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    raw = b"".join(b"\x00" + b"\xff\xff\xff" * width for _ in range(height))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


class FakeMP:
    def __init__(self, external_ref: str) -> None:
        self.external_ref = external_ref

    def preference(self):
        return self

    async def noop(self):
        return None

    def create(self, data):  # sync, como el SDK real invocado en threadpool
        self.external_ref = data["external_reference"]
        return {
            "status": 201,
            "response": {
                "id": "pref-test-001",
                "sandbox_init_point": "https://sandbox.mercadopago.test/checkout",
            },
        }

    def payment(self):
        return self

    def get(self, payment_id):
        return {
            "status": 200,
            "response": {
                "status": "approved",
                "status_detail": "accredited",
                "external_reference": self.external_ref,
                "payer": {"email": "ana@example.com"},
            },
        }


def check(name: str, response: httpx.Response, expected: int, required: tuple[str, ...] = ()):
    ok = response.status_code == expected
    if ok:
        try:
            body = response.json()
        except ValueError:
            body = None
        for key in required:
            if not isinstance(body, dict) or key not in body:
                ok = False
                break
    detail = "" if ok else f"{response.status_code} {response.text[:180]}"
    RESULTS.append((name, response.status_code, detail))
    if not ok:
        raise AssertionError(f"{name}: esperado {expected}, obtenido {response.status_code} {detail}")
    return response.json() if response.content else None


async def main() -> int:
    settings.HERMES_WEBHOOK_TOKEN = "test-hermes-token"
    settings.GEMINI_API_KEY = "test-gemini-key"
    png_b64 = base64.b64encode(png_vertical()).decode()

    async def fake_request_google(payload, brief):
        return {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {"text": "Parrillada El Establo"},
                            {
                                "inlineData": {
                                    "mimeType": "image/png",
                                    "data": png_b64,
                                }
                            },
                        ]
                    }
                }
            ]
        }

    creativos.request_google = fake_request_google

    fake_mp = FakeMP("")
    pagos._get_mp_sdk = lambda: fake_mp

    conn = await engine.connect()
    trans = await conn.begin()
    session = AsyncSession(bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint")

    async def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        api = "/api/v1"

        check("GET /health", await client.get("/health"), 200, ("status",))

        # ── captación ────────────────────────────────────────────
        form = check(
            "POST /captacion/formulario",
            await client.post(
                f"{api}/captacion/formulario",
                json={
                    "nombre": "Ana Torres",
                    "telefono": "5599000111",
                    "email": "ana.test@example.com",
                    "interes": "reserva",
                    "personas_aproximadas": 4,
                    "canal": "web",
                },
            ),
            201,
            ("id_formulario", "id_buyer", "id_lead"),
        )
        id_buyer, id_lead = form["id_buyer"], form["id_lead"]
        check("GET /captacion/formularios", await client.get(f"{api}/captacion/formularios"), 200)

        # ── leads ────────────────────────────────────────────────
        check("GET /leads", await client.get(f"{api}/leads"), 200)
        check("GET /leads/stats", await client.get(f"{api}/leads/stats"), 200, ("total",))
        check("GET /leads/{id}", await client.get(f"{api}/leads/{id_lead}"), 200, ("id_lead",))
        check(
            "PATCH /leads/{id}/estado",
            await client.patch(f"{api}/leads/{id_lead}/estado", json={"estado": "contactado"}),
            200,
            ("estado",),
        )

        # ── campañas y anuncios ──────────────────────────────────
        campana = check(
            "POST /campanas",
            await client.post(
                f"{api}/campanas",
                json={"nombre": "Test Campaña", "estado": "activa", "presupuesto_total": 1000},
            ),
            201,
            ("id_campana",),
        )
        id_campana = campana["id_campana"]
        check("GET /campanas", await client.get(f"{api}/campanas"), 200)
        check("GET /campanas/{id}", await client.get(f"{api}/campanas/{id_campana}"), 200)
        check(
            "PUT /campanas/{id}",
            await client.put(f"{api}/campanas/{id_campana}", json={"nombre": "Test Campaña 2"}),
            200,
            ("nombre",),
        )

        anuncio = check(
            "POST /anuncios",
            await client.post(f"{api}/anuncios", json={"id_campana": id_campana, "titulo": "Anuncio test"}),
            201,
            ("id_anuncio",),
        )
        id_anuncio = anuncio["id_anuncio"]
        check("GET /anuncios", await client.get(f"{api}/anuncios"), 200)
        check(
            "PUT /anuncios/{id}",
            await client.put(f"{api}/anuncios/{id_anuncio}", json={"titulo": "Anuncio test 2"}),
            200,
            ("id_anuncio",),
        )

        # ── perfiles ─────────────────────────────────────────────
        check(
            "POST /perfiles/gustos",
            await client.post(
                f"{api}/perfiles/gustos",
                json={"id_lead": id_lead, "termino_coccion": "tres_cuartos", "alergias": "ninguna"},
            ),
            201,
            ("id_perfil_gustos",),
        )
        check("GET /perfiles/gustos/{id}", await client.get(f"{api}/perfiles/gustos/{id_lead}"), 200)
        check(
            "POST /perfiles/reserva",
            await client.post(
                f"{api}/perfiles/reserva",
                json={"id_lead": id_lead, "numero_personas": 4, "hora_inicio": "20:00:00"},
            ),
            201,
            ("id_perfil_reserva",),
        )
        check("GET /perfiles/reserva/{id}", await client.get(f"{api}/perfiles/reserva/{id_lead}"), 200)
        check(
            "POST /perfiles/chat",
            await client.post(
                f"{api}/perfiles/chat",
                json={"id_lead": id_lead, "mensaje": "Hola", "remitente": "cliente"},
            ),
            201,
            ("id_negociacion",),
        )
        check("GET /perfiles/chat/{id}", await client.get(f"{api}/perfiles/chat/{id_lead}"), 200)
        check("GET /perfiles/{id}/360", await client.get(f"{api}/perfiles/{id_lead}/360"), 200)

        # ── pedidos ──────────────────────────────────────────────
        pedido = check(
            "POST /pedidos",
            await client.post(
                f"{api}/pedidos",
                json={
                    "id_lead": id_lead,
                    "id_buyer": id_buyer,
                    "tipo_pedido": "salon",
                    "detalles": [
                        {
                            "id_producto": 1,
                            "nombre_producto": "Parrillada para 2",
                            "cantidad": 2,
                            "precio_unitario": "450.00",
                        }
                    ],
                },
            ),
            201,
            ("id_pedido", "total"),
        )
        id_pedido = pedido["id_pedido"]
        check("GET /pedidos", await client.get(f"{api}/pedidos"), 200)
        check("GET /pedidos/{id}", await client.get(f"{api}/pedidos/{id_pedido}"), 200)
        check(
            "PATCH /pedidos/{id}",
            await client.patch(f"{api}/pedidos/{id_pedido}", json={"notas": "sin cebolla"}),
            200,
            ("id_pedido",),
        )

        # Lead con pedido: no se puede borrar.
        check("DELETE /leads/{id} (con pedido)", await client.delete(f"{api}/leads/{id_lead}"), 409)

        # ── pagos (Mercado Pago simulado) ────────────────────────
        adelanto = check(
            "POST /pagos/adelanto",
            await client.post(
                f"{api}/pagos/adelanto",
                json={"id_pedido": id_pedido, "porcentaje": "10", "pagador_email": "ana.test@example.com"},
            ),
            201,
            ("id_pago", "init_point"),
        )
        id_pago = adelanto["id_pago"]
        check("GET /pagos/{id}", await client.get(f"{api}/pagos/{id_pago}"), 200, ("id_pago",))
        check("GET /pagos/pedido/{id}", await client.get(f"{api}/pagos/pedido/{id_pedido}"), 200)
        check(
            "POST /pagos/simular-aprobacion",
            await client.post(f"{api}/pagos/simular-aprobacion", params={"id_pago": id_pago}),
            200,
            ("estado",),
        )

        # El webhook resuelve por external_reference: se toma de la BD.
        externo = (
            await session.execute(select(Pago.mp_external_reference).where(Pago.id_pago == id_pago))
        ).scalar_one()
        fake_mp.external_ref = externo
        check(
            "POST /pagos/webhook",
            await client.post(
                f"{api}/pagos/webhook",
                json={"type": "payment", "data": {"id": "123456"}},
            ),
            200,
        )

        # ── mesas y payers ───────────────────────────────────────
        mesa = check(
            "POST /mesas",
            await client.post(f"{api}/mesas", json={"numero": "99", "capacidad": 4, "sector": "salon"}),
            201,
            ("id_mesa",),
        )
        id_mesa = mesa["id_mesa"]
        check("GET /mesas", await client.get(f"{api}/mesas"), 200)
        check(
            "PATCH /mesas/{id}/estado",
            await client.patch(f"{api}/mesas/{id_mesa}/estado", params={"estado": "ocupada"}),
            200,
            ("estado",),
        )

        payer = check(
            "POST /payers",
            await client.post(
                f"{api}/payers",
                json={
                    "id_lead": id_lead,
                    "id_pedido": id_pedido,
                    "id_buyer": id_buyer,
                    "id_mesa": id_mesa,
                },
            ),
            201,
            ("id_payer", "monto_saldo"),
        )
        id_payer = payer["id_payer"]
        check("GET /payers", await client.get(f"{api}/payers"), 200)
        check(
            "PATCH /payers/{id}",
            await client.patch(f"{api}/payers/{id_payer}", json={"notas": "llegó puntual"}),
            200,
            ("id_payer",),
        )

        check(
            "POST /caja/cobrar-saldo",
            await client.post(
                f"{api}/caja/cobrar-saldo",
                json={"id_payer": id_payer, "tipo_pago": "efectivo"},
            ),
            201,
            ("id_instruccion", "id_comprobante"),
        )
        check("GET /caja/comprobante/{id_payer}", await client.get(f"{api}/caja/comprobante/{id_payer}"), 200)

        # ── servicios, alertas y reseñas ─────────────────────────
        servicio = check(
            "POST /servicios",
            await client.post(
                f"{api}/servicios",
                json={
                    "id_payer": id_payer,
                    "id_mesa": id_mesa,
                    "prioridad": "normal",
                    "detalles": [{"nombre_item": "Parrillada", "cantidad": 1}],
                },
            ),
            201,
            ("id_servicio", "detalles"),
        )
        id_servicio = servicio["id_servicio"]
        id_item = servicio["detalles"][0]["id_servicio_detalle"]
        check("GET /servicios", await client.get(f"{api}/servicios"), 200)
        check("GET /servicios/cocina", await client.get(f"{api}/servicios/cocina"), 200)
        check(
            "PATCH /servicios/{id}/estado",
            await client.patch(f"{api}/servicios/{id_servicio}/estado", params={"estado": "preparando"}),
            200,
            ("estado",),
        )
        check(
            "PATCH /servicios/{id}/items/{id_item}",
            await client.patch(
                f"{api}/servicios/{id_servicio}/items/{id_item}", json={"estado_item": "listo"}
            ),
            200,
            ("estado_item",),
        )

        alerta = check(
            "POST /alertas",
            await client.post(
                f"{api}/alertas",
                json={"id_servicio": id_servicio, "tipo_alerta": "tiempo_espera", "descripcion": "Demora"},
            ),
            201,
            ("id_alerta",),
        )
        check("GET /alertas", await client.get(f"{api}/alertas"), 200)
        check(
            "PATCH /alertas/{id}/atender",
            await client.patch(f"{api}/alertas/{alerta['id_alerta']}/atender"),
            200,
            ("atendida",),
        )

        check(
            "POST /resenas",
            await client.post(
                f"{api}/resenas",
                json={"id_servicio": id_servicio, "id_buyer": id_buyer, "calificacion_general": 5},
            ),
            201,
            ("id_resena",),
        )
        check("GET /resenas", await client.get(f"{api}/resenas"), 200)

        # ── creativos (Gemini simulado) ──────────────────────────
        check("GET /creativos/configuracion", await client.get(f"{api}/creativos/configuracion"), 200)
        check(
            "POST /creativos/generar",
            await client.post(
                f"{api}/creativos/generar",
                json={"prompt": "Parrillada premium para dos personas", "formato": "9:16"},
            ),
            200,
            ("imagen_base64", "ancho"),
        )

        # ── Hermes ───────────────────────────────────────────────
        hermes = await client.post(
            f"{api}/integraciones/hermes/mensajes",
            headers={"Authorization": "Bearer test-hermes-token"},
            json={
                "message_id": "msg-test-001",
                "telefono": "+525599000111",
                "mensaje": "Quiero reservar",
                "remitente": "cliente",
                "direccion": "entrante",
            },
        )
        check("POST /integraciones/hermes/mensajes", hermes, 201, ("id_negociacion",))

        # ── cierres ──────────────────────────────────────────────
        descartable = check(
            "POST /captacion/formulario (descartable)",
            await client.post(
                f"{api}/captacion/formulario",
                json={"nombre": "Lead Borrable", "telefono": "5599000222", "interes": "otro"},
            ),
            201,
            ("id_lead",),
        )
        check("DELETE /leads/{id} (sin pedido)", await client.delete(f"{api}/leads/{descartable['id_lead']}"), 204)
        check("DELETE /anuncios/{id}", await client.delete(f"{api}/anuncios/{id_anuncio}"), 204)
        check("DELETE /campanas/{id}", await client.delete(f"{api}/campanas/{id_campana}"), 204)
        check("DELETE /pedidos/{id}", await client.delete(f"{api}/pedidos/{id_pedido}"), 204)

    await trans.rollback()
    await session.close()
    await conn.close()
    await engine.dispose()

    print(f"{'ENDPOINT':58} {'HTTP':>5}")
    for name, code, _ in RESULTS:
        print(f"{name:58} {code:>5}")
    print(f"\n{len(RESULTS)} endpoints verificados, sin cambios persistidos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))


