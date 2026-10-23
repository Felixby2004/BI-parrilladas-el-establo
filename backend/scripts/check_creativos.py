"""Pruebas del estudio, respuestas Google simuladas: no envía prompts ni consume cuota."""
import asyncio
import base64
from pathlib import Path
import struct
import sys
from unittest.mock import AsyncMock, patch
import zlib

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import httpx
from fastapi import FastAPI
from app.api.v1 import creativos
from app.core.config import settings

RealClient = httpx.AsyncClient


def png(width, height):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress((b"\x00" + b"\x60\x20\x10" * width) * height)) + chunk(b"IEND", b""))


def fixture(width=9, height=16):
    return {"candidates": [{"content": {"parts": [{"text": "Anuncio generado"}, {"inlineData": {
        "mimeType": "image/png", "data": base64.b64encode(png(width, height)).decode(),
    }}]}}]}


async def main():
    app = FastAPI()
    app.include_router(creativos.router, prefix="/api/v1")
    body = {"prompt": "Una fotografía vertical de Tomahawk a la brasa", "formato": "9:16"}
    async with RealClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        with patch.object(settings, "GEMINI_API_KEY", None):
            r = await client.get("/api/v1/creativos/configuracion")
            assert r.status_code == 200 and r.json()["configurado"] is False
            assert "GEMINI_API_KEY" not in r.json()
            assert (await client.post("/api/v1/creativos/generar", json=body)).status_code == 503
        with patch.object(settings, "GEMINI_API_KEY", "test-key-not-real"):
            with patch.object(creativos, "request_google", AsyncMock(return_value=fixture())) as google:
                r = await client.post("/api/v1/creativos/generar", json=body)
                assert r.status_code == 200, r.text
                assert (r.json()["ancho"], r.json()["alto"]) == (9, 16)
                assert r.json()["proveedor"] == "Google Gemini"
                assert "test-key-not-real" not in r.text
                assert google.await_count == 1
                for invalid in ({**body, "prompt": " " * 30}, {**body, "formato": "1:1"}):
                    assert (await client.post("/api/v1/creativos/generar", json=invalid)).status_code == 422
            with patch.object(creativos, "request_google", AsyncMock(return_value=fixture(10, 10))):
                assert (await client.post("/api/v1/creativos/generar", json=body)).status_code == 502
            with patch.object(creativos, "request_google", AsyncMock(return_value=fixture(4, 5))):
                r = await client.post("/api/v1/creativos/generar", json={**body, "formato": "4:5"})
                assert r.status_code == 200 and r.json()["formato"] == "4:5"
            with patch.object(creativos, "request_google", AsyncMock(return_value={"promptFeedback": {"blockReason": "SAFETY"}})):
                assert (await client.post("/api/v1/creativos/generar", json=body)).status_code == 422
            with patch.object(creativos, "request_google", AsyncMock(return_value=["malformed"])):
                assert (await client.post("/api/v1/creativos/generar", json=body)).status_code == 502
            await creativos._generation_lock.acquire()
            try:
                assert (await client.post("/api/v1/creativos/generar", json=body)).status_code == 429
            finally:
                creativos._generation_lock.release()

    # Prueba contrato REST real y errores de proveedor sin salir a Internet.
    payload = creativos.CreativeRequest(**body)
    seen = []
    def handler(request):
        import json
        seen.append(request)
        sent = json.loads(request.content)
        assert request.headers["x-goog-api-key"] == "test-key-not-real"
        assert request.url.host == "generativelanguage.googleapis.com"
        assert sent["generationConfig"]["imageConfig"]["aspectRatio"] == "9:16"
        return httpx.Response(200, json=fixture())
    with patch.object(settings, "GEMINI_API_KEY", "test-key-not-real"):
        with patch.object(creativos.httpx, "AsyncClient", side_effect=lambda **kw: RealClient(transport=httpx.MockTransport(handler), **kw)):
            response = await creativos.request_google(payload, creativos.build_brief(payload))
            assert len(seen) == 1 and response["candidates"]
        for status, expected in ((403, 502), (429, 429), (500, 502), (404, 502)):
            with patch.object(creativos.httpx, "AsyncClient", side_effect=lambda **kw: RealClient(transport=httpx.MockTransport(lambda r: httpx.Response(status)), **kw)):
                try:
                    await creativos.request_google(payload, "brief")
                except Exception as error:
                    assert getattr(error, "status_code", None) == expected
                else:
                    raise AssertionError("Se aceptó un error de proveedor")
    print("OK: estudio creativo, validaciones, formatos verticales, contrato REST y errores; ninguna llamada Google real")


if __name__ == "__main__":
    asyncio.run(main())
