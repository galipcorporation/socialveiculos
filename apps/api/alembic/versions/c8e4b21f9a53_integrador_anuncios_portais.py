"""integrador de anúncios: credencial_portal + anuncio_portal (M079)

Duas tabelas novas, nenhuma alteração em tabela existente. O módulo reaproveita
Modulo.MARKETING (é uma aba dele), então não há enum novo a migrar.

`status` de anuncio_portal é String de propósito: portal novo não deve exigir
migration de enum.

Revision ID: c8e4b21f9a53
Revises: a7c3e5b91f42
Create Date: 2026-07-26 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8e4b21f9a53'
down_revision: Union[str, None] = 'a7c3e5b91f42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_tabela(nome: str) -> bool:
    """Idempotência: DDL no SQLite não é transacional, então uma migration
    interrompida pode deixar a tabela criada. Ver ARMADILHAS-PRODUCAO.md §2."""
    return nome in sa.inspect(op.get_bind()).get_table_names()


def upgrade() -> None:
    if not _tem_tabela("credencial_portal"):
        op.create_table(
            "credencial_portal",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("loja_id", sa.String(36), sa.ForeignKey("loja.id", ondelete="CASCADE"), nullable=False),
            sa.Column("portal", sa.String(30), nullable=False),
            sa.Column("credenciais_cifradas", sa.Text(), nullable=False),
            sa.Column("token_expira_em", sa.DateTime(), nullable=True),
            sa.Column("conta_externa_id", sa.String(100), nullable=True),
            sa.Column("ativo", sa.Boolean(), nullable=True, server_default=sa.true()),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("loja_id", "portal", name="uq_credencial_portal_loja"),
        )
        op.create_index("ix_credencial_portal_loja", "credencial_portal", ["loja_id"])

    if not _tem_tabela("anuncio_portal"):
        op.create_table(
            "anuncio_portal",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("loja_id", sa.String(36), sa.ForeignKey("loja.id", ondelete="CASCADE"), nullable=False),
            sa.Column("veiculo_id", sa.String(36), sa.ForeignKey("veiculo.id", ondelete="CASCADE"), nullable=False),
            sa.Column("portal", sa.String(30), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default="nao_publicado"),
            sa.Column("anuncio_externo_id", sa.String(100), nullable=True),
            sa.Column("url_externa", sa.String(500), nullable=True),
            sa.Column("erro", sa.Text(), nullable=True),
            sa.Column("hash_payload", sa.String(64), nullable=True),
            sa.Column("acao_pendente", sa.String(20), nullable=True),
            sa.Column("tentativas", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("proxima_tentativa_em", sa.DateTime(), nullable=True),
            sa.Column("baixa_confirmada_em", sa.DateTime(), nullable=True),
            sa.Column("baixa_confirmada_por", sa.String(36), sa.ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True),
            sa.Column("publicado_em", sa.DateTime(), nullable=True),
            sa.Column("criado_em", sa.DateTime(), nullable=True),
            sa.Column("atualizado_em", sa.DateTime(), nullable=True),
            sa.UniqueConstraint("veiculo_id", "portal", name="uq_anuncio_veiculo_portal"),
        )
        op.create_index("ix_anuncio_portal_loja", "anuncio_portal", ["loja_id"])
        op.create_index("ix_anuncio_portal_status", "anuncio_portal", ["status"])
        op.create_index("ix_anuncio_portal_proxima", "anuncio_portal", ["proxima_tentativa_em"])


def downgrade() -> None:
    if _tem_tabela("anuncio_portal"):
        op.drop_index("ix_anuncio_portal_proxima", table_name="anuncio_portal")
        op.drop_index("ix_anuncio_portal_status", table_name="anuncio_portal")
        op.drop_index("ix_anuncio_portal_loja", table_name="anuncio_portal")
        op.drop_table("anuncio_portal")

    if _tem_tabela("credencial_portal"):
        op.drop_index("ix_credencial_portal_loja", table_name="credencial_portal")
        op.drop_table("credencial_portal")
