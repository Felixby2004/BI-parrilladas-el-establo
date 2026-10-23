"""
ROUTER: Pedidos — Creación y gestión
"""
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.database import get_db
from app.models.leads_models import Pedido, DetallePedido
from app.models.buyers_models import Lead
from app.models.base_models import Producto
from app.models.payers_models import Payer
from app.schemas.leads_schemas import (
    PedidoCreate, PedidoUpdate, PedidoRead,
)

router = APIRouter(prefix="/pedidos", tags=["📋 Pedidos"])




ESTADO_CANONICO = {
    "borrador": "PENDIENTE",
    "pendiente": "PENDIENTE",
    "confirmado": "PENDIENTE",
    "pagado_adelanto": "PENDIENTE",
    "completado": "ENTREGADO",
    "cancelado": "CANCELADO",
}


def _sincronizar_estado(pedido: Pedido) -> None:
    """Mantiene el estado canónico que consume el BI."""
    pedido.estado_pedido = ESTADO_CANONICO.get(pedido.estado, "PENDIENTE")
    pedido.tipo_consumo = "SALON" if (pedido.tipo_pedido or "").lower() == "salon" else None

def _calcular_totales(detalles_data: list) -> tuple[Decimal, Decimal]:
    """Calcula subtotal y total a partir de los detalles."""
    subtotal = Decimal("0.00")
    for d in detalles_data:
        precio = d.precio_unitario if hasattr(d, "precio_unitario") else Decimal(str(d["precio_unitario"]))
        cant = d.cantidad if hasattr(d, "cantidad") else d["cantidad"]
        subtotal += precio * cant
    if subtotal > Decimal("99999999.99"):
        raise HTTPException(422, "El total excede el importe máximo permitido")
    return subtotal, subtotal  # sin descuento por ahora


async def _validar_productos(detalles: list, db: AsyncSession) -> None:
    ids = {d.id_producto for d in detalles if d.id_producto is not None}
    if ids:
        result = await db.execute(select(Producto.id_producto).where(Producto.id_producto.in_(ids)))
        if ids - set(result.scalars().all()):
            raise HTTPException(404, "Producto no encontrado")


@router.get("", response_model=list[PedidoRead], summary="Listar pedidos")
async def listar_pedidos(
    id_lead: UUID | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .order_by(Pedido.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if id_lead:
        q = q.where(Pedido.id_lead == id_lead)
    result = await db.execute(q)
    return result.scalars().all()


@router.post(
    "",
    response_model=PedidoRead,
    status_code=status.HTTP_201_CREATED,
    summary="Crear pedido con detalles",
)
async def crear_pedido(payload: PedidoCreate, db: AsyncSession = Depends(get_db)):
    # Validar lead
    r = await db.execute(select(Lead).where(Lead.id_lead == payload.id_lead))
    lead = r.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead no encontrado")

    if lead.id_buyer != payload.id_buyer:
        raise HTTPException(422, "El buyer no corresponde al lead")
    await _validar_productos(payload.detalles, db)

    # Calcular montos
    subtotal, total = _calcular_totales(payload.detalles)

    # Crear pedido
    pedido = Pedido(
        id_lead=payload.id_lead,
        tipo_pedido=payload.tipo_pedido,
        notas=payload.notas,
        subtotal=subtotal,
        total=total,
        estado="borrador",
    )
    _sincronizar_estado(pedido)
    db.add(pedido)
    await db.flush()

    # Crear detalles
    for det in payload.detalles:
        subtotal_det = det.precio_unitario * det.cantidad
        detalle = DetallePedido(
            id_pedido=pedido.id_pedido,
            id_producto=det.id_producto,
            nombre_producto=det.nombre_producto,
            categoria=det.categoria,
            cantidad=det.cantidad,
            precio_unitario=det.precio_unitario,
            termino_coccion=det.termino_coccion,
            notas_especiales=det.notas_especiales,
        )
        db.add(detalle)

    await db.flush()

    # Recargar con detalles
    result = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .where(Pedido.id_pedido == pedido.id_pedido)
    )
    return result.scalar_one()


@router.get("/{id_pedido}", response_model=PedidoRead, summary="Detalle de pedido")
async def detalle_pedido(id_pedido: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .where(Pedido.id_pedido == id_pedido)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    return pedido


@router.patch("/{id_pedido}", response_model=PedidoRead, summary="Actualizar pedido")
async def actualizar_pedido(
    id_pedido: UUID, payload: PedidoUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Pedido)
        .options(selectinload(Pedido.detalles))
        .where(Pedido.id_pedido == id_pedido)
    )
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")

    if payload.detalles is not None:
        if pedido.estado in ("pagado_adelanto", "completado", "cancelado"):
            raise HTTPException(409, "No se pueden cambiar detalles de un pedido pagado o cerrado")
        payer_r = await db.execute(select(Payer.id_payer).where(Payer.id_pedido == id_pedido).limit(1))
        if payer_r.scalar_one_or_none() is not None:
            raise HTTPException(409, "El pedido ya tiene un payer registrado")
        await _validar_productos(payload.detalles, db)
        _calcular_totales(payload.detalles)  # Validar también el límite NUMERIC(10, 2).
        # Eliminar detalles anteriores y recalcular
        for det in pedido.detalles:
            await db.delete(det)
        await db.flush()

        subtotal = Decimal("0.00")
        for det in payload.detalles:
            sub_det = det.precio_unitario * det.cantidad
            subtotal += sub_det
            d = DetallePedido(
                id_pedido=pedido.id_pedido,
                id_producto=det.id_producto,
                nombre_producto=det.nombre_producto,
                categoria=det.categoria,
                cantidad=det.cantidad,
                precio_unitario=det.precio_unitario,
                termino_coccion=det.termino_coccion,
                notas_especiales=det.notas_especiales,
            )
            db.add(d)

        pedido.subtotal = subtotal
        pedido.total = subtotal - pedido.descuento

    if payload.estado:
        pedido.estado = payload.estado
        _sincronizar_estado(pedido)
    if payload.notas is not None:
        pedido.notas = payload.notas
    await db.flush()

    result = await db.execute(
        select(Pedido).options(selectinload(Pedido.detalles))
        .where(Pedido.id_pedido == id_pedido)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


@router.delete("/{id_pedido}", status_code=204, summary="Cancelar pedido")
async def cancelar_pedido(id_pedido: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Pedido).where(Pedido.id_pedido == id_pedido))
    pedido = result.scalar_one_or_none()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado")
    pedido.estado = "cancelado"
    _sincronizar_estado(pedido)
