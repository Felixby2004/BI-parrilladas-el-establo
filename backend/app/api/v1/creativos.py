"""Fotografías publicitarias verticales mediante la API oficial Gemini.

Pomelli es una herramienta externa: este router no usa ni simula su API.
"""
import asyncio
import base64
import binascii
import json
import re
import struct
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings

router = APIRouter(prefix="/creativos", tags=["Buyers / Estudio creativo"])
_generation_lock = asyncio.Lock()
MAX_RESPONSE_BYTES = 24 * 1024 * 1024
POMELLI_URL = "https://labs.google.com/pomelli/about/"


class CreativeRequest(BaseModel):
    prompt: str = Field(min_length=15, max_length=5000)
    formato: Literal["9:16", "4:5"] = "9:16"
    texto_publicitario: str = Field(default="", max_length=300)
    llamada_accion: str = Field(default="Reserva tu mesa", max_length=100)

    @field_validator("prompt", "texto_publicitario", "llamada_accion", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class CreativeResponse(BaseModel):
    proveedor: str = "Google Gemini"
    modelo: str
    formato: str
    mime_type: str
    imagen_base64: str
    ancho: int
    alto: int
    texto: str
    brief: str
    advertencia: str = "Contenido generado con IA. Revisa texto, precios y composición antes de publicar."


def build_brief(payload: CreativeRequest) -> str:
    return (
        "Crea UNA fotografía publicitaria gastronómica vertical para Parrilladas El Establo. "
        f"Relación de aspecto {payload.formato}. Es una pieza final para redes sociales, no un mockup "
        "de pantalla, collage, logotipo aislado ni ilustración. Fotografía realista de alta calidad, "
        "texturas apetecibles, iluminación cálida de restaurante, fuego y parrilla cuando corresponda. "
        "Identidad visual: vino profundo #7F011F, arena #F5EBD0 y acentos dorados #C9A25A; "
        "marca elegante, cercana y artesanal. Composición con jerarquía clara y zona segura "
        "del 12% arriba y abajo para interfaces de Stories. Respeta la intención del siguiente brief. "
        "No inventes precios, descuentos, disponibilidad, direcciones, premios ni métricas. "
        "No uses marcas de terceros ni afirmes que una fotografía generada es una foto real del local.\n\n"
        f"BRIEF DEL USUARIO:\n{payload.prompt}\n\n"
        f"TEXTO EXACTO DEL ANUNCIO: {payload.texto_publicitario or 'Sin texto superpuesto; priorizar la fotografía.'}\n"
        f"LLAMADA A LA ACCIÓN: {payload.llamada_accion or 'Sin llamada a la acción superpuesta.'}\n"
        "Si agregas texto, debe estar en español, ser legible y mantener los datos exactos indicados. "
        "Entrega la imagen, no solo una descripción."
    )


def image_dimensions(data: bytes, mime: str) -> tuple[int, int]:
    """Lee las dimensiones del archivo, no deduce el formato a partir del CSS."""
    if mime == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        return struct.unpack(">II", data[16:24])
    if mime == "image/jpeg" and data.startswith(b"\xff\xd8"):
        pos = 2
        while pos + 4 < len(data):
            if data[pos] != 255:
                pos += 1
                continue
            while pos < len(data) and data[pos] == 255:
                pos += 1
            if pos >= len(data):
                break
            marker = data[pos]
            pos += 1
            if marker in (0xD8, 0xD9) or 0xD0 <= marker <= 0xD7:
                continue
            if pos + 2 > len(data):
                break
            length = int.from_bytes(data[pos:pos + 2], "big")
            if length < 2 or pos + length > len(data):
                break
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF) and length >= 7:
                height, width = struct.unpack(">HH", data[pos + 3:pos + 7])
                return width, height
            pos += length
    if mime == "image/webp" and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        if data[12:16] == b"VP8X" and len(data) >= 30:
            return 1 + int.from_bytes(data[24:27], "little"), 1 + int.from_bytes(data[27:30], "little")
        if data[12:16] == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
            bits = int.from_bytes(data[21:25], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if data[12:16] == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
            return int.from_bytes(data[26:28], "little") & 0x3FFF, int.from_bytes(data[28:30], "little") & 0x3FFF
    raise HTTPException(502, "Google devolvió una imagen sin dimensiones reconocibles. No se mostrará una pieza de formato desconocido.")


@router.get("/configuracion")
async def configuracion():
    return {
        "proveedor": "Google Gemini", "configurado": bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip()),
        "modelo": settings.GEMINI_IMAGE_MODEL, "formatos": ["9:16", "4:5"],
        "pomelli_url": POMELLI_URL,
        "pomelli_integracion": "externa_manual",
        "nota": "La generación dentro de la app usa GEMINI_API_KEY de Google AI Studio. Pomelli requiere acceso propio y no usa esta clave.",
    }


