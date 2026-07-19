"""midia_add_thumb_url

Adiciona midia.thumb_url — URL do thumbnail WebP (~640px) gerado no upload.
Nulo em mídias antigas (backfill_thumbs.py) e em vídeos; o front faz fallback
para a url original.

Idempotente e compatível com SQLite (dev) e Postgres (produção): a checagem de
coluna usa sa.inspect, não PRAGMA.

Revision ID: d4e8b2a71f39
Revises: c7d3f9a12e58
Create Date: 2026-07-19 12:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd4e8b2a71f39'
down_revision: Union[str, None] = 'c7d3f9a12e58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = [c["name"] for c in insp.get_columns("midia")]
    if "thumb_url" not in cols:
        op.add_column("midia", sa.Column("thumb_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("midia", "thumb_url")
