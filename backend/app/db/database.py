from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

# -------------------------------------------------------------------
# Engine asíncrono (asyncpg)
# -------------------------------------------------------------------
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",  # Logs SQL solo en dev
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# -------------------------------------------------------------------
# Session factory
# -------------------------------------------------------------------
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# -------------------------------------------------------------------
# Base para todos los modelos SQLAlchemy
# -------------------------------------------------------------------
class Base(DeclarativeBase):
    pass


# -------------------------------------------------------------------
# Dependency para inyectar en los routers de FastAPI
# -------------------------------------------------------------------
async def get_db() -> AsyncSession:
    """
    Dependency que provee una sesión de base de datos por request.
    Se cierra automáticamente al finalizar el request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error(f"DB session error: {exc}")
            raise
        finally:
            await session.close()


# -------------------------------------------------------------------
# Utilidad para crear tablas en arranque (útil en desarrollo)
# -------------------------------------------------------------------
async def init_db():
    """
    Crea todas las tablas si no existen.
    En producción usa Alembic en su lugar.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ Base de datos inicializada correctamente.")
