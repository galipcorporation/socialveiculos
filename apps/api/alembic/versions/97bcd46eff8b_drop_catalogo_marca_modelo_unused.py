"""drop_catalogo_marca_modelo_unused

Revision ID: 97bcd46eff8b
Revises: a7c4e91b2d08
Create Date: 2026-07-02 16:36:43.864955
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97bcd46eff8b'
down_revision: Union[str, None] = 'a7c4e91b2d08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_modelo_marca', table_name='catalogo_modelo')
    op.drop_table('catalogo_modelo')
    op.drop_table('catalogo_marca')


def downgrade() -> None:
    op.create_table(
        'catalogo_marca',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('nome', sa.String(length=100), nullable=False),
        sa.Column('logo_url', sa.String(length=500), nullable=True),
        sa.Column('ativa', sa.Boolean(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nome'),
    )
    op.create_table(
        'catalogo_modelo',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('marca_id', sa.Integer(), nullable=False),
        sa.Column('nome', sa.String(length=200), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(['marca_id'], ['catalogo_marca.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('marca_id', 'nome', name='uq_modelo_marca_nome'),
    )
    op.create_index('ix_modelo_marca', 'catalogo_modelo', ['marca_id'], unique=False)
