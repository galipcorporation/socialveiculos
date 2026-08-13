"""usuario: preferência do botão flutuante (AssistiveTouch)

O botão flutuante de ações rápidas do app fica sobre o conteúdo e cobre parte da
tela; quem trabalha em aparelho pequeno reclama, quem usa o atalho o tempo todo
não abre mão. Vira preferência por usuário (não por loja — dois vendedores no
mesmo balcão discordam):

- `botao_flutuante`          — mostra ou não o botão. Default True: quem já usa
                               o app não perde o atalho na atualização.
- `botao_flutuante_perguntar` — o modal de primeiro acesso ainda deve aparecer.
                               O checkbox "não perguntar novamente" zera isto.

Revision ID: c7d1e9f3a482
Revises: b3c9e14a7f26
Create Date: 2026-08-13 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d1e9f3a482'
down_revision: Union[str, None] = 'b3c9e14a7f26'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    insp = sa.inspect(op.get_bind())
    return coluna in [c["name"] for c in insp.get_columns(tabela)]


def upgrade() -> None:
    if not _tem_coluna('usuario', 'botao_flutuante'):
        op.add_column(
            'usuario',
            sa.Column('botao_flutuante', sa.Boolean(), nullable=False, server_default=sa.true()),
        )
    if not _tem_coluna('usuario', 'botao_flutuante_perguntar'):
        op.add_column(
            'usuario',
            sa.Column(
                'botao_flutuante_perguntar', sa.Boolean(), nullable=False, server_default=sa.true()
            ),
        )


def downgrade() -> None:
    op.drop_column('usuario', 'botao_flutuante_perguntar')
    op.drop_column('usuario', 'botao_flutuante')
