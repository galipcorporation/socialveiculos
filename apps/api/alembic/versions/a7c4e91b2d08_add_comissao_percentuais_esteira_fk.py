"""comissao: % padrao na loja, % por membro e vinculo esteira_id (TDD 2026-07-02)

Revision ID: a7c4e91b2d08
Revises: c1a2b3d4e5f6
Create Date: 2026-07-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c4e91b2d08'
down_revision: Union[str, None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    """SQLite DDL não é transacional — migração precisa ser idempotente."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("loja", "percentual_comissao_padrao"):
        with op.batch_alter_table("loja", schema=None) as batch_op:
            batch_op.add_column(
                sa.Column("percentual_comissao_padrao", sa.Float(), nullable=False, server_default="0")
            )

    if not _has_column("membro_loja", "percentual_comissao"):
        with op.batch_alter_table("membro_loja", schema=None) as batch_op:
            batch_op.add_column(sa.Column("percentual_comissao", sa.Float(), nullable=True))

    if not _has_column("comissao", "esteira_id"):
        with op.batch_alter_table("comissao", schema=None) as batch_op:
            batch_op.add_column(sa.Column("esteira_id", sa.String(length=36), nullable=True))
            batch_op.create_foreign_key(
                "fk_comissao_esteira_id",
                "esteira_pos_venda", ["esteira_id"], ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    with op.batch_alter_table("comissao", schema=None) as batch_op:
        batch_op.drop_constraint("fk_comissao_esteira_id", type_="foreignkey")
        batch_op.drop_column("esteira_id")
    with op.batch_alter_table("membro_loja", schema=None) as batch_op:
        batch_op.drop_column("percentual_comissao")
    with op.batch_alter_table("loja", schema=None) as batch_op:
        batch_op.drop_column("percentual_comissao_padrao")
