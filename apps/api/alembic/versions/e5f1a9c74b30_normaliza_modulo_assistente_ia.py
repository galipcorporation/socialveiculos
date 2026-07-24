"""normaliza_modulo_assistente_ia

Unifica a chave do módulo do Assistente de IA entre as duas camadas de
liberação, que até aqui usavam nomes diferentes para a MESMA coisa:

  * admin → loja  (`modulo_habilitado.nome_modulo`) gravava 'assistente_ia';
  * gestor → vendedor (`membro_loja.modulos`, JSON array) gravava 'assistente'.

Como os dois nomes nunca casavam, o cruzamento "o vendedor só recebe o que o
admin liberou para a loja" era impossível de fazer. O canônico passa a ser
'assistente_ia' (o enum `Modulo` do backend, já usado por todo o assistente.py).

Aqui migramos os registros de `membro_loja.modulos` — troca textual dentro do
JSON array, preservando o resto do conteúdo.

Idempotente: rodar de novo não encontra mais '"assistente"' para trocar.
Compatível com SQLite e Postgres (REPLACE existe nos dois).

Revision ID: e5f1a9c74b30
Revises: a1b2c3d4e5f6
Create Date: 2026-07-23 10:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f1a9c74b30'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Troca o elemento exato '"assistente"' por '"assistente_ia"'. As aspas no
    # padrão impedem casar com um prefixo de outro item do array.
    conn.execute(
        sa.text(
            "UPDATE membro_loja "
            "SET modulos = REPLACE(modulos, '\"assistente\"', '\"assistente_ia\"') "
            "WHERE modulos LIKE '%\"assistente\"%'"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()

    conn.execute(
        sa.text(
            "UPDATE membro_loja "
            "SET modulos = REPLACE(modulos, '\"assistente_ia\"', '\"assistente\"') "
            "WHERE modulos LIKE '%\"assistente_ia\"%'"
        )
    )
