"""marketplaces: credencial_canal e veiculo_canal_publicacao

Cria tabelas para publicação em canais externos (OLX, Mercado Livre, ...):
- credencial_canal: token OAuth por loja+canal
- veiculo_canal_publicacao: estado de publicação de cada veículo por canal

Revision ID: a1c9f4b83e26
Revises: c8f3e1a94b52
Create Date: 2026-08-22 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c9f4b83e26'
down_revision: Union[str, None] = 'c8f3e1a94b52'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_tabela(tabela: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return tabela in insp.get_table_names()


def upgrade() -> None:
    if not _tem_tabela('credencial_canal'):
        op.create_table(
            'credencial_canal',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('loja_id', sa.String(length=36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('canal', sa.String(length=30), nullable=False),
            sa.Column('access_token', sa.Text(), nullable=True),
            sa.Column('refresh_token', sa.Text(), nullable=True),
            sa.Column('expira_em', sa.DateTime(), nullable=True),
            sa.Column('conta_externa_id', sa.String(length=200), nullable=True),
            sa.Column('conectado_em', sa.DateTime(), nullable=True),
            sa.Column('desconectado_em', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('loja_id', 'canal', name='uq_credencial_loja_canal'),
        )
        op.create_index('ix_credencial_canal_loja', 'credencial_canal', ['loja_id'])

    if not _tem_tabela('veiculo_canal_publicacao'):
        op.create_table(
            'veiculo_canal_publicacao',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('veiculo_id', sa.String(length=36), sa.ForeignKey('veiculo.id', ondelete='CASCADE'), nullable=False),
            sa.Column('loja_id', sa.String(length=36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('canal', sa.String(length=30), nullable=False),
            sa.Column('external_id', sa.String(length=200), nullable=True),
            sa.Column('external_url', sa.String(length=500), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pendente'),
            sa.Column('last_payload_hash', sa.String(length=64), nullable=True),
            sa.Column('last_success_at', sa.DateTime(), nullable=True),
            sa.Column('last_error_code', sa.String(length=50), nullable=True),
            sa.Column('last_error_message', sa.Text(), nullable=True),
            sa.Column('tentativas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('veiculo_id', 'canal', name='uq_veiculo_canal'),
        )
        op.create_index('ix_vcp_loja', 'veiculo_canal_publicacao', ['loja_id'])
        op.create_index('ix_vcp_veiculo', 'veiculo_canal_publicacao', ['veiculo_id'])
        op.create_index('ix_vcp_status', 'veiculo_canal_publicacao', ['status'])


def downgrade() -> None:
    if _tem_tabela('veiculo_canal_publicacao'):
        op.drop_table('veiculo_canal_publicacao')
    if _tem_tabela('credencial_canal'):
        op.drop_table('credencial_canal')
