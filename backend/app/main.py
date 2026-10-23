from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine
from sqlalchemy import text

# ── Fase BUYERS ──────────────────────────────────────────────
from app.api.v1.captacion import router as captacion_router
from app.api.v1.leads     import router as leads_router
from app.api.v1.campanas  import router as campanas_router

# ── Fase LEADS / Negociación ─────────────────────────────────
from app.api.v1.perfiles  import router as perfiles_router
from app.api.v1.pedidos   import router as pedidos_router
from app.api.v1.pagos     import router as pagos_router

# ── Fase PAYERS ──────────────────────────────────────────────
from app.api.v1.payers    import router as payers_router

# ── Fase CUSTOMERS ───────────────────────────────────────────
from app.api.v1.customers import router as customers_router
from app.api.v1.hermes import router as hermes_router
from app.api.v1.creativos import router as creativos_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"🔥 {settings.PROJECT_NAME} v{settings.VERSION}")
    # El esquema se administra con Alembic, nunca se crea silenciosamente en startup.
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    try:
        yield
    finally:
        await engine.dispose()
        print("🛑 Apagando servidor...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Sistema IMPULSE — Buyers → Leads → Payers → Customers",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PREFIX = settings.API_PREFIX  # /api/v1

# Fase BUYERS
app.include_router(captacion_router, prefix=PREFIX)
app.include_router(leads_router,     prefix=PREFIX)
app.include_router(campanas_router,  prefix=PREFIX)

# Fase LEADS
app.include_router(perfiles_router,  prefix=PREFIX)
app.include_router(pedidos_router,   prefix=PREFIX)
app.include_router(pagos_router,     prefix=PREFIX)

# Fase PAYERS
app.include_router(payers_router,    prefix=PREFIX)

# Fase CUSTOMERS
app.include_router(customers_router, prefix=PREFIX)
app.include_router(hermes_router, prefix=PREFIX)
app.include_router(creativos_router, prefix=PREFIX)


@app.get("/health", tags=["Health"])
async def health_check():
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {
        "status": "ok",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "fases": ["BUYERS", "LEADS", "PAYERS", "CUSTOMERS"],
    }
