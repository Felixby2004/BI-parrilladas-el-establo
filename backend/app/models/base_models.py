"""Modelos canónicos: catálogos base y buyers.

Los nombres de atributo coinciden con el DTO que consume el frontend; el
nombre de columna apunta al esquema canónico de SQL Server. Así el contrato
JSON no cambia y los routers no necesitan saber cómo se llama la columna.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class AreaEmpresa(Base):
    __tablename__ = "area_empresa"

    id_area: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class RedSocial(Base):
    __tablename__ = "redes_sociales"

    id_red_social: Mapped[int] = mapped_column(Integer, primary_key=True)
    plataforma: Mapped[str] = mapped_column(String(30), nullable=False)
    nombre_pagina: Mapped[str] = mapped_column(String(150), nullable=False)
    url_pagina: Mapped[str] = mapped_column(Text, nullable=False)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Personal(Base):
    __tablename__ = "personal"

    id_personal: Mapped[int] = mapped_column(Integer, primary_key=True)
    id_area: Mapped[int] = mapped_column(Integer, ForeignKey("area_empresa.id_area"), nullable=False)
    nombres: Mapped[str] = mapped_column(String(100), nullable=False)
    apellidos: Mapped[str] = mapped_column(String(100), nullable=False)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    fecha_ingreso: Mapped[date] = mapped_column(Date, nullable=False)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def nombre(self) -> str:
        return f"{self.nombres} {self.apellidos}".strip()

    @property
    def activo(self) -> bool:
        return self.estado_activo


class TipoBuyer(Base):
    __tablename__ = "tipos_buyer"

    id_tipo_buyer: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String(250), nullable=True)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    @property
    def activo(self) -> bool:
        return self.estado_activo

    @property
    def created_at(self) -> datetime:
        return datetime.utcnow()

    @property
    def updated_at(self) -> datetime:
        return datetime.utcnow()


class Producto(Base):
    __tablename__ = "productos"

    id_producto: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    categoria: Mapped[str] = mapped_column(String(30), nullable=False)
    precio_base: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))
    es_gancho_promocional: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    estado_activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    imagen_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    @property
    def disponible(self) -> bool:
        return self.estado_activo

    @disponible.setter
    def disponible(self, value: bool) -> None:
        self.estado_activo = value


class Buyer(Base):
    __tablename__ = "buyers"

    id_buyer: Mapped[UUID] = mapped_column(
        primary_key=True, index=True, server_default=text("gen_random_uuid()")
    )
    id_persona: Mapped[Optional[UUID]] = mapped_column(ForeignKey("buyer_personas.id_persona"), nullable=True)
    id_anuncio_origen: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("anuncios.id_anuncio"), nullable=True
    )
    id_red_social_origen: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("redes_sociales.id_red_social"), nullable=True
    )
    canal_captacion: Mapped[str] = mapped_column("canal_origen", String(30), nullable=False, default="OTRO")
    estado_buyer: Mapped[str] = mapped_column(String(30), nullable=False, default="ACTIVO")

    # Extensiones de la app
    etapa_impulse: Mapped[str] = mapped_column(String(20), nullable=False, default="buyer")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_primer_contacto: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    persona: Mapped[Optional["BuyerPersona"]] = relationship(  # type: ignore[name-defined]
        "BuyerPersona", lazy="selectin", foreign_keys=[id_persona]
    )

    # Datos de identidad que viven en buyer_personas
    @property
    def nombre(self) -> Optional[str]:
        return self.persona.nombre if self.persona else None

    @nombre.setter
    def nombre(self, value: Optional[str]) -> None:
        self._set_persona(nombre=value)

    @property
    def apellido(self) -> Optional[str]:
        return self.persona.apellido if self.persona else None

    @apellido.setter
    def apellido(self, value: Optional[str]) -> None:
        self._set_persona(apellido=value)

    @property
    def telefono(self) -> Optional[str]:
        return self.persona.telefono if self.persona else None

    @telefono.setter
    def telefono(self, value: Optional[str]) -> None:
        self._set_persona(telefono=value)

    @property
    def email(self) -> Optional[str]:
        return self.persona.email if self.persona else None

    @email.setter
    def email(self, value: Optional[str]) -> None:
        self._set_persona(email=value)

    @property
    def id_tipo_buyer(self) -> Optional[int]:
        return self.persona.id_tipo_buyer if self.persona else None

    def _set_persona(self, **values: object) -> None:
        if self.persona is None:
            from app.models.buyers_models import BuyerPersona

            self.persona = BuyerPersona(**values)  # type: ignore[arg-type]
        else:
            for key, value in values.items():
                setattr(self.persona, key, value)
