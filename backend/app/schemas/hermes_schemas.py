"""Contrato de recepción de texto Hermes (no envía WhatsApp)."""
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from uuid import UUID


def normalizar_telefono(value: str) -> str:
    value = value.strip()
    if not re.fullmatch(r"\+?[0-9 ()\-.]+", value):
        raise ValueError("Teléfono inválido; use código de país y dígitos ASCII")
    digits = re.sub(r"[^0-9]", "", value)
    if digits.startswith("00") and not value.startswith("+"):
        digits = digits[2:]
    if len(digits) == 9 and digits.startswith("9") and not value.startswith("+"):
        digits = "51" + digits  # Móvil local peruano.
    if not re.fullmatch(r"[1-9][0-9]{9,14}", digits):
        raise ValueError("Use teléfono internacional de 10 a 15 dígitos o móvil peruano de 9")
    return "+" + digits


class HermesMensajeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    mensaje: str = Field(min_length=1, max_length=4096)
    telefono: str = Field(min_length=1, max_length=40)
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    message_id: str = Field(min_length=1, max_length=255)
    direccion: Literal["entrante", "saliente"] = "entrante"
    remitente: Literal["cliente", "agente", "bot"] = "cliente"

    @field_validator("mensaje", "telefono", "nombre", "message_id")
    @classmethod
    def limpiar(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value or "\x00" in value:
            raise ValueError("No se admite contenido vacío ni caracteres NUL")
        return value

    @field_validator("telefono")
    @classmethod
    def telefono_normalizado(cls, value: str) -> str:
        return normalizar_telefono(value)

    @field_validator("message_id")
    @classmethod
    def identificador(cls, value: str) -> str:
        if any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value):
            raise ValueError("message_id no admite whitespace ni controles")
        return value

    @model_validator(mode="after")
    def validar_direccion(self):
        if self.direccion == "entrante" and self.remitente != "cliente":
            raise ValueError("Agente/bot requiere direccion saliente explícita")
        if self.direccion == "saliente" and self.remitente == "cliente":
            raise ValueError("La dirección saliente requiere remitente agente o bot")
        return self


class HermesMensajeRead(BaseModel):
    message_id: str
    duplicado: bool
    id_buyer: UUID
    id_lead: UUID
    id_negociacion: int
    created_at: datetime