async def request_google(payload: CreativeRequest, brief: str) -> dict:
    model = settings.GEMINI_IMAGE_MODEL
    if not re.fullmatch(r"[a-zA-Z0-9._-]{1,100}", model):
        raise HTTPException(503, "GEMINI_IMAGE_MODEL no es un identificador válido.")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = {
        "contents": [{"parts": [{"text": brief}]}],
        "generationConfig": {
            "responseModalities": ["TEXT", "IMAGE"],
            "imageConfig": {"aspectRatio": payload.formato},
        },
    }
    try:
        # Sin reintentos automáticos: cada generación puede tener coste.
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=15.0), follow_redirects=False) as client:
            async with client.stream("POST", url, headers={"x-goog-api-key": settings.GEMINI_API_KEY}, json=body) as response:
                if response.status_code != 200:
                    if response.status_code in (401, 403):
                        raise HTTPException(502, "Google rechazó la clave o los permisos. Revisa GEMINI_API_KEY y el acceso al modelo en AI Studio.")
                    if response.status_code == 429:
                        raise HTTPException(429, "Google alcanzó la cuota o límite de solicitudes. Revisa facturación/cuota; no se reintentó automáticamente.")
                    if response.status_code in (400, 404):
                        raise HTTPException(502, "Google no pudo procesar la petición o el modelo configurado no está disponible. Revisa GEMINI_IMAGE_MODEL y su compatibilidad con imágenes.")
                    raise HTTPException(502, "El servicio de imágenes de Google devolvió un error. No se generó un resultado local simulado.")
                raw = bytearray()
                async for chunk in response.aiter_bytes():
                    raw.extend(chunk)
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise HTTPException(502, "La imagen devuelta supera el límite de tamaño permitido.")
        return json.loads(raw)
    except httpx.TimeoutException:
        raise HTTPException(504, "Google tardó demasiado. Antes de reintentar revisa tu cuota: la solicitud anterior podría haberse procesado.") from None
    except httpx.HTTPError:
        raise HTTPException(502, "No fue posible conectar con Google. Revisa la conexión del backend.") from None
    except (ValueError, UnicodeDecodeError):
        raise HTTPException(502, "Google devolvió una respuesta no válida.") from None


@router.post("/generar", response_model=CreativeResponse)
async def generar(payload: CreativeRequest):
    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        raise HTTPException(503, "Configura GEMINI_API_KEY en backend/.env con una clave de Google AI Studio y reinicia el backend. La app no genera fotografías sin esa credencial.")
    if _generation_lock.locked():
        raise HTTPException(429, "Hay otra fotografía en generación. Espera a que termine antes de enviar otra solicitud.")
    async with _generation_lock:
        brief = build_brief(payload)
        result = await request_google(payload, brief)
    if not isinstance(result, dict):
        raise HTTPException(502, "Google devolvió una respuesta inesperada.")
    candidates = result.get("candidates") or []
    if not isinstance(candidates, list):
        raise HTTPException(502, "Google devolvió candidatos de imagen no válidos.")
    texts: list[str] = []
    for candidate in candidates:
        if not isinstance(candidate, dict) or not isinstance(candidate.get("content", {}), dict):
            raise HTTPException(502, "Google devolvió un candidato de imagen no válido.")
        parts = (candidate.get("content") or {}).get("parts") or []
        if not isinstance(parts, list):
            raise HTTPException(502, "Google devolvió partes de imagen no válidas.")
        for part in parts:
            if not isinstance(part, dict):
                raise HTTPException(502, "Google devolvió una parte de imagen no válida.")
            if part.get("thought"):
                continue  # No mostrar imágenes de razonamiento/borradores como resultado final.
            if isinstance(part.get("text"), str):
                texts.append(part["text"])
            image = part.get("inlineData") or part.get("inline_data")
            if not isinstance(image, dict):
                continue
            mime = image.get("mimeType") or image.get("mime_type")
            encoded = image.get("data")
            if mime not in ("image/png", "image/jpeg", "image/webp") or not isinstance(encoded, str):
                continue
            try:
                data = base64.b64decode(encoded, validate=True)
            except (binascii.Error, ValueError):
                raise HTTPException(502, "La imagen recibida de Google está dañada.") from None
            width, height = image_dimensions(data, mime)
            target = 9 / 16 if payload.formato == "9:16" else 4 / 5
            if width <= 0 or height <= width or abs(width / height - target) > 0.035:
                raise HTTPException(502, "Google no respetó el formato vertical solicitado. No se recortó ni se presentó una imagen cuadrada como fotografía vertical; puedes ajustar el brief y generar otra.")
            return CreativeResponse(
                modelo=settings.GEMINI_IMAGE_MODEL, formato=payload.formato, mime_type=mime,
                imagen_base64=encoded, ancho=width, alto=height,
                texto="\n".join(texts), brief=brief,
            )
    raise HTTPException(422, "Google no devolvió una imagen (posible filtro de seguridad o respuesta solo de texto). Ajusta el prompt; no se sustituyó por una imagen de ejemplo.")
