"""conversa_add_proposta_status_manual

Adiciona:
- conversa.proposta_id — vínculo opcional com proposta_repasse (dá contexto de
  veículo/negociação ao chat B2B, que hoje é um fio contínuo sem origem)
- conversa.status_manual — status de desfecho marcado manualmente pelo vendedor
  quando a conversa não tem proposta formal vinculada

Revision ID: a1b2c3d4e5f6
Revises: d4e8b2a71f39
Create Date: 2026-07-21 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'd4e8b2a71f39'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ENUM_NAME = 'statusnegociacaoconversa'
ENUM_VALUES = ('EM_NEGOCIACAO', 'FECHOU', 'NAO_FECHOU')


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(c['name'] == coluna for c in insp.get_columns(tabela))


def _tem_indice(tabela: str, indice: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return any(i['name'] == indice for i in insp.get_indexes(tabela))


def _enum_coluna(bind):
    # postgresql.ENUM com create_type=False: o CREATE TYPE é feito explicitamente
    # abaixo (checkfirst=True), evitando o DuplicateObjectError de sa.Enum genérico
    # (ver validar-migrations-postgres-real).
    if bind.dialect.name == 'postgresql':
        return postgresql.ENUM(*ENUM_VALUES, name=ENUM_NAME, create_type=False)
    return sa.Enum(*ENUM_VALUES, name=ENUM_NAME)


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        postgresql.ENUM(*ENUM_VALUES, name=ENUM_NAME).create(bind, checkfirst=True)

    # A FK precisa de caminhos diferentes por dialeto:
    #  - Postgres aceita ADD COLUMN ... REFERENCES (FK inline no add_column);
    #  - SQLite não suporta ALTER de constraint (o alembic levanta
    #    NotImplementedError mesmo com a FK declarada inline), então a coluna vai
    #    sem FK. É o mesmo trade-off já aceito em outras migrations do projeto:
    #    a integridade referencial em dev/SQLite fica a cargo da aplicação, e o
    #    schema real de produção (Postgres) tem a constraint.
    if not _tem_coluna('conversa', 'proposta_id'):
        if bind.dialect.name == 'postgresql':
            coluna = sa.Column(
                'proposta_id',
                sa.String(length=36),
                sa.ForeignKey('proposta_repasse.id', name='fk_conversa_proposta_id', ondelete='SET NULL'),
                nullable=True,
            )
        else:
            coluna = sa.Column('proposta_id', sa.String(length=36), nullable=True)
        op.add_column('conversa', coluna)

    # Guard próprio: o DDL do SQLite é não-transacional, então uma tentativa
    # anterior pode ter criado a coluna sem chegar até aqui.
    if not _tem_indice('conversa', 'ix_conversa_proposta'):
        op.create_index('ix_conversa_proposta', 'conversa', ['proposta_id'], unique=False)

    if not _tem_coluna('conversa', 'status_manual'):
        op.add_column('conversa', sa.Column('status_manual', _enum_coluna(bind), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_column('conversa', 'status_manual')
    if _tem_indice('conversa', 'ix_conversa_proposta'):
        op.drop_index('ix_conversa_proposta', table_name='conversa')
    # A FK é inline na coluna: dropar a coluna leva a constraint junto nos dois
    # dialetos (em SQLite não há DROP CONSTRAINT avulso).
    op.drop_column('conversa', 'proposta_id')
    if bind.dialect.name == 'postgresql':
        postgresql.ENUM(*ENUM_VALUES, name=ENUM_NAME).drop(bind, checkfirst=True)
