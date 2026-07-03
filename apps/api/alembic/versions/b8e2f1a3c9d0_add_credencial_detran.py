"""credencial detran por loja (BYOF — fornecedor plugável de consulta DETRAN)

Revision ID: b8e2f1a3c9d0
Revises: 97bcd46eff8b
Create Date: 2026-07-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8e2f1a3c9d0'
down_revision: Union[str, None] = '97bcd46eff8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    """SQLite DDL não é transacional — migração precisa ser idempotente."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if not _has_table("credencial_detran"):
        op.create_table(
            "credencial_detran",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("loja_id", sa.String(length=36), nullable=False),
            sa.Column("api_url", sa.String(length=500), nullable=False),
            sa.Column("api_key_cifrada", sa.Text(), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["loja_id"], ["loja.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("loja_id", name="uq_credencial_detran_loja"),
        )


def downgrade() -> None:
    if _has_table("credencial_detran"):
        op.drop_table("credencial_detran")
