"""Add soft delete (motivo/quem/quando) ao lançamento financeiro

Revision ID: a7c4e1f95b62
Revises: e9fe28de2d33
Create Date: 2026-07-18 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c4e1f95b62'
down_revision: Union[str, None] = 'e9fe28de2d33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('lancamento_financeiro', schema=None) as batch_op:
        batch_op.add_column(sa.Column('deletado_em', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('deletado_por_id', sa.String(36), nullable=True))
        batch_op.add_column(sa.Column('deletado_por_nome', sa.String(200), nullable=True))
        batch_op.add_column(sa.Column('motivo_exclusao', sa.String(500), nullable=True))
        batch_op.create_index('ix_lancamento_deletado_em', ['deletado_em'])


def downgrade() -> None:
    with op.batch_alter_table('lancamento_financeiro', schema=None) as batch_op:
        batch_op.drop_index('ix_lancamento_deletado_em')
        batch_op.drop_column('motivo_exclusao')
        batch_op.drop_column('deletado_por_nome')
        batch_op.drop_column('deletado_por_id')
        batch_op.drop_column('deletado_em')
