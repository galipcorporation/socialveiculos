"""Número do contrato passa a ser único por loja, não global

`contrato.numero` nascia com unique global, mas `gerar_numero_contrato` sempre
numerou por loja (CV-2026-0001 em cada uma). Resultado: a segunda loja a emitir
o primeiro contrato do ano batia no UNIQUE e recebia 500 ao criar o contrato.

Em SQLite (dev/CI) o schema vem do `create_all` sobre os modelos, que já traz a
constraint composta — por isso o DDL aqui só roda no Postgres, onde ficam os
bancos que passaram pelas migrations.

Revision ID: a4e7c1b93d05
Revises: e1a7c934db50
Create Date: 2026-08-02 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a4e7c1b93d05'
down_revision: Union[str, None] = 'e1a7c934db50'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_bind().dialect.name != 'postgresql':
        return

    # Nome padrão que o Postgres dá ao unique de coluna criado com o create_table.
    op.execute('ALTER TABLE contrato DROP CONSTRAINT IF EXISTS contrato_numero_key')
    op.create_unique_constraint(
        'uq_contrato_loja_numero', 'contrato', ['loja_id', 'numero']
    )


def downgrade() -> None:
    if op.get_bind().dialect.name != 'postgresql':
        return

    op.drop_constraint('uq_contrato_loja_numero', 'contrato', type_='unique')
    # Só volta a ser global se não houver número repetido entre lojas.
    op.create_unique_constraint('contrato_numero_key', 'contrato', ['numero'])
