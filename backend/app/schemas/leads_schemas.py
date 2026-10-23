"""
SCHEMAS PYDANTIC - FASE LEADS/NEGOCIACIÓN
==========================================
"""
from datetime import datetime, date, time
from decimal import Decimal
from typing import Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


# ─────────────────────────────────────────
# PERFIL_GUSTOS
# ─────────────────────────────────────────
class PerfilGustosBase(BaseModel):
    id_lead: int
    tipos_corte_preferidos: Optional[str] = None
    termino_coccion: Optional[Literal[
        "ingles", "tres_cuartos", "bien_cocido", "a_punto", "no_aplica"
    ]] = None
    bebidas_preferidas: Optional[str] = None
    entradas_preferidas: Optional[str] = None
    guarniciones_preferidas: Optional[str] = None
    postres_preferidos: Optional[str] = None
    alergias: Optional[str] = None
    restricciones_dieteticas: Optional[str] = None
    presupuesto_por_persona: Optional[Decimal] = Field(None, ge=0)
    notas_adicionales: Optional[str] = None


class PerfilGustosCreate(PerfilGustosBase):
    pass


class PerfilGustosUpdate(PerfilGustosBase):
    id_lead: Optional[int] = None


class PerfilGustosRead(PerfilGustosBase):
    model_config = ConfigDict(from_attributes=True)
    id_perfil_gustos: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# PERFIL_RESERVA
# ─────────────────────────────────────────
OcasionEspecial = Literal["cumpleanos", "aniversario", "empresa", "ninguna", "otro"]
EstadoReserva = Literal["tentativa", "confirmada", "cancelada"]


class PerfilReservaBase(BaseModel):
    id_lead: int
    fecha_reserva: Optional[date] = None
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    numero_personas: Optional[int] = Field(None, ge=1)
    numero_adultos: Optional[int] = Field(None, ge=0)
    numero_ninos: Optional[int] = Field(None, ge=0)
    ocasion_especial: Optional[OcasionEspecial] = None
    nombre_festejado: Optional[str] = None
    requiere_decoracion: bool = False
    requiere_musica: bool = False
    requiere_pastel: bool = False
    peticiones_especiales: Optional[str] = None
    estado_reserva: EstadoReserva = "tentativa"


class PerfilReservaCreate(PerfilReservaBase):
    pass


class PerfilReservaUpdate(PerfilReservaBase):
    id_lead: Optional[int] = None


class PerfilReservaRead(PerfilReservaBase):
    model_config = ConfigDict(from_attributes=True)
    id_perfil_reserva: int
    created_at: datetime
    updated_at: datetime


# ─────────────────────────────────────────
# NEGOCIACION_LEADS (Chat)
# ─────────────────────────────────────────
RemitenteChat = Literal["bot", "agente", "cliente"]
TipoMensaje = Literal["texto", "sugerencia", "pedido", "pago", "sistema"]


class NegociacionCreate(BaseModel):
    id_lead: int
    remitente: RemitenteChat = "cliente"
    mensaje: str = Field(..., min_length=1)
    tipo_mensaje: TipoMensaje = "texto"
    metadata_json: Optional[str] = None


class NegociacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_negociacion: int
    id_lead: int
    remitente: str
    mensaje: str
    tipo_mensaje: Optional[str]
    leido: bool
    created_at: datetime


# ─────────────────────────────────────────
# DETALLE_PEDIDO
# ─────────────────────────────────────────
class DetallePedidoCreate(BaseModel):
    id_producto: Optional[int] = None
    nombre_producto: str = Field(..., min_length=1, max_length=200)
    categoria: Optional[str] = Field(None, max_length=50)
    cantidad: int = Field(1, ge=1)
    precio_unitario: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    termino_coccion: Optional[str] = None
    notas_especiales: Optional[str] = None


class DetallePedidoRead(DetallePedidoCreate):
    model_config = ConfigDict(from_attributes=True)
    id_detalle: int
    id_pedido: int
    subtotal: Decimal
    created_at: datetime


# ─────────────────────────────────────────
# PEDIDOS
# ─────────────────────────────────────────
EstadoPedido = Literal["borrador", "confirmado", "pagado_adelanto", "completado", "cancelado"]


class PedidoCreate(BaseModel):
    id_lead: int
    id_buyer: int
    tipo_pedido: Literal["reserva", "delivery", "salon"] = "reserva"
    notas: Optional[str] = None
    detalles: list[DetallePedidoCreate] = Field(..., min_length=1)


class PedidoUpdate(BaseModel):
    estado: Optional[EstadoPedido] = None
    notas: Optional[str] = None
    detalles: Optional[list[DetallePedidoCreate]] = Field(None, min_length=1)


class PedidoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_pedido: int
    id_lead: int
    id_buyer: int
    subtotal: Decimal
    descuento: Decimal
    total: Decimal
    estado: str
    tipo_pedido: Optional[str]
    notas: Optional[str]
    created_at: datetime
    updated_at: datetime
    detalles: list[DetallePedidoRead] = []


# ─────────────────────────────────────────
# PAGOS — Mercado Pago
# ─────────────────────────────────────────
class GenerarAdelanto(BaseModel):
    """Solicita generar un link de pago del 10% (o el % configurado)."""
    id_pedido: int
    porcentaje: Decimal = Field(Decimal("10.00"), ge=1, le=100)
    pagador_nombre: Optional[str] = None
    pagador_email: Optional[str] = None
    url_retorno: Optional[str] = "http://localhost:5173/leads"


class PagoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_pago: int
    id_pedido: int
    id_lead: int
    tipo_pago: str
    porcentaje: Optional[Decimal]
    monto: Decimal
    estado: str
    mp_preference_id: Optional[str]
    mp_payment_id: Optional[str]
    mp_status: Optional[str]
    mp_init_point: Optional[str]
    fecha_pago: Optional[datetime]
    created_at: datetime


class MercadoPagoPreferenceResponse(BaseModel):
    """Respuesta al crear la preferencia de pago."""
    id_pago: int
    preference_id: str
    init_point: str       # URL sandbox para redirigir al cliente
    monto_adelanto: Decimal
    total_pedido: Decimal
    mensaje: str


class WebhookMPPayload(BaseModel):
    """Payload que envía Mercado Pago al webhook."""
    id: Optional[int] = None
    type: Optional[str] = None
    action: Optional[str] = None
    data: Optional[dict] = None


# ─────────────────────────────────────────
# PERFIL 360 — Vista completa del lead
# ─────────────────────────────────────────
class Perfil360Read(BaseModel):
    """Vista consolidada para la pantalla de Perfil 360."""
    id_lead: int
    estado_lead: str

    # Datos del comprador
    buyer_nombre: Optional[str] = None
    buyer_telefono: Optional[str] = None
    buyer_email: Optional[str] = None
    buyer_canal: Optional[str] = None
    buyer_etapa: Optional[str] = None

    # Perfiles
    perfil_gustos: Optional[PerfilGustosRead] = None
    perfil_reserva: Optional[PerfilReservaRead] = None

    # Pedido activo
    pedido_activo: Optional[PedidoRead] = None

    # Pago de adelanto
    pago_adelanto: Optional[PagoRead] = None

    # Mensajes recientes (últimos 20)
    mensajes_recientes: list[NegociacionRead] = []
