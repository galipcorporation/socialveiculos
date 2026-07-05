"""Add template_contrato table + contrato.template_id/dados_extras (modelos editáveis)

Revision ID: a1c3e7f92b04
Revises: 89f7c9b5aa21
Create Date: 2026-07-05 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c3e7f92b04'
down_revision: Union[str, None] = '89f7c9b5aa21'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'template_contrato',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('loja_id', sa.String(36), nullable=False),
        sa.Column('nome', sa.String(200), nullable=False),
        sa.Column('conteudo_html', sa.Text(), nullable=False),
        sa.Column('campos_extras', sa.Text(), nullable=True),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['loja_id'], ['loja.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_template_contrato_loja', 'template_contrato', ['loja_id'])

    with op.batch_alter_table('contrato', schema=None) as batch_op:
        batch_op.add_column(sa.Column('template_id', sa.String(36), nullable=True))
        batch_op.add_column(sa.Column('dados_extras', sa.Text(), nullable=True))
        batch_op.create_foreign_key(
            'fk_contrato_template', 'template_contrato',
            ['template_id'], ['id'], ondelete='SET NULL',
        )


def downgrade() -> None:
    with op.batch_alter_table('contrato', schema=None) as batch_op:
        batch_op.drop_constraint('fk_contrato_template', type_='foreignkey')
        batch_op.drop_column('dados_extras')
        batch_op.drop_column('template_id')
    op.drop_index('ix_template_contrato_loja', table_name='template_contrato')
    op.drop_table('template_contrato')
