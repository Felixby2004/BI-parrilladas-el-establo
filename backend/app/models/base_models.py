"""
MODELOS BASE - PARRILLADAS EL ESTABLO
======================================
Tablas iniciales para validar la conexión con la BD.
Basados estrictamente en el esquema BD_parrilla.sql.

Tablas incluidas en este archivo:
  - tipos_buyer
  - productos
  - buyers

El resto de modelos se agregarán fase por fase.
"""

from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Integer, String, Text, Boolean, Numeric,
    DateTime, Date, ForeignKey, Enum as SAEnum,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base

class Personal(Base):
    """Personal asignable a las comandas (catálogo mínimo)."""
    __tablename__ = "personal"

    id_personal: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# =============================================================
# 1. TIPOS_BUYER
#    Catálogo de los tipos de buyer persona que maneja el negocio
# =============================================================
class TipoBuyer(Base):
    __tablename__ = "tipos_buyer"

    id_tipo_buyer: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relación hacia buyer_personas (se completa en fases posteriores)
    # buyer_personas: Mapped[list["BuyerPersona"]] = relationship(back_populates="tipo_buyer")

    def __repr__(self) -> str:
        return f"<TipoBuyer id={self.id_tipo_buyer} nombre='{self.nombre}'>"


# =============================================================
# 2. PRODUCTOS
#    Catálogo maestro de productos del restaurante
# =============================================================
class Producto(Base):
    __tablename__ = "productos"

    id_producto: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    categoria: Mapped[Optional[str]] = mapped_column(
        # Categorías base: parrilla, bebida, entrada, postre, guarnicion, otro
        String(50), nullable=True
    )
    precio_base: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, default=Decimal("0.00")
    )
    imagen_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    disponible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<Producto id={self.id_producto} nombre='{self.nombre}' precio={self.precio_base}>"


# =============================================================
# 3. BUYERS
#    Contactos captados en campañas (tope del embudo IMPULSE)
# =============================================================
class Buyer(Base):
    __tablename__ = "buyers"

    id_buyer: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    # Datos de identificación
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    apellido: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    telefono: Mapped[Optional[str]] = mapped_column(String(30), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)

    # Canal de captación
    canal_captacion: Mapped[Optional[str]] = mapped_column(
        # whatsapp | facebook | instagram | web | referido | otro
        String(50), nullable=True
    )
    utm_source: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_medium: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    utm_campaign: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Clasificación
    id_tipo_buyer: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("tipos_buyer.id_tipo_buyer", ondelete="SET NULL"), nullable=True
    )

    # Estado en el embudo IMPULSE
    # buyer | lead | payer | customer | turned
    etapa_impulse: Mapped[str] = mapped_column(
        String(20), nullable=False, default="buyer"
    )

    # Control
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notas: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    fecha_primer_contacto: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relaciones
    tipo_buyer: Mapped[Optional["TipoBuyer"]] = relationship(
        "TipoBuyer", lazy="selectin"
    )

    def __repr__(self) -> str:
        return (
            f"<Buyer id={self.id_buyer} nombre='{self.nombre}' "
            f"etapa='{self.etapa_impulse}'>"
        )
