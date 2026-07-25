"""add_status_to_lancamento

Revision ID: b7c4d091f5a3
Revises: a3f6c8e12d94
Create Date: 2026-07-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7c4d091f5a3'
down_revision: Union[str, None] = 'a3f6c8e12d94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # status: RASCUNHO (autosave incompleto) / CONFIRMADO (definitivo, conta em
    # saldo/relatórios). Mesmo padrão de StatusVeiculo.RASCUNHO no estoque.
    # sa.Enum cria o tipo nativo no Postgres automaticamente (create_type=True
    # por padrão); no SQLite vira VARCHAR sem restrição — portável entre os dois
    # (ver migrations-sqlite-only-baseline-postgres.md).
    with op.batch_alter_table('lancamento_financeiro') as batch_op:
        batch_op.add_column(
            sa.Column(
                'status',
                sa.Enum('RASCUNHO', 'CONFIRMADO', name='statuslancamento'),
                nullable=False,
                server_default='CONFIRMADO',
            )
        )
        # Rascunho é um formulário incompleto: descricao/valor podem faltar
        # até a confirmação (ver LancamentoRascunhoRequest).
        batch_op.alter_column('descricao', existing_type=sa.String(300), nullable=True)
        batch_op.alter_column('valor', existing_type=sa.Float(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('lancamento_financeiro') as batch_op:
        batch_op.alter_column('valor', existing_type=sa.Float(), nullable=False)
        batch_op.alter_column('descricao', existing_type=sa.String(300), nullable=False)
        batch_op.drop_column('status')

    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS statuslancamento")
