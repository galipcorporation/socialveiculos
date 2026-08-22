"""conversa: soft delete (deletada_em, excluido) e backup_url

Adiciona colunas faltantes em conversa para exclusão/arquivamento LGPD e backup no R2:
- conversa.deletada_em (TIMESTAMP)
- conversa.excluido (BOOLEAN DEFAULT false NOT NULL)
- conversa.backup_url (VARCHAR(512))

Revision ID: c8f3e1a94b52
Revises: c7d1e9f3a482
Create Date: 2026-08-22 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8f3e1a94b52'
down_revision: Union[str, None] = 'c7d1e9f3a482'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return coluna in [c["name"] for c in insp.get_columns(tabela)]


def upgrade() -> None:
    if not _tem_coluna('conversa', 'deletada_em'):
        op.add_column('conversa', sa.Column('deletada_em', sa.DateTime(), nullable=True))

    if not _tem_coluna('conversa', 'excluido'):
        op.add_column(
            'conversa',
            sa.Column('excluido', sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    if not _tem_coluna('conversa', 'backup_url'):
        op.add_column('conversa', sa.Column('backup_url', sa.String(length=512), nullable=True))


def downgrade() -> None:
    if _tem_coluna('conversa', 'backup_url'):
        op.drop_column('conversa', 'backup_url')
    if _tem_coluna('conversa', 'excluido'):
        op.drop_column('conversa', 'excluido')
    if _tem_coluna('conversa', 'deletada_em'):
        op.drop_column('conversa', 'deletada_em')
