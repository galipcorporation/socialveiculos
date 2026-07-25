"""modulo_habilitado_cortesia

Revisão geral de Plano & Acesso (2026-07-24):
- modulo_habilitado.cortesia — True quando o admin liberou o módulo manualmente,
  fora do plano contratado. Módulos SEM a flag pertencem ao plano e são
  recalculados a cada troca (ligados os que entram, desligados os que saem);
  os de cortesia sobrevivem à troca, para não perder liberações comerciais
  (ex: Marketing de brinde para um cliente fundador).

Backfill: os módulos já habilitados hoje que NÃO constam do plano vigente da
loja viraram cortesia — sem isso, a primeira troca de plano apagaria liberações
existentes que ninguém registrou como cortesia.

Revision ID: f7b3c2e91a05
Revises: e5f1a9c74b30
Create Date: 2026-07-24 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f7b3c2e91a05'
down_revision: Union[str, None] = 'e5f1a9c74b30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        row = bind.execute(
            sa.text("SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"),
            {"t": tabela, "c": coluna},
        ).fetchone()
        return row is not None
    cols = [r[1] for r in bind.exec_driver_sql("PRAGMA table_info(modulo_habilitado)").fetchall()]
    return coluna in cols


def upgrade() -> None:
    if not _tem_coluna('modulo_habilitado', 'cortesia'):
        op.add_column(
            'modulo_habilitado',
            sa.Column('cortesia', sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    # Backfill: módulo habilitado que não pertence ao plano vigente da loja = cortesia.
    # `plano.modulos_incluidos` é um JSON array de strings; comparamos por LIKE no
    # texto cru para funcionar igual em SQLite e Postgres sem função de JSON.
    bind = op.get_bind()
    bind.execute(sa.text("""
        UPDATE modulo_habilitado
           SET cortesia = 1
         WHERE ativo = 1
           AND NOT EXISTS (
               SELECT 1
                 FROM assinatura a
                 JOIN plano p ON p.id = a.plano_id
                WHERE a.loja_id = modulo_habilitado.loja_id
                  AND a.status = 'ATIVA'
                  AND p.modulos_incluidos LIKE '%"' || modulo_habilitado.nome_modulo || '"%'
           )
    """) if bind.dialect.name != 'postgresql' else sa.text("""
        UPDATE modulo_habilitado mh
           SET cortesia = true
         WHERE mh.ativo = true
           AND NOT EXISTS (
               SELECT 1
                 FROM assinatura a
                 JOIN plano p ON p.id = a.plano_id
                WHERE a.loja_id = mh.loja_id
                  AND a.status = 'ATIVA'
                  AND p.modulos_incluidos LIKE '%"' || mh.nome_modulo || '"%'
           )
    """))


def downgrade() -> None:
    op.drop_column('modulo_habilitado', 'cortesia')
