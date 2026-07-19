"""loja_add_destaque

Adiciona:
- loja.destaque — lojista patrocinado, aparece priorizado no feed da vitrine
- loja.destaque_ate — expiração do destaque (nulo = sem prazo)
- tabela destaque_pagamento — cobrança manual (Pix) do destaque, espelhando o
  padrão já existente de assinatura/pagamento do SaaS

Revision ID: c7d3f9a12e58
Revises: b2d7f4a9c013
Create Date: 2026-07-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c7d3f9a12e58'
down_revision: Union[str, None] = 'b2d7f4a9c013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    # sa.inspect funciona em SQLite (dev) e Postgres (produção) — nunca usar
    # PRAGMA/sqlite_master aqui: quebra o `alembic upgrade head` do boot em prod.
    insp = sa.inspect(op.get_bind())
    return coluna in [c["name"] for c in insp.get_columns(tabela)]


def _tem_tabela(tabela: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(tabela)


def upgrade() -> None:
    if not _tem_coluna('loja', 'destaque'):
        op.add_column('loja', sa.Column('destaque', sa.Boolean(), nullable=False, server_default='0'))
    if not _tem_coluna('loja', 'destaque_ate'):
        op.add_column('loja', sa.Column('destaque_ate', sa.DateTime(), nullable=True))

    if not _tem_tabela('destaque_pagamento'):
        # statuspagamento já existe (criado por outra tabela — Enum(StatusPagamento)
        # em models.py). No Postgres, sa.Enum(create_type=False) genérico não é
        # suficiente para suprimir o CREATE TYPE ao criar a tabela; o tipo
        # dialect-specific postgresql.ENUM é o que garante o reuso sem recriar
        # (foi exatamente isso que quebrou o boot em produção: DuplicateObjectError).
        # No SQLite, ENUM sem create_type vira apenas uma CHECK constraint — ok.
        status_pagamento = postgresql.ENUM(
            'PENDENTE', 'PAGO', 'FALHOU', 'ESTORNADO', name='statuspagamento', create_type=False,
        )
        op.create_table(
            'destaque_pagamento',
            sa.Column('id', sa.String(length=36), primary_key=True),
            sa.Column('loja_id', sa.String(length=36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('valor', sa.Float(), nullable=False),
            sa.Column('meses', sa.Integer(), nullable=False),
            sa.Column('status', status_pagamento, nullable=False, server_default='PAGO'),
            sa.Column('referencia', sa.String(length=200), nullable=True),
            sa.Column('metodo', sa.String(length=30), nullable=True),
            sa.Column('data_pagamento', sa.DateTime(), nullable=True),
            sa.Column('destaque_ate_resultante', sa.DateTime(), nullable=True),
            sa.Column('observacoes', sa.Text(), nullable=True),
            sa.Column('criado_por_admin_id', sa.String(length=36), sa.ForeignKey('usuario.id', ondelete='SET NULL'), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_destaque_pagamento_loja', 'destaque_pagamento', ['loja_id'])


def downgrade() -> None:
    op.drop_index('ix_destaque_pagamento_loja', table_name='destaque_pagamento')
    op.drop_table('destaque_pagamento')
    op.drop_column('loja', 'destaque_ate')
    op.drop_column('loja', 'destaque')
