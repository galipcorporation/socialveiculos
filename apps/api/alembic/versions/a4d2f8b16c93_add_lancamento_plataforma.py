"""add lancamento_plataforma

Caixa da própria Social Veículos (aporte de sócio, despesa da operação, receita
avulsa) para a prestação de contas entre sócios no admin. A receita de
assinatura NÃO entra aqui — continua vindo de `pagamento`/`destaque_pagamento`,
que seguem sendo o dono único desse fato.

Idempotente e sem `batch_alter_table`/`PRAGMA`: cria a tabela só se ela ainda
não existir, com DDL que roda igual em SQLite (dev) e Postgres (produção).

Revision ID: a4d2f8b16c93
Revises: b4d7e2a91c05
Create Date: 2026-08-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a4d2f8b16c93'
down_revision: Union[str, None] = 'b4d7e2a91c05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_tabela(nome: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(nome)


def upgrade() -> None:
    if _tem_tabela('lancamento_plataforma'):
        return

    # Enum persiste pelo NOME (APORTE/DESPESA/RECEITA), igual ao restante do projeto.
    op.create_table(
        'lancamento_plataforma',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column(
            'tipo',
            sa.Enum('APORTE', 'DESPESA', 'RECEITA', name='tipolancamentoplataforma'),
            nullable=False,
        ),
        sa.Column('categoria', sa.String(length=80), nullable=False),
        sa.Column('descricao', sa.String(length=300), nullable=True),
        sa.Column('valor', sa.Float(), nullable=False),
        sa.Column('data', sa.DateTime(), nullable=False),
        sa.Column('recorrente', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('observacoes', sa.Text(), nullable=True),
        sa.Column('criado_por_admin_id', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['criado_por_admin_id'], ['usuario.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_lancamento_plataforma_data', 'lancamento_plataforma', ['data'])
    op.create_index('ix_lancamento_plataforma_tipo', 'lancamento_plataforma', ['tipo'])


def downgrade() -> None:
    if not _tem_tabela('lancamento_plataforma'):
        return
    op.drop_index('ix_lancamento_plataforma_tipo', table_name='lancamento_plataforma')
    op.drop_index('ix_lancamento_plataforma_data', table_name='lancamento_plataforma')
    op.drop_table('lancamento_plataforma')
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        sa.Enum(name='tipolancamentoplataforma').drop(bind, checkfirst=True)
