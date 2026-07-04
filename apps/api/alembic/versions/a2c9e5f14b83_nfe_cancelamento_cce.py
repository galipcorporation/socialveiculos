"""nfe_cancelamento_cce

Adiciona (M039 Fase 2 — cancelamento de NF-e + Carta de Correção):
- nota_fiscal.justificativa_cancelamento
- nota_fiscal.cancelada_em
- tabela carta_correcao_nfe

Revision ID: a2c9e5f14b83
Revises: f1a5c8e30d47
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a2c9e5f14b83'
down_revision: Union[str, None] = 'f1a5c8e30d47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('nota_fiscal', 'justificativa_cancelamento'):
        op.add_column('nota_fiscal', sa.Column('justificativa_cancelamento', sa.Text(), nullable=True))
    if not _tem_coluna('nota_fiscal', 'cancelada_em'):
        op.add_column('nota_fiscal', sa.Column('cancelada_em', sa.DateTime(), nullable=True))

    bind = op.get_bind()
    existentes = set(sa.inspect(bind).get_table_names())
    if 'carta_correcao_nfe' in existentes:
        return

    op.create_table(
        'carta_correcao_nfe',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('nota_fiscal_id', sa.String(length=36), nullable=False),
        sa.Column('correcao', sa.Text(), nullable=False),
        sa.Column('sequencia', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('protocolo', sa.String(length=20), nullable=True),
        sa.Column('motivo_rejeicao', sa.Text(), nullable=True),
        sa.Column('xml_url', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['nota_fiscal_id'], ['nota_fiscal.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cce_nota', 'carta_correcao_nfe', ['nota_fiscal_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_cce_nota', table_name='carta_correcao_nfe')
    op.drop_table('carta_correcao_nfe')
    op.drop_column('nota_fiscal', 'cancelada_em')
    op.drop_column('nota_fiscal', 'justificativa_cancelamento')
