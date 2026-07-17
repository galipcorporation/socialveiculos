"""Add tabela contrato_assinatura_versao (texto versionado do contrato B2B)

Revision ID: e9fe28de2d33
Revises: f3a9c1e04b28
Create Date: 2026-07-17 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e9fe28de2d33'
down_revision: Union[str, None] = 'f3a9c1e04b28'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'contrato_assinatura_versao',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('versao', sa.String(20), nullable=False, unique=True),
        sa.Column('conteudo_html', sa.Text(), nullable=False),
        sa.Column('vigente', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('criado_por_admin_id', sa.String(36), sa.ForeignKey('usuario.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('contrato_assinatura_versao')
