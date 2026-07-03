"""fiscal / nf-e fase 1 (M039) — ConfiguracaoFiscal + NotaFiscal

Revision ID: c4a7d92e1f36
Revises: b8e2f1a3c9d0
Create Date: 2026-07-03 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4a7d92e1f36'
down_revision: Union[str, None] = 'b8e2f1a3c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table: str) -> bool:
    """SQLite DDL não é transacional — migração precisa ser idempotente."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return table in insp.get_table_names()


def upgrade() -> None:
    if not _has_table("configuracao_fiscal"):
        op.create_table(
            "configuracao_fiscal",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("loja_id", sa.String(length=36), nullable=False),
            sa.Column("inscricao_estadual", sa.String(length=20), nullable=True),
            sa.Column("regime_tributario", sa.String(length=20), nullable=False),
            sa.Column("cnae", sa.String(length=10), nullable=True),
            sa.Column("certificado_a1_cifrado", sa.Text(), nullable=True),
            sa.Column("certificado_senha_cifrada", sa.Text(), nullable=True),
            sa.Column("certificado_validade", sa.DateTime(), nullable=True),
            sa.Column("serie_nfe", sa.String(length=3), nullable=False),
            sa.Column("proximo_numero", sa.Integer(), nullable=False),
            sa.Column("ambiente", sa.String(length=15), nullable=False),
            sa.Column("focus_nfe_token_cifrado", sa.Text(), nullable=True),
            sa.Column("natureza_operacao", sa.String(length=60), nullable=False),
            sa.Column("cfop_venda", sa.String(length=4), nullable=False),
            sa.Column("ncm_padrao", sa.String(length=8), nullable=False),
            sa.Column("csosn", sa.String(length=4), nullable=True),
            sa.Column("cst", sa.String(length=3), nullable=True),
            sa.Column("origem_mercadoria", sa.String(length=1), nullable=False),
            sa.Column("ativo", sa.Boolean(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["loja_id"], ["loja.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("loja_id", name="uq_configuracao_fiscal_loja"),
        )

    if not _has_table("nota_fiscal"):
        op.create_table(
            "nota_fiscal",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("loja_id", sa.String(length=36), nullable=False),
            sa.Column("contrato_id", sa.String(length=36), nullable=True),
            sa.Column("veiculo_id", sa.String(length=36), nullable=True),
            sa.Column("cliente_id", sa.String(length=36), nullable=True),
            sa.Column("tipo", sa.String(length=10), nullable=False),
            sa.Column("ambiente", sa.String(length=15), nullable=False),
            sa.Column("modelo", sa.String(length=2), nullable=False),
            sa.Column("serie", sa.String(length=3), nullable=False),
            sa.Column("numero", sa.Integer(), nullable=False),
            sa.Column("focus_nfe_ref", sa.String(length=60), nullable=False),
            sa.Column("chave_acesso", sa.String(length=44), nullable=True),
            sa.Column("protocolo", sa.String(length=20), nullable=True),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("valor_total", sa.Float(), nullable=False),
            sa.Column("impostos_json", sa.Text(), nullable=True),
            sa.Column("xml_url", sa.String(length=500), nullable=True),
            sa.Column("danfe_pdf_url", sa.String(length=500), nullable=True),
            sa.Column("motivo_rejeicao", sa.Text(), nullable=True),
            sa.Column("emitida_em", sa.DateTime(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["loja_id"], ["loja.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["contrato_id"], ["contrato.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["veiculo_id"], ["veiculo.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["cliente_id"], ["cliente_pf.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("focus_nfe_ref", name="uq_nota_fiscal_ref"),
        )
        op.create_index("ix_nota_fiscal_loja", "nota_fiscal", ["loja_id"])


def downgrade() -> None:
    if _has_table("nota_fiscal"):
        op.drop_index("ix_nota_fiscal_loja", table_name="nota_fiscal")
        op.drop_table("nota_fiscal")
    if _has_table("configuracao_fiscal"):
        op.drop_table("configuracao_fiscal")
