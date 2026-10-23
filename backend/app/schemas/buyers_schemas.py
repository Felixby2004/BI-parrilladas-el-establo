"""
SCHEMAS PYDANTIC - FASE BUYERS/LEADS
======================================
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from uuid import UUID


# ─────────────────────────────────────────
# TIPOS_BUYER (lectura)
# ─────────────────────────────────────────
class TipoBuyerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_tipo_buyer: int
    nombre: str
    descripcion: Optional[str] = None
    activo: bool


# ─────────────────────────────────────────
# BUYER_PERSONAS
# ─────────────────────────────────────────
class BuyerPersonaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=150)
    descripcion: Optional[str] = None
    edad_min: Optional[int] = Field(None, ge=0, le=120)
    edad_max: Optional[int] = Field(None, ge=0, le=120)
    intereses: Optional[str] = None
    motivaciones: Optional[str] = None
    canales_preferidos: Optional[str] = None
    id_tipo_buyer: Optional[int] = None
    activo: bool = True


class BuyerPersonaCreate(BuyerPersonaBase):
    pass


class BuyerPersonaUpdate(BuyerPersonaBase):
    nombre: Optional[str] = None


class BuyerPersonaRead(BuyerPersonaBase):
    model_config = ConfigDict(from_attributes=True)
    id_buyer_persona: UUID
    created_at: datetime
    updated_at: datetime
    tipo_buyer: Optional[TipoBuyerRead] = None


# ─────────────────────────────────────────
# CAMPANAS
# ─────────────────────────────────────────
EstadoCampana = Literal["borrador", "activa", "pausada", "finalizada"]


class CampanaBase(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=200)
    descripcion: Optional[str] = None
    objetivo: Optional[Literal["captacion", "branding", "retargeting", "reactivacion"]] = None
    presupuesto_total: Optional[Decimal] = Field(None, ge=0)
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: EstadoCampana = "borrador"
    id_buyer_persona: Optional[UUID] = None


class CampanaCreate(CampanaBase):
    pass


class CampanaUpdate(CampanaBase):
    nombre: Optional[str] = None


class CampanaRead(CampanaBase):
    model_config = ConfigDict(from_attributes=True)
    id_campana: int
    presupuesto_gastado: Decimal
    created_at: datetime
    updated_at: datetime
    buyer_persona: Optional[BuyerPersonaRead] = None


# ─────────────────────────────────────────
# ANUNCIOS
# ─────────────────────────────────────────
PlataformaAnuncio = Literal["facebook", "instagram", "google", "tiktok", "whatsapp", "otro"]
EstadoAnuncio = Literal["borrador", "activo", "pausado", "archivado"]


class AnuncioBase(BaseModel):
    id_campana: int
    titulo: str = Field(..., min_length=2, max_length=200)
    copy_texto: Optional[str] = None
    imagen_url: Optional[str] = None
    plataforma: Optional[PlataformaAnuncio] = None
    url_destino: Optional[str] = None
    estado: EstadoAnuncio = "borrador"


class AnuncioCreate(AnuncioBase):
    pass


class AnuncioUpdate(AnuncioBase):
    id_campana: Optional[int] = None
    titulo: Optional[str] = None


class AnuncioRead(AnuncioBase):
    model_config = ConfigDict(from_attributes=True)
    id_anuncio: int
    impresiones: int
    clics: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# BUYERS
# ─────────────────────────────────────────
class BuyerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_buyer: UUID
    nombre: str
    apellido: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    canal_captacion: Optional[str] = None
    etapa_impulse: str
    activo: bool
    created_at: datetime


# ─────────────────────────────────────────
# FORMULARIO CAPTACION (Form público)
# ─────────────────────────────────────────
class FormularioCaptacionCreate(BaseModel):
    """Payload del formulario público — NO requiere autenticación."""
    nombre: str = Field(..., min_length=2, max_length=150, examples=["Juan Pérez"])
    telefono: str = Field(..., min_length=7, max_length=30, examples=["+5491112345678"])
    email: Optional[EmailStr] = Field(None, max_length=150, examples=["juan@correo.com"])
    interes: Literal["reserva", "informacion", "evento", "otro"] = "informacion"
    mensaje: Optional[str] = Field(None, max_length=1000)
    personas_aproximadas: Optional[int] = Field(None, ge=1, le=500)
    fecha_preferida: Optional[date] = None
    canal: Optional[str] = Field(None, max_length=50)
    utm_source: Optional[str] = Field(None, max_length=100)
    utm_medium: Optional[str] = Field(None, max_length=100)
    utm_campaign: Optional[str] = Field(None, max_length=100)

    @field_validator("email", mode="before")
    @classmethod
    def limpiar_email(cls, value):
        return value.strip() or None if isinstance(value, str) else value

    @field_validator("nombre", "telefono", mode="before")
    @classmethod
    def limpiar_obligatorios(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("nombre")
    @classmethod
    def validar_nombre_buyer(cls, value: str) -> str:
        if any(len(part) > 100 for part in value.split(" ", 1)):
            raise ValueError("Nombre y apellido deben tener como máximo 100 caracteres cada uno")
        return value


class FormularioCaptacionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_formulario: UUID
    id_buyer: Optional[UUID]
    id_lead: Optional[UUID]
    mensaje: str = "¡Gracias! Nos pondremos en contacto contigo pronto."


class FormularioCaptacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_formulario: UUID
    nombre: str
    telefono: Optional[str]
    email: Optional[str]
    interes: Optional[str]
    mensaje: Optional[str]
    personas_aproximadas: Optional[int]
    fecha_preferida: Optional[date]
    canal: Optional[str]
    procesado: bool
    fecha_captacion: datetime
    buyer: Optional[BuyerRead] = None


# ─────────────────────────────────────────
# LEADS
# ─────────────────────────────────────────
EstadoLead = Literal["nuevo", "contactado", "respondio", "ganado", "perdido"]


class LeadBase(BaseModel):
    id_buyer: UUID
    id_campana: Optional[int] = None
    estado: EstadoLead = "nuevo"
    interes_confirmado: Optional[Literal["reserva", "evento", "consulta", "otro"]] = None
    personas_estimadas: Optional[int] = Field(None, ge=1)
    fecha_preferida: Optional[date] = None
    presupuesto_estimado: Optional[Decimal] = Field(None, ge=0)
    notas: Optional[str] = None
    motivo_perdida: Optional[str] = None


class LeadCreate(LeadBase):
    pass


class LeadUpdateEstado(BaseModel):
    """Mover tarjeta en el Kanban."""
    estado: EstadoLead
    notas: Optional[str] = None
    motivo_perdida: Optional[str] = None


class LeadUpdate(LeadBase):
    id_buyer: Optional[UUID] = None


class LeadRead(LeadBase):
    # Compatibilidad con formularios históricos guardados antes de normalizar.
    interes_confirmado: Optional[Literal["reserva", "evento", "consulta", "informacion", "otro"]] = None
    model_config = ConfigDict(from_attributes=True)
    id_lead: UUID
    id_formulario: Optional[UUID]
    fecha_contacto: Optional[datetime]
    fecha_respuesta: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    buyer: Optional[BuyerRead] = None
    campana: Optional[CampanaRead] = None


class LeadKanbanRead(BaseModel):
    """Vista resumida para las tarjetas Kanban."""
    model_config = ConfigDict(from_attributes=True)
    id_lead: UUID
    estado: str
    interes_confirmado: Optional[str]
    personas_estimadas: Optional[int]
    fecha_preferida: Optional[date]
    presupuesto_estimado: Optional[Decimal]
    notas: Optional[str]
    created_at: datetime
    buyer_nombre: Optional[str] = None
    buyer_telefono: Optional[str] = None
    buyer_email: Optional[str] = None
    buyer_canal: Optional[str] = None
    campana_nombre: Optional[str] = None


# ─────────────────────────────────────────
# STATS / DASHBOARD
# ─────────────────────────────────────────
class KanbanStats(BaseModel):
    nuevo: int = 0
    contactado: int = 0
    respondio: int = 0
    ganado: int = 0
    perdido: int = 0
    total: int = 0
