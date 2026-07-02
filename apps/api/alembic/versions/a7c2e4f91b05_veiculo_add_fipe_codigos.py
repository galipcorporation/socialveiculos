"""veiculo: add fipe_marca_codigo, fipe_modelo_codigo, fipe_ano_codigo (M016)

Revision ID: a7c2e4f91b05
Revises: f1b8d3e20a59
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c2e4f91b05'
down_revision: Union[str, None] = 'f1b8d3e20a59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('veiculo', schema=None) as batch_op:
        batch_op.add_column(sa.Column('fipe_marca_codigo', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('fipe_modelo_codigo', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('fipe_ano_codigo', sa.String(length=20), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('veiculo', schema=None) as batch_op:
        batch_op.drop_column('fipe_ano_codigo')
        batch_op.drop_column('fipe_modelo_codigo')
        batch_op.drop_column('fipe_marca_codigo')
