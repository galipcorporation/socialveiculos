"""add_veiculo_carroceria

Adiciona:
- veiculo.carroceria — categoria de carroceria (sedan, suv, hatch, pickup, etc.)

Revision ID: c9e1f4a83d20
Revises: b2f5d8e10c33
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c9e1f4a83d20'
down_revision: Union[str, None] = 'b2f5d8e10c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return coluna in [c["name"] for c in insp.get_columns(tabela)]


def upgrade() -> None:
    if not _tem_coluna('veiculo', 'carroceria'):
        op.add_column('veiculo', sa.Column('carroceria', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('veiculo', 'carroceria')
