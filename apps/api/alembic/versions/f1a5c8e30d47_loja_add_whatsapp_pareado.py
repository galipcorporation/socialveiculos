"""loja_add_whatsapp_pareado

Adiciona:
- loja.whatsapp_pareado — último número visto conectado via QR (Baileys)
- loja.whatsapp_divergente — True se whatsapp_pareado != whatsapp cadastrado

Revision ID: f1a5c8e30d47
Revises: c4a7d92e1f36
Create Date: 2026-07-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a5c8e30d47'
down_revision: Union[str, None] = 'c4a7d92e1f36'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('loja', 'whatsapp_pareado'):
        op.add_column('loja', sa.Column('whatsapp_pareado', sa.String(length=20), nullable=True))
    if not _tem_coluna('loja', 'whatsapp_divergente'):
        op.add_column('loja', sa.Column('whatsapp_divergente', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('loja', 'whatsapp_divergente')
    op.drop_column('loja', 'whatsapp_pareado')
