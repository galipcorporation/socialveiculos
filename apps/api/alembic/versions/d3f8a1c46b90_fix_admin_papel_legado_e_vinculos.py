"""fix_admin_papel_legado_e_vinculos

Corrige dois defeitos de dados que quebravam o acesso do admin de plataforma:

  * B021 — usuários com papel legado 'ADMIN' (enum renomeado para
    'ADMIN_PLATAFORMA' sem migração de dados) causavam LookupError ao serem
    hidratados pelo ORM, derrubando o login com 500.
  * B015/B016 — admins de plataforma tinham vínculos em `membro_loja` criados
    pela lógica antiga de rebaixamento. No novo modelo, o admin opera qualquer
    loja via header X-Loja-Id e NÃO precisa de vínculo; os vínculos residuais
    disparavam UNIQUE constraint no re-insert. Removemos esses vínculos.

Idempotente e segura para re-execução (SQLite: DDL/DML fora de transação).

Revision ID: d3f8a1c46b90
Revises: 2175ae5b512d
Create Date: 2026-07-01 08:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3f8a1c46b90'
down_revision: Union[str, None] = '2175ae5b512d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # B021 — migra papel legado 'ADMIN' para o nome atual do enum.
    conn.execute(
        sa.text(
            "UPDATE usuario SET papel = 'ADMIN_PLATAFORMA' WHERE papel = 'ADMIN'"
        )
    )

    # B015/B016 — remove vínculos membro_loja residuais de admins de plataforma.
    # No modelo de suporte multi-loja o admin não é membro de nenhuma loja.
    conn.execute(
        sa.text(
            """
            DELETE FROM membro_loja
            WHERE usuario_id IN (
                SELECT id FROM usuario WHERE papel = 'ADMIN_PLATAFORMA'
            )
            """
        )
    )


def downgrade() -> None:
    # Correção de dados irreversível — os vínculos removidos não são recriáveis
    # com segurança e o papel legado 'ADMIN' não deve voltar a existir.
    pass
