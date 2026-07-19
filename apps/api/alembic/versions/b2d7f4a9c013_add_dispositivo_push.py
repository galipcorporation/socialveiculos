"""Add dispositivo_push (tokens de push Expo por usuário)

Revision ID: b2d7f4a9c013
Revises: a7c4e1f95b62
Create Date: 2026-07-18 04:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2d7f4a9c013'
down_revision: Union[str, None] = 'a7c4e1f95b62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'dispositivo_push',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('usuario_id', sa.String(36), nullable=False),
        sa.Column('token', sa.String(255), nullable=False),
        sa.Column('plataforma', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.UniqueConstraint('token', name='uq_dispositivo_push_token'),
    )
    op.create_index('ix_dispositivo_push_usuario', 'dispositivo_push', ['usuario_id'])


def downgrade() -> None:
    op.drop_index('ix_dispositivo_push_usuario', table_name='dispositivo_push')
    op.drop_table('dispositivo_push')
