"""
SCHEMAS PYDANTIC — FASE CUSTOMERS
"""
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


# ─── SERVICIO (Comanda) ─────────────────────────────────────
EstadoServicio = Literal["en_espera", "preparando", "servido", "finalizado", "cancelado"]
PrioridadServicio = Literal["normal", "urgente", "vip"]


class ServicioDetalleCreate(BaseModel):
    id_detalle_pedido: Optional[int] = None
    nombre_item: str
    cantidad: int = Field(1, ge=1)
    termino_coccion: Optional[str] = None
    prioridad: int = 1
    notas_cocina: Optional[str] = None
    tiempo_preparacion_min: Optional[int] = None


class ServicioDetalleRead(ServicioDetalleCreate):
    model_config = ConfigDict(from_attributes=True)
    id_servicio_detalle: int
    id_servicio: int
    estado_item: str
    created_at: datetime
    updated_at: datetime


class ServicioCreate(BaseModel):
    id_payer: int
    id_mesa: Optional[int] = None
    prioridad: PrioridadServicio = "normal"
    notas_cocina: Optional[str] = None
    detalles: list[ServicioDetalleCreate] = Field(..., min_length=1)


class ServicioUpdate(BaseModel):
    estado: Optional[EstadoServicio] = None
    id_mesa: Optional[int] = None
    prioridad: Optional[PrioridadServicio] = None
    notas_cocina: Optional[str] = None


class ServicioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_servicio: int
    id_payer: int
    id_mesa: Optional[int]
    estado: str
    prioridad: str
    hora_inicio: Optional[datetime]
    hora_fin: Optional[datetime]
    notas_cocina: Optional[str]
    created_at: datetime
    updated_at: datetime
    detalles: list[ServicioDetalleRead] = []
    mesa_numero: Optional[str] = None


class ActualizarItemEstado(BaseModel):
    estado_item: Literal["pendiente", "preparando", "listo", "entregado", "cancelado"]


# ─── ALERTAS ────────────────────────────────────────────────
class AlertaCreate(BaseModel):
    id_servicio: int
    tipo_alerta: Literal[
        "tiempo_espera", "pedido_adicional", "incidencia", "vip_mesa", "demora_cocina"
    ]
    descripcion: str
    nivel: Literal["info", "warning", "critical"] = "info"


class AlertaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_alerta: int
    id_servicio: int
    tipo_alerta: str
    descripcion: str
    nivel: str
    atendida: bool
    created_at: datetime


# ─── RESEÑAS ────────────────────────────────────────────────
class ResenaCreate(BaseModel):
    id_servicio: int
    id_buyer: Optional[int] = None
    calificacion_general: int = Field(..., ge=1, le=5)
    calificacion_comida: Optional[int] = Field(None, ge=1, le=5)
    calificacion_servicio: Optional[int] = Field(None, ge=1, le=5)
    calificacion_ambiente: Optional[int] = Field(None, ge=1, le=5)
    calificacion_precio: Optional[int] = Field(None, ge=1, le=5)
    comentario: Optional[str] = None
    recomendaria: Optional[bool] = None


class ResenaRead(ResenaCreate):
    model_config = ConfigDict(from_attributes=True)
    id_resena: int
    publicar: bool
    created_at: datetime


# ─── VISTA COCINA ────────────────────────────────────────────
class ComandaCocinaRead(BaseModel):
    """Vista simplificada para la pantalla de cocina."""
    id_servicio: int
    mesa_numero: Optional[str]
    prioridad: str
    estado: str
    tiempo_espera_min: Optional[int]
    items: list[ServicioDetalleRead]
    created_at: datetime
