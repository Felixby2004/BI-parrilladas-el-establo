"""Modelos canónicos: personas, campañas, anuncios, formularios y leads."""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class BuyerPersona(Base):
    __tablename__ = "buyer_personas"

    id_buyer_persona: Mapped[UUID] = mapped_column(
        "id_persona", primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_tipo_buyer: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tipos_buyer.id_tipo_buyer"), nullable=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    apellido: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column("correo", String(150), nullable=True)

    # Extensiones de la app
    descripcion: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    edad_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    edad_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    intereses: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivaciones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    canales_preferidos: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    tipo_buyer: Mapped[Optional["TipoBuyer"]] = relationship("TipoBuyer", lazy="selectin")  # type: ignore[name-defined]
    campanas: Mapped[list["Campana"]] = relationship("Campana", back_populates="buyer_persona")


class Campana(Base):
    __tablename__ = "campanas"

    id_campana: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_red_social: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("redes_sociales.id_red_social"), nullable=True
    )
    id_tipo_buyer_objetivo: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    fuente_utm: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    fecha_inicio: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    fecha_fin: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Extensiones de la app
    descripcion: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    objetivo: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    presupuesto_total: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    presupuesto_gastado: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    id_buyer_persona: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("buyer_personas.id_persona"), nullable=True
    )
    estado: Mapped[str] = mapped_column("estado_impulse", String(20), nullable=False, default="borrador")
    created_at: Mapped[datetime] = mapped_column("fecha_creacion", DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    buyer_persona: Mapped[Optional["BuyerPersona"]] = relationship(
        "BuyerPersona", back_populates="campanas", foreign_keys=[id_buyer_persona]
    )
    anuncios: Mapped[list["Anuncio"]] = relationship("Anuncio", back_populates="campana")
    leads: Mapped[list["Lead"]] = relationship("Lead", back_populates="campana")


class Anuncio(Base):
    __tablename__ = "anuncios"

    id_anuncio: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    id_campana: Mapped[int] = mapped_column(
        Integer, ForeignKey("campanas.id_campana", ondelete="CASCADE"), nullable=False, index=True
    )
    titulo: Mapped[str] = mapped_column("nombre", String(200), nullable=False)
    copy_texto: Mapped[Optional[str]] = mapped_column("texto_cta", Text, nullable=True)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Extensiones de la app
    imagen_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plataforma: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    url_destino: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    estado: Mapped[str] = mapped_column("estado_impulse", String(20), nullable=False, default="borrador")
    impresiones: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    clics: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    campana: Mapped["Campana"] = relationship("Campana", back_populates="anuncios")


class FormularioCaptacion(Base):
    __tablename__ = "formularios_captacion"

    id_formulario: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_buyer: Mapped[UUID] = mapped_column(ForeignKey("buyers.id_buyer"), nullable=False, index=True)
    nombre: Mapped[Optional[str]] = mapped_column("nombre_ingresado", String(150), nullable=True)
    telefono: Mapped[str] = mapped_column("telefono_ingresado", String(20), nullable=False)
    telefono_es_valido: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consentimiento_datos_otorgado: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    interes: Mapped[Optional[str]] = mapped_column("interes_declarado", String(50), nullable=True)
    fecha_captacion: Mapped[datetime] = mapped_column("fecha_envio", DateTime, server_default=func.now(), nullable=False)

    # Extensiones de la app
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    mensaje: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    personas_aproximadas: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_preferida: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    canal: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    procesado: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    buyer: Mapped[Optional["Buyer"]] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]


class Lead(Base):
    __tablename__ = "leads"

    id_lead: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_buyer: Mapped[UUID] = mapped_column(ForeignKey("buyers.id_buyer"), nullable=False, index=True)
    id_campana: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("campanas.id_campana"), nullable=True
    )
    id_formulario: Mapped[Optional[UUID]] = mapped_column(
        ForeignKey("formularios_captacion.id_formulario"), nullable=True
    )
    interes_principal: Mapped[str] = mapped_column(String(50), nullable=False, default="OTRO")
    fecha_contacto: Mapped[Optional[datetime]] = mapped_column(
        "fecha_calificacion", DateTime, server_default=func.now(), nullable=False
    )

    # Extensiones de la app
    interes_confirmado: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="nuevo", index=True)
    personas_estimadas: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fecha_preferida: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    presupuesto_estimado: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    motivo_perdida: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_respuesta: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    buyer: Mapped["Buyer"] = relationship("Buyer", lazy="selectin")  # type: ignore[name-defined]
    campana: Mapped[Optional["Campana"]] = relationship("Campana", back_populates="leads", lazy="selectin")
