"""site_dominio_cloudflare

Adiciona (M038 — domínio próprio via Cloudflare for SaaS):
- site_loja.dominio_cf_id       — id do custom hostname na Cloudflare
- site_loja.dominio_txt_name    — nome do registro TXT de validação DV
- site_loja.dominio_txt_value   — valor do registro TXT de validação DV

Revision ID: c1f5a8e30b21
Revises: b8227b6208e4
Create Date: 2026-07-15 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c1f5a8e30b21'
down_revision: Union[str, None] = 'b8227b6208e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        row = bind.execute(
            sa.text("SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"),
            {"t": tabela, "c": coluna},
        ).fetchone()
        return row is not None
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('site_loja', 'dominio_cf_id'):
        op.add_column('site_loja', sa.Column('dominio_cf_id', sa.String(length=40), nullable=True))
    if not _tem_coluna('site_loja', 'dominio_txt_name'):
        op.add_column('site_loja', sa.Column('dominio_txt_name', sa.String(length=255), nullable=True))
    if not _tem_coluna('site_loja', 'dominio_txt_value'):
        op.add_column('site_loja', sa.Column('dominio_txt_value', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('site_loja', 'dominio_txt_value')
    op.drop_column('site_loja', 'dominio_txt_name')
    op.drop_column('site_loja', 'dominio_cf_id')
