"""assinatura_ativacao_manual

Plano "Tudo ou Nada" (2026-07-16) — venda manual via Pix antes do gateway:
- assinatura.valor_mensal      — valor efetivamente combinado (pode diferir do preço de tabela do plano, ex: oferta fundadora)
- assinatura.proximo_vencimento — data da próxima cobrança manual (não há recorrência automática ainda)
- assinatura.contrato_aceito_em — quando o cliente aceitou os Termos de Uso / contrato de assinatura
- assinatura.contrato_versao    — versão do contrato aceito (rastreabilidade jurídica)
- assinatura.observacoes        — nota livre do admin (ex: "fundadora 3x R$99,90")
- assinatura.criado_por_admin   — True quando ativada manualmente pelo admin (vs. autoatendimento via /assinar)
- pagamento.metodo              — "pix_manual" | "gateway" | outros, para distinguir cobrança manual da automática

Revision ID: 8e6003df28b5
Revises: d2a6b9f41c37
Create Date: 2026-07-16 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '8e6003df28b5'
down_revision: Union[str, None] = 'd2a6b9f41c37'
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
    if not _tem_coluna('assinatura', 'valor_mensal'):
        op.add_column('assinatura', sa.Column('valor_mensal', sa.Float(), nullable=True))
    if not _tem_coluna('assinatura', 'proximo_vencimento'):
        op.add_column('assinatura', sa.Column('proximo_vencimento', sa.DateTime(), nullable=True))
    if not _tem_coluna('assinatura', 'contrato_aceito_em'):
        op.add_column('assinatura', sa.Column('contrato_aceito_em', sa.DateTime(), nullable=True))
    if not _tem_coluna('assinatura', 'contrato_versao'):
        op.add_column('assinatura', sa.Column('contrato_versao', sa.String(length=20), nullable=True))
    if not _tem_coluna('assinatura', 'observacoes'):
        op.add_column('assinatura', sa.Column('observacoes', sa.Text(), nullable=True))
    if not _tem_coluna('assinatura', 'criado_por_admin'):
        op.add_column(
            'assinatura',
            sa.Column('criado_por_admin', sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if not _tem_coluna('pagamento', 'metodo'):
        op.add_column('pagamento', sa.Column('metodo', sa.String(length=30), nullable=True))


def downgrade() -> None:
    op.drop_column('pagamento', 'metodo')
    op.drop_column('assinatura', 'criado_por_admin')
    op.drop_column('assinatura', 'observacoes')
    op.drop_column('assinatura', 'contrato_versao')
    op.drop_column('assinatura', 'contrato_aceito_em')
    op.drop_column('assinatura', 'proximo_vencimento')
    op.drop_column('assinatura', 'valor_mensal')
