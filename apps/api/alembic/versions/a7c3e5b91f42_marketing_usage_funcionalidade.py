"""marketing_usage: coluna funcionalidade (consumo de IA por área)

A tabela passa a registrar o consumo de TODA funcionalidade de IA da
plataforma (marketing, triagem de leads, ...), não só o marketing. Linhas
antigas são backfilled para 'marketing', que era o único consumidor.

Revision ID: a7c3e5b91f42
Revises: d9f2a8c41b76
Create Date: 2026-07-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c3e5b91f42'
down_revision: Union[str, None] = 'd9f2a8c41b76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(nome_tabela: str, nome_coluna: str) -> bool:
    """Idempotência: DDL no SQLite não é transacional, então uma migration
    interrompida pode deixar a coluna criada. Ver ARMADILHAS-PRODUCAO.md §2."""
    insp = sa.inspect(op.get_bind())
    if nome_tabela not in insp.get_table_names():
        return True  # tabela ausente: nada a fazer aqui
    return any(c["name"] == nome_coluna for c in insp.get_columns(nome_tabela))


def upgrade() -> None:
    if _tem_coluna("marketing_usage", "funcionalidade"):
        return

    # server_default cobre as linhas já existentes sem UPDATE separado.
    op.add_column(
        "marketing_usage",
        sa.Column(
            "funcionalidade",
            sa.String(50),
            nullable=False,
            server_default="marketing",
        ),
    )


def downgrade() -> None:
    if not _tem_coluna("marketing_usage", "funcionalidade"):
        return
    op.drop_column("marketing_usage", "funcionalidade")
