"""usuario_add_google_oauth_mfa

Adiciona:
- usuario.google_sub — ID estável do Google (login social, M029)
- usuario.senha_hash passa a aceitar NULL (contas 100% Google não têm senha)
- usuario.mfa_secret / usuario.mfa_ativo já existiam no schema mas nunca foram usados (M029 os ativa de fato)

Revision ID: 1612348e9e66
Revises: d5b8e3f92a17
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '1612348e9e66'
down_revision: Union[str, None] = 'd5b8e3f92a17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('usuario', 'google_sub'):
        op.add_column('usuario', sa.Column('google_sub', sa.String(length=64), nullable=True))
        op.create_index('ix_usuario_google_sub', 'usuario', ['google_sub'], unique=True)

    with op.batch_alter_table('usuario') as batch_op:
        batch_op.alter_column('senha_hash', existing_type=sa.String(length=300), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('usuario') as batch_op:
        batch_op.alter_column('senha_hash', existing_type=sa.String(length=300), nullable=False)
    op.drop_index('ix_usuario_google_sub', table_name='usuario')
    op.drop_column('usuario', 'google_sub')
