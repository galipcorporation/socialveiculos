"""
Social Veículos — Configuração do banco de dados.
SQLAlchemy async engine + session factory.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from config import settings


# ── Engine ──────────────────────────────────────────────────────
# SQLite dev: sqlite+aiosqlite:///./socialveiculos.db
# PostgreSQL prod: postgresql+asyncpg://user:pass@host/db
def _get_async_url() -> str:
    url = settings.database_url
    # Converter sqlite:/// → sqlite+aiosqlite:///
    if url.startswith("sqlite:///"):
        return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    # Converter postgresql:// → postgresql+asyncpg://
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


is_postgres = "postgresql" in settings.database_url

engine = create_async_engine(
    _get_async_url(),
    echo=settings.api_debug,
    poolclass=NullPool if is_postgres else None,
    pool_pre_ping=True if is_postgres else False,
    connect_args={"statement_cache_size": 0} if is_postgres else {},
)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Base declarativa ────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency para FastAPI ─────────────────────────────────────
async def get_db() -> AsyncSession:  # type: ignore[misc]
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from sqlalchemy import text

# ── Utility: criar tabelas (para dev rápido sem Alembic) ────────
async def create_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrações seguras locais
        try:
            await conn.execute(text("ALTER TABLE log_auditoria ADD COLUMN visivel BOOLEAN DEFAULT 1 NOT NULL"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE log_auditoria ADD COLUMN ajusteia BOOLEAN DEFAULT 0 NOT NULL"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE veiculo ADD COLUMN contrato_origem_id VARCHAR(36) REFERENCES contrato(id) ON DELETE SET NULL"))
        except Exception:
            pass


async def drop_all_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
