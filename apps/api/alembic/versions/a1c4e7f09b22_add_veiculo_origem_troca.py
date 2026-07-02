"""add_veiculo_origem_troca

Adiciona rastreamento de origem do veículo (compra/troca) e vínculo à
negociação de origem, para registrar carros recebidos em troca/rolo.

Revision ID: a1c4e7f09b22
Revises: d5811c6ceda5
Create Date: 2026-06-28 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c4e7f09b22'
down_revision: Union[str, None] = 'd5811c6ceda5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def upgrade() -> None:
    # Persistido pelos NOMES do enum (COMPRA/TROCA), padrão do projeto —
    # Column(Enum(...)) do SQLAlchemy valida pelos nomes, não pelos valores.
    origem_enum = sa.Enum('COMPRA', 'TROCA', name='origemveiculo')
    origem_enum.create(op.get_bind(), checkfirst=True)
    # Idempotente: SQLite faz DDL não-transacional, então tentativas anteriores
    # podem ter adicionado colunas sem o alembic avançar o stamp. add_column é
    # suportado em SQLite; a FK vai inline (create_foreign_key não funciona via ALTER).
    if not _tem_coluna('veiculo', 'origem'):
        op.add_column(
            'veiculo',
            sa.Column('origem', origem_enum, nullable=False, server_default='COMPRA'),
        )
    if not _tem_coluna('veiculo', 'negociacao_origem_id'):
        op.add_column(
            'veiculo',
            sa.Column(
                'negociacao_origem_id',
                sa.String(length=36),
                sa.ForeignKey('negociacao.id', name='fk_veiculo_negociacao_origem', ondelete='SET NULL'),
                nullable=True,
            ),
        )


def downgrade() -> None:
    op.drop_column('veiculo', 'negociacao_origem_id')
    op.drop_column('veiculo', 'origem')
    sa.Enum(name='origemveiculo').drop(op.get_bind(), checkfirst=True)
