"""lead_triagem_add_precisa_revisao_manual

Fallback de erro/indisponibilidade da IA de triagem deixou de classificar o
lead como "quente" por padrão (promoção indevida a prioritário quando a IA
falha) e passa a usar classificacao="pendente_revisao" + o novo flag
lead_triagem.precisa_revisao_manual=True, sinalizando que o gestor precisa
classificar manualmente enquanto a IA está fora.

Revision ID: a3f6c8e12d94
Revises: f7b3c2e91a05
Create Date: 2026-07-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f6c8e12d94'
down_revision: Union[str, None] = 'f7b3c2e91a05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    # sa.inspect funciona em SQLite (dev) e Postgres (produção) — nunca usar
    # PRAGMA/sqlite_master aqui: quebra o `alembic upgrade head` do boot em prod.
    insp = sa.inspect(op.get_bind())
    return coluna in [c["name"] for c in insp.get_columns(tabela)]


def upgrade() -> None:
    if not _tem_coluna('lead_triagem', 'precisa_revisao_manual'):
        op.add_column(
            'lead_triagem',
            sa.Column('precisa_revisao_manual', sa.Boolean(), nullable=False, server_default='0'),
        )


def downgrade() -> None:
    op.drop_column('lead_triagem', 'precisa_revisao_manual')
