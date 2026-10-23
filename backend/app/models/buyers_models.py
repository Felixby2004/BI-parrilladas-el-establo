"""
MODELOS FASE BUYERS/LEADS - PARRILLADAS EL ESTABLO
====================================================
Tablas: buyer_personas, campanas, anuncios,
        formularios_captacion, leads
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric,
    DateTime, Date, ForeignKey, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


# =============================================================
# 1. BUYER_PERSONAS — Arquetipos del cliente ideal
# =============================================================
class BuyerPersona(Base):
    __tablename__ = "buyer_personas"

    id_buyer_persona: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    edad_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    edad_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intereses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Canales preferidos (json-like string: facebook,instagram,whatsapp)
    canales_preferidos: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    id_tipo_buyer: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tipos_buyer.id_tipo_buyer", ondelete="SET NULL"), nullable=True
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tipo_buyer: Mapped[Optional["TipoBuyer"]] = relationship("TipoBuyer", lazy="selectin")  # type: ignore[name-defined]
    campanas: Mapped[list["Campana"]] = relationship("Campana", back_populates="buyer_persona")

    def __repr__(self) -> str:
        return f"<BuyerPersona id={self.id_buyer_persona} nombre='{self.nombre}'>"


# =============================================================
# 2. CAMPANAS — Campañas de marketing
# =============================================================
class Campana(Base):
    __tablename__ = "campanas"

    id_campana: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    objetivo: Mapped[Optional[str]] = mapped_column(
        # captacion | branding | retargeting | reactivacion
        String(50), nullable=True
    )
    presupuesto_total: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), nullable=True)
    presupuesto_gastado: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0.00")
    )
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado: Mapped[str] = mapped_column(
        # borrador | activa | pausada | finalizada
        String(20), nullable=False, default="borrador"
    )
    id_buyer_persona: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("buyer_personas.id_buyer_persona", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    buyer_persona: Mapped[Optional["BuyerPersona"]] = relationship(
        "BuyerPersona", back_populates="campanas"
    )
    anuncios: Mapped[list["Anuncio"]] = relationship("Anuncio", back_populates="campana")
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="campana")

    def __repr__(self) -> str:
        return f"<Campana id={self.id_campana} nombre='{self.nombre}' estado='{self.estado}'>"


# =============================================================
# 3. ANUNCIOS — Piezas creativas dentro de una campaña
# =============================================================
class Anuncio(Base):
    __tablename__ = "anuncios"

    id_anuncio: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_campana: Mapped[int] = mapped_column(
        Integer, ForeignKey("campanas.id_campana", ondelete="CASCADE"), nullable=False, index=True
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    copy_texto: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    plataforma: Mapped[Optional[str]] = mapped_column(
        # facebook | instagram | google | tiktok | whatsapp | otro
        String(50), nullable=True
    )
    url_destino: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    estado: Mapped[str] = mapped_column(
        # borrador | activo | pausado | archivado
        String(20), nullable=False, default="borrador"
    )
    impresiones: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clics: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    campana: Mapped["Campana"] = relationship("Campana", back_populates="anuncios")

    def __repr__(self) -> str:
        return f"<Anuncio id={self.id_anuncio} titulo='{self.titulo}'>"


# =============================================================
# 4. FORMULARIOS_CAPTACION — Submissions del form público
# =============================================================
class FormularioCaptacion(Base):
    __tablename__ = "formularios_captacion"

    id_formulario: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_buyer: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("buyers.id_buyer", ondelete="SET NULL"), nullable=True, index=True
    )
    # Datos del formulario (se copian para trazabilidad)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    interes: Mapped[Optional[str]] = mapped_column(
        # reserva | informacion | evento | otro
        String(50), nullable=True
    )
    mensaje: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    personas_aproximadas: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_preferida: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    canal: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    # UTMs para rastreo
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    procesado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fecha_captacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    buyer: Mapped[Optional["Buyer"]] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<FormularioCaptacion id={self.id_formulario} nombre='{self.nombre}'>"


# =============================================================
# 5. LEADS — Contactos con intención confirmada (Kanban)
# =============================================================
class Lead(Base):
    __tablename__ = "leads"

    id_lead: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_buyer: Mapped[int] = mapped_column(
        Integer, ForeignKey("buyers.id_buyer", ondelete="CASCADE"), nullable=False, index=True
    )
    id_campana: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("campanas.id_campana", ondelete="SET NULL"), nullable=True
    )
    id_formulario: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("formularios_captacion.id_formulario", ondelete="SET NULL"),
        nullable=True,
    )

    # Estado en el Kanban
    estado: Mapped[str] = mapped_column(
        # nuevo | contactado | respondio | ganado | perdido
        String(20), nullable=False, default="nuevo", index=True
    )

    # Datos de negocio
    interes_confirmado: Mapped[Optional[str]] = mapped_column(
        # reserva | evento | consulta | otro
        String(50), nullable=True
    )
    personas_estimadas: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_preferida: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    presupuesto_estimado: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivo_perdida: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Trazabilidad
    fecha_contacto: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    fecha_respuesta: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    buyer: Mapped["Buyer"] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]
    campana: Mapped[Optional["Campana"]] = relationship("Campana", back_populates="leads", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Lead id={self.id_lead} estado='{self.estado}'>"
