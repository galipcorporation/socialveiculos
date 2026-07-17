"""fiscal_cfop_entrada

Adiciona (M039 Fase 2 — NF-e de entrada/compra):
- configuracao_fiscal.cfop_entrada — CFOP usado nas notas de compra de veículo

Revision ID: d2a6b9f41c37
Revises: c1f5a8e30b21
Create Date: 2026-07-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd2a6b9f41c37'
down_revision: Union[str, None] = 'c1f5a8e30b21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        row = bind.execute(
            sa.text("SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"),
            {"t": tabela, "c": coluna},
        ).fetchone()
        return row is not None
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('configuracao_fiscal', 'cfop_entrada'):
        op.add_column(
            'configuracao_fiscal',
            sa.Column('cfop_entrada', sa.String(length=4), nullable=False, server_default='1102'),
        )


def downgrade() -> None:
    op.drop_column('configuracao_fiscal', 'cfop_entrada')
