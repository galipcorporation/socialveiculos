"""Add credencial_ia and marketing_usage tables (M024 BYOK)

Revision ID: f1b8d3e20a59
Revises: e3a9f2c01b47
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1b8d3e20a59'
down_revision: Union[str, None] = 'e3a9f2c01b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'credencial_ia',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('loja_id', sa.String(36), nullable=False),
        sa.Column('provedor', sa.String(50), nullable=False),
        sa.Column('api_key_cifrada', sa.Text(), nullable=False),
        sa.Column('modelo_padrao', sa.String(100), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['loja_id'], ['loja.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('loja_id', 'provedor', name='uq_credencial_ia_loja_provedor'),
    )

    op.create_table(
        'marketing_usage',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('loja_id', sa.String(36), nullable=False),
        sa.Column('usuario_id', sa.String(36), nullable=True),
        sa.Column('provedor', sa.String(50), nullable=False),
        sa.Column('modelo', sa.String(100), nullable=False),
        sa.Column('tokens_input', sa.Integer(), nullable=True),
        sa.Column('tokens_output', sa.Integer(), nullable=True),
        sa.Column('byok', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['loja_id'], ['loja.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuario.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('marketing_usage')
    op.drop_table('credencial_ia')
