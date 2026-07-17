"""Add identidade nos contratos (cabeçalho/rodapé/marca-d'água por loja + toggle por modelo)

Revision ID: f3a9c1e04b28
Revises: 8e6003df28b5
Create Date: 2026-07-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f3a9c1e04b28'
down_revision: Union[str, None] = '8e6003df28b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('loja', schema=None) as batch_op:
        batch_op.add_column(sa.Column('contrato_cabecalho', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('contrato_rodape', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('contrato_marca_dagua_url', sa.String(500), nullable=True))
        batch_op.add_column(sa.Column('contrato_marca_dagua_ativa', sa.Boolean(), nullable=False, server_default='0'))

    with op.batch_alter_table('template_contrato', schema=None) as batch_op:
        batch_op.add_column(sa.Column('usar_identidade_loja', sa.Boolean(), nullable=False, server_default='1'))


def downgrade() -> None:
    with op.batch_alter_table('template_contrato', schema=None) as batch_op:
        batch_op.drop_column('usar_identidade_loja')

    with op.batch_alter_table('loja', schema=None) as batch_op:
        batch_op.drop_column('contrato_marca_dagua_ativa')
        batch_op.drop_column('contrato_marca_dagua_url')
        batch_op.drop_column('contrato_rodape')
        batch_op.drop_column('contrato_cabecalho')
