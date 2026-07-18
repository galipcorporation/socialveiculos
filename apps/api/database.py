"""
Social Veículos — Configuração do banco de dados.
SQLAlchemy async engine + session factory.
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
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

# Postgres (Supabase via pgbouncer, modo transaction): pool real reaproveita
# conexões entre requests em vez de abrir handshake TCP+TLS a cada request
# (era NullPool). statement_cache_size=0 continua obrigatório com pgbouncer.
_pool_kwargs = (
    {
        "pool_size": 10,
        "max_overflow": 10,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
        "connect_args": {"statement_cache_size": 0},
    }
    if is_postgres
    else {}
)

engine = create_async_engine(
    _get_async_url(),
    echo=settings.api_debug,
    **_pool_kwargs,
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
