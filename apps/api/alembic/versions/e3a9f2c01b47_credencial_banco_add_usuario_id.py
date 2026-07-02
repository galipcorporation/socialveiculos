"""credencial_banco: add usuario_id for per-vendor credentials (M022)

Revision ID: e3a9f2c01b47
Revises: 260dc3911295
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e3a9f2c01b47'
down_revision: Union[str, None] = 'b2f5d8e10c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite: usa batch_alter_table para recriar a tabela com a nova coluna + constraint
    with op.batch_alter_table('credencial_banco', schema=None) as batch_op:
        batch_op.add_column(sa.Column('usuario_id', sa.String(length=36), nullable=True))
        batch_op.create_foreign_key(
            'fk_credencial_banco_usuario_id',
            'usuario', ['usuario_id'], ['id'],
            ondelete='CASCADE'
        )
        # Recria a unique constraint incluindo usuario_id
        batch_op.drop_constraint('uq_credencial_loja_banco', type_='unique')
        batch_op.create_unique_constraint(
            'uq_credencial_loja_banco_usuario',
            ['loja_id', 'banco', 'usuario_id']
        )


def downgrade() -> None:
    with op.batch_alter_table('credencial_banco', schema=None) as batch_op:
        batch_op.drop_constraint('uq_credencial_loja_banco_usuario', type_='unique')
        batch_op.create_unique_constraint('uq_credencial_loja_banco', ['loja_id', 'banco'])
        batch_op.drop_constraint('fk_credencial_banco_usuario_id', type_='foreignkey')
        batch_op.drop_column('usuario_id')
