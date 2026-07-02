"""marketing: credencial_rede_social + post_agendado (M024)

Revision ID: b3d5f8a12e67
Revises: a7c2e4f91b05
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3d5f8a12e67'
down_revision: Union[str, None] = 'a7c2e4f91b05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credencial_rede_social',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
        sa.Column('rede', sa.String(20), nullable=False),
        sa.Column('access_token_cifrado', sa.Text, nullable=False),
        sa.Column('refresh_token_cifrado', sa.Text, nullable=True),
        sa.Column('token_expira_em', sa.DateTime, nullable=True),
        sa.Column('page_id', sa.String(100), nullable=True),
        sa.Column('instagram_account_id', sa.String(100), nullable=True),
        sa.Column('ativo', sa.Boolean, default=True),
        sa.Column('criado_em', sa.DateTime),
        sa.Column('atualizado_em', sa.DateTime),
        sa.UniqueConstraint('loja_id', 'rede', name='uq_credencial_rede_loja'),
    )
    op.create_index('ix_cred_rede_loja', 'credencial_rede_social', ['loja_id'])

    op.create_table(
        'post_agendado',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
        sa.Column('veiculo_id', sa.String(36), sa.ForeignKey('veiculo.id', ondelete='SET NULL'), nullable=True),
        sa.Column('redes', sa.Text, nullable=False),
        sa.Column('texto', sa.Text, nullable=False),
        sa.Column('hashtags', sa.Text, nullable=False, server_default='[]'),
        sa.Column('midia_urls', sa.Text, nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='agendado'),
        sa.Column('publicar_em', sa.DateTime, nullable=False),
        sa.Column('publicado_em', sa.DateTime, nullable=True),
        sa.Column('erro', sa.Text, nullable=True),
        sa.Column('criado_em', sa.DateTime),
        sa.Column('atualizado_em', sa.DateTime),
    )
    op.create_index('ix_post_agendado_loja', 'post_agendado', ['loja_id'])
    op.create_index('ix_post_agendado_status', 'post_agendado', ['status'])
    op.create_index('ix_post_agendado_publicar_em', 'post_agendado', ['publicar_em'])


def downgrade() -> None:
    op.drop_index('ix_post_agendado_publicar_em', 'post_agendado')
    op.drop_index('ix_post_agendado_status', 'post_agendado')
    op.drop_index('ix_post_agendado_loja', 'post_agendado')
    op.drop_table('post_agendado')
    op.drop_index('ix_cred_rede_loja', 'credencial_rede_social')
    op.drop_table('credencial_rede_social')
