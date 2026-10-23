# app/models/__init__.py — REGISTRO COMPLETO DE MODELOS
from app.models.base_models     import TipoBuyer, Producto, Buyer, Personal
from app.models.buyers_models   import BuyerPersona, Campana, Anuncio, FormularioCaptacion, Lead
from app.models.leads_models    import PerfilGustos, PerfilReserva, NegociacionLead, Pedido, DetallePedido, Pago
from app.models.payers_models   import Mesa, Payer, InstruccionPago, Comprobante
from app.models.customers_models import Servicio, ServicioDetalle, AlertaConsumo, ResenaServicio
from app.models.hermes_models import HermesMensaje

__all__ = [
    # Base
    "TipoBuyer", "Producto", "Buyer", "Personal",
    # Buyers
    "BuyerPersona", "Campana", "Anuncio", "FormularioCaptacion", "Lead",
    # Leads
    "PerfilGustos", "PerfilReserva", "NegociacionLead", "Pedido", "DetallePedido", "Pago",
    # Payers
    "Mesa", "Payer", "InstruccionPago", "Comprobante",
    # Customers
    "Servicio", "ServicioDetalle", "AlertaConsumo", "ResenaServicio",
    "HermesMensaje",
]
