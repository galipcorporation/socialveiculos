"""
Social Veículos — Alembic env.py
Configuração de migrações com auto-detect de modelos SQLAlchemy.
"""

import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context

# Importar todos os modelos para que o metadata os conheça
import models  # noqa: F401
from database import Base, _get_async_url

# Alembic Config object
config = context.config

# Em produção a URL vem do ambiente (DATABASE_URL, via settings), não do
# alembic.ini — sobrescrevemos aqui para migrar o Postgres real (asyncpg).
# O "%" é escapado: set_main_option grava no configparser, que trata "%" como
# sintaxe de interpolação e rejeita senhas percent-encoded (ex.: %23 = "#").
config.set_main_option("sqlalchemy.url", _get_async_url().replace("%", "%%"))

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata dos modelos para autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — gera SQL puro."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode — conecta ao banco real (async/asyncpg)."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"statement_cache_size": 0} if "asyncpg" in _get_async_url() else {},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(_do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
