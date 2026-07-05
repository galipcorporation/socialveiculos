"""usuario_add_mfa_secret_pendente

B031: /mfa/enroll sobrescrevia mfa_secret e zerava mfa_ativo imediatamente,
permitindo bypass/downgrade de MFA com uma sessão roubada. Esta coluna guarda
o secret do enroll em andamento; só /mfa/confirm promove para mfa_secret.

Revision ID: 89f7c9b5aa21
Revises: 1612348e9e66
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '89f7c9b5aa21'
down_revision: Union[str, None] = '1612348e9e66'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('usuario', 'mfa_secret_pendente'):
        op.add_column('usuario', sa.Column('mfa_secret_pendente', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('usuario', 'mfa_secret_pendente')
