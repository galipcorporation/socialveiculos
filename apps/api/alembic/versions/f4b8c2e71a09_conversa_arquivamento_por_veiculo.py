"""conversa: arquivamento quando o veículo sai + mensagem de sistema

O chat B2C é um por veículo. Quando o carro é vendido/reservado/despublicado, a
conversa vira somente-leitura (`ativa=False` + `arquivada_em`/`motivo_arquivo`) e
recebe um aviso gerado pelo sistema (`mensagem.sistema=True`, sem autor).

`motivo_arquivo` é VARCHAR de propósito — enum nativo exigiria CREATE TYPE, que já
derrubou o boot em 2026-07-19 (ARMADILHAS-PRODUCAO.md §2).

Idempotente e sem `PRAGMA`/`batch_alter_table`: só adiciona a coluna que faltar.

Revision ID: f4b8c2e71a09
Revises: a4d2f8b16c93
Create Date: 2026-08-07 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4b8c2e71a09'
down_revision: Union[str, None] = 'a4d2f8b16c93'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _colunas(tabela: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(tabela):
        return set()
    return {c['name'] for c in inspector.get_columns(tabela)}


def upgrade() -> None:
    conversa = _colunas('conversa')
    if conversa and 'arquivada_em' not in conversa:
        op.add_column('conversa', sa.Column('arquivada_em', sa.DateTime(), nullable=True))
    if conversa and 'motivo_arquivo' not in conversa:
        op.add_column('conversa', sa.Column('motivo_arquivo', sa.String(length=30), nullable=True))

    mensagem = _colunas('mensagem')
    if mensagem and 'sistema' not in mensagem:
        # NOT NULL com server_default para não quebrar as linhas já gravadas.
        op.add_column(
            'mensagem',
            sa.Column('sistema', sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    mensagem = _colunas('mensagem')
    if 'sistema' in mensagem:
        op.drop_column('mensagem', 'sistema')

    conversa = _colunas('conversa')
    if 'motivo_arquivo' in conversa:
        op.drop_column('conversa', 'motivo_arquivo')
    if 'arquivada_em' in conversa:
        op.drop_column('conversa', 'arquivada_em')
