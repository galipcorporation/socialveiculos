"""backfill_modulos_membro_loja

Preenche `membro_loja.modulos` onde ficou NULL.

O campo é a lista de módulos que o gestor liberou àquele membro. O mobile monta
a navegação a partir dela (`parseModulos()` em `apps/mobile/src/lib/modulos.ts`
→ `useModulosLiberados`): módulo que não está na lista **não vira aba**. Com
`modulos = NULL` o parse devolve `[]` e o vendedor abre o app sem Estoque e sem
CRM — sem erro, sem 403, sem tela de bloqueio: as abas simplesmente não são
registradas, o que faz o defeito parecer "sumiu o menu" e não "faltou permissão".

Três das quatro rotas que criavam o vínculo não preenchiam o campo (corrigido no
mesmo commit): `admin.py` (vincular usuário a loja / criar loja), `auth.py`
(registro B2B) e `equipe.py` quando o convite vinha sem módulos marcados.

Valor aplicado: o núcleo do CRM (`MODULOS_BASE` em `apps/api/modulos.py`), que
não é contratável por fora e por isso pode ser liberado a qualquer membro sem
consultar a assinatura da loja. Módulo premium continua fora — quem precisar
recebe pelo gestor, na tela de equipe.

Idempotente: o WHERE só alcança NULL/vazio, então rodar de novo não encontra
mais nada. Sem alteração de schema — apenas UPDATE de dados. Compatível com
SQLite e Postgres (ver ARMADILHAS-PRODUCAO.md §2): sem PRAGMA, sem
batch_alter_table, sem CREATE TYPE.

Revision ID: e1a7c934db50
Revises: c5e71a93f204
Create Date: 2026-07-30 20:15:00.000000
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1a7c934db50'
down_revision: Union[str, None] = 'c5e71a93f204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Espelha MODULOS_BASE de apps/api/modulos.py. Repetido literalmente de
# propósito: migration não importa código da aplicação, senão uma mudança
# futura na constante reescreveria o que esta revisão já aplicou.
MODULOS_PADRAO = json.dumps(["crm", "estoque", "financeiro"])


def upgrade() -> None:
    conn = op.get_bind()

    # `lead` é reservada, `membro_loja` não — mas o padrão de citar continua.
    faltando = conn.execute(sa.text(
        "SELECT COUNT(*) FROM membro_loja "
        "WHERE modulos IS NULL OR TRIM(modulos) = ''"
    )).scalar()

    if not faltando:
        return

    conn.execute(
        sa.text(
            "UPDATE membro_loja SET modulos = :padrao "
            "WHERE modulos IS NULL OR TRIM(modulos) = ''"
        ),
        {"padrao": MODULOS_PADRAO},
    )
    print(f"[e1a7c934db50] modulos preenchidos em {faltando} vinculo(s).")


def downgrade() -> None:
    # Sem volta: o NULL anterior era o próprio defeito, e não há como distinguir
    # o que esta migration escreveu do que já valia o mesmo valor. Reverter
    # devolveria vendedores ao estado "app sem abas".
    pass
