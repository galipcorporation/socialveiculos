"""add_veiculo_opcionais_custo_categoria

Adiciona:
- veiculo.opcionais (JSON array em texto) — lista de opcionais do veículo.
- lancamento_financeiro.categoria — categoria do custo de preparação
  (mecanica, pintura, pneus, higienizacao, documentacao, outro).

Revision ID: b2f5d8e10c33
Revises: a1c4e7f09b22
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2f5d8e10c33'
down_revision: Union[str, None] = 'a1c4e7f09b22'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    # Idempotente (SQLite faz DDL não-transacional)
    if not _tem_coluna('veiculo', 'opcionais'):
        op.add_column('veiculo', sa.Column('opcionais', sa.Text(), nullable=True))
    if not _tem_coluna('lancamento_financeiro', 'categoria'):
        op.add_column('lancamento_financeiro', sa.Column('categoria', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('lancamento_financeiro', 'categoria')
    op.drop_column('veiculo', 'opcionais')
