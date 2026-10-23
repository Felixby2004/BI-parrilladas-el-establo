"""
Script de semilla: carga datos de prueba para el Paso 3.
Crea 2 leads con sus perfiles, pedido y simula un pago.

Uso: python seeds/seed_leads.py
(Ejecutar con el virtualenv activado desde /backend)
"""
import asyncio
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from decimal import Decimal
from datetime import date, time
from sqlalchemy import select
from app.db.database import AsyncSessionLocal, init_db
from app.models.base_models import TipoBuyer, Buyer, Producto
from app.models.buyers_models import Lead
from app.models.leads_models import (
    PerfilGustos, PerfilReserva, NegociacionLead, Pedido, DetallePedido
)


async def seed():
    await init_db()
    async with AsyncSessionLocal() as db:
        # La semilla se puede ejecutar de nuevo sin duplicar los datos demo.
        existing = await db.scalar(select(Buyer).where(Buyer.email.in_(["juan@email.com", "maria@empresa.com"])).limit(1))
        if existing:
            print("Datos demo ya presentes; no se duplicaron registros.")
            return
        tipo = await db.scalar(select(TipoBuyer).where(TipoBuyer.nombre == "Familia"))
        if tipo is None:
            tipo = TipoBuyer(nombre="Familia", descripcion="Familias que celebran reuniones especiales")
            db.add(tipo)
            await db.flush()

        # ── Productos base ──────────────────────────────────
        productos_data = [
            Producto(nombre="Ribeye Premium", categoria="corte", precio_base=Decimal("420.00")),
            Producto(nombre="T-Bone Especial", categoria="corte", precio_base=Decimal("390.00")),
            Producto(nombre="Chorizo Artesanal", categoria="entrada", precio_base=Decimal("120.00")),
            Producto(nombre="Cerveza Artesanal", categoria="bebida", precio_base=Decimal("80.00")),
            Producto(nombre="Papas al Horno", categoria="guarnicion", precio_base=Decimal("75.00")),
        ]
        for p in productos_data:
            db.add(p)
        await db.flush()

        # ── Buyer 1 — Juan Pérez ────────────────────────────
        buyer1 = Buyer(
            nombre="Juan", apellido="Pérez",
            telefono="+5215512345678", email="juan@email.com",
            canal_captacion="facebook", etapa_impulse="lead",
            id_tipo_buyer=tipo.id_tipo_buyer,
        )
        db.add(buyer1)
        await db.flush()

        lead1 = Lead(
            id_buyer=buyer1.id_buyer,
            estado="nuevo",
            interes_confirmado="reserva",
            personas_estimadas=8,
        )
        db.add(lead1)
        await db.flush()

        pg1 = PerfilGustos(
            id_lead=lead1.id_lead,
            tipos_corte_preferidos="ribeye,t-bone",
            termino_coccion="tres_cuartos",
            bebidas_preferidas="cerveza artesanal, agua mineral",
            alergias="ninguna",
            presupuesto_por_persona=Decimal("450.00"),
        )
        pr1 = PerfilReserva(
            id_lead=lead1.id_lead,
            fecha_reserva=date(2026, 11, 15),
            hora_inicio=time(14, 0),
            hora_fin=time(17, 0),
            numero_personas=8,
            numero_adultos=6,
            numero_ninos=2,
            ocasion_especial="cumpleanos",
            nombre_festejado="Mamá",
            requiere_decoracion=True,
            requiere_pastel=True,
            estado_reserva="tentativa",
        )
        db.add(pg1); db.add(pr1)

        # Mensajes de chat iniciales
        msgs_lead1 = [
            NegociacionLead(id_lead=lead1.id_lead, remitente="bot", mensaje="¡Hola Juan! 🔥 Bienvenido a Parrilladas El Establo. Vi que te interesa hacer una reserva. ¿Cuéntame, para cuántas personas?", tipo_mensaje="texto"),
            NegociacionLead(id_lead=lead1.id_lead, remitente="cliente", mensaje="Somos 8 personas, es el cumpleaños de mi mamá el 15 de noviembre", tipo_mensaje="texto"),
            NegociacionLead(id_lead=lead1.id_lead, remitente="bot", mensaje="¡Qué ocasión tan especial! 🎂 Para 8 personas en un cumpleaños te recomiendo nuestro Paquete Establo:\n\n🥩 2× Ribeye Premium ($420 c/u)\n🥩 4× T-Bone Especial ($390 c/u)\n🌭 Chorizo artesanal para picar ($120)\n🍺 Bebidas incluidas\n\n¿Te armo una cotización?", tipo_mensaje="sugerencia"),
        ]
        for m in msgs_lead1:
            db.add(m)

        # ── Buyer 2 — María García ──────────────────────────
        buyer2 = Buyer(
            nombre="María", apellido="García",
            telefono="+5215598765432", email="maria@empresa.com",
            canal_captacion="instagram", etapa_impulse="lead",
            id_tipo_buyer=tipo.id_tipo_buyer,
        )
        db.add(buyer2)
        await db.flush()

        lead2 = Lead(
            id_buyer=buyer2.id_buyer,
            estado="contactado",
            interes_confirmado="evento",
            personas_estimadas=25,
        )
        db.add(lead2)
        await db.flush()

        pg2 = PerfilGustos(
            id_lead=lead2.id_lead,
            tipos_corte_preferidos="picaña,new york strip",
            termino_coccion="a_punto",
            bebidas_preferidas="vino tinto, agua mineral",
            restricciones_dieteticas="vegetariano (2 personas)",
        )
        pr2 = PerfilReserva(
            id_lead=lead2.id_lead,
            fecha_reserva=date(2026, 12, 1),
            hora_inicio=time(19, 0),
            hora_fin=time(23, 0),
            numero_personas=25,
            numero_adultos=25,
            ocasion_especial="empresa",
            peticiones_especiales="Proyector y pantalla para presentación",
            estado_reserva="confirmada",
        )
        db.add(pg2); db.add(pr2)

        await db.commit()
        print("✅ Seed completado:")
        print(f"   Lead 1: Juan Pérez (id={lead1.id_lead}) → cumpleaños 8 personas")
        print(f"   Lead 2: María García (id={lead2.id_lead}) → evento empresa 25 personas")
        print(f"   Productos: {len(productos_data)} registrados")


if __name__ == "__main__":
    asyncio.run(seed())
