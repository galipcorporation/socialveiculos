"""construtor de sites (M038) — SiteLoja

Revision ID: d5b8e3f92a17
Revises: a2c9e5f14b83
Create Date: 2026-07-04 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5b8e3f92a17'
down_revision: Union[str, None] = 'a2c9e5f14b83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    """SQLite DDL não é transacional — migração precisa ser idempotente."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if _has_table("site_loja"):
        return

    op.create_table(
        "site_loja",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("loja_id", sa.String(length=36), nullable=False),
        sa.Column("subdominio", sa.String(length=100), nullable=False),
        sa.Column("dominio_customizado", sa.String(length=255), nullable=True),
        sa.Column("dominio_status", sa.String(length=20), nullable=False),
        sa.Column("publicado", sa.Boolean(), nullable=True),
        sa.Column("template", sa.String(length=30), nullable=False),
        sa.Column("cor_primaria", sa.String(length=9), nullable=True),
        sa.Column("cor_secundaria", sa.String(length=9), nullable=True),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("banner_url", sa.String(length=500), nullable=True),
        sa.Column("favicon_url", sa.String(length=500), nullable=True),
        sa.Column("hero_titulo", sa.String(length=200), nullable=True),
        sa.Column("hero_subtitulo", sa.String(length=300), nullable=True),
        sa.Column("hero_cta", sa.String(length=50), nullable=True),
        sa.Column("sobre_texto", sa.Text(), nullable=True),
        sa.Column("secoes_ativas", sa.Text(), nullable=True),
        sa.Column("redes", sa.Text(), nullable=True),
        sa.Column("seo_title", sa.String(length=200), nullable=True),
        sa.Column("seo_description", sa.String(length=300), nullable=True),
        sa.Column("og_image_url", sa.String(length=500), nullable=True),
        sa.Column("ga4_id", sa.String(length=30), nullable=True),
        sa.Column("meta_pixel_id", sa.String(length=30), nullable=True),
        sa.Column("rascunho_json", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["loja_id"], ["loja.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("loja_id", name="uq_site_loja_loja"),
        sa.UniqueConstraint("subdominio", name="uq_site_loja_subdominio"),
    )
    op.create_index("ix_site_loja_subdominio", "site_loja", ["subdominio"])


def downgrade() -> None:
    if _has_table("site_loja"):
        op.drop_index("ix_site_loja_subdominio", table_name="site_loja")
        op.drop_table("site_loja")
