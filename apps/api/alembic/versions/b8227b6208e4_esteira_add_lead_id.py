"""esteira_add_lead_id

Adiciona:
- esteira_pos_venda.lead_id — rastreia formalmente que a venda se originou de um lead

Revision ID: b8227b6208e4
Revises: b2d4f803c615
Create Date: 2026-07-10 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b8227b6208e4'
down_revision: Union[str, None] = 'b2d4f803c615'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('esteira_pos_venda', 'lead_id'):
        op.add_column('esteira_pos_venda', sa.Column('lead_id', sa.String(length=36), nullable=True))


def downgrade() -> None:
    op.drop_column('esteira_pos_venda', 'lead_id')
