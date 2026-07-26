"""crm_lead_timeline_responsavel_perda

Timeline real de interações (interacao_lead) + responsável, follow-up e motivo
de perda no lead. Substitui a timeline que era derivada das negociações.

Revision ID: c5e1a7b93d20
Revises: b7c4d091f5a3
Create Date: 2026-07-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c5e1a7b93d20'
down_revision: Union[str, None] = 'b7c4d091f5a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Enums persistem pelo NOME (maiúsculo) — ver models.Column(Enum(...)).
TIPOS_INTERACAO = ('NOTA', 'LIGACAO', 'WHATSAPP', 'VISITA', 'EMAIL', 'PROPOSTA', 'SISTEMA')
MOTIVOS_PERDA = (
    'PRECO', 'CREDITO_NEGADO', 'COMPROU_CONCORRENTE',
    'SEM_RESPOSTA', 'DESISTIU', 'VEICULO_VENDIDO', 'OUTRO',
)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # No Postgres o tipo enum nativo precisa existir ANTES do create_table /
    # ALTER TABLE; no SQLite o Enum vira VARCHAR + CHECK e o create é no-op.
    tipo_enum = sa.Enum(*TIPOS_INTERACAO, name='tipointeracao')
    motivo_enum = sa.Enum(*MOTIVOS_PERDA, name='motivoperda')
    tipo_enum.create(bind, checkfirst=True)
    motivo_enum.create(bind, checkfirst=True)

    if 'interacao_lead' not in inspector.get_table_names():
        op.create_table(
            'interacao_lead',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('lead_id', sa.String(36), sa.ForeignKey('lead.id', ondelete='CASCADE'), nullable=False),
            sa.Column('autor_id', sa.String(36), sa.ForeignKey('usuario.id', ondelete='SET NULL'), nullable=True),
            sa.Column('autor_nome', sa.String(150), nullable=True),
            sa.Column(
                'tipo',
                sa.Enum(*TIPOS_INTERACAO, name='tipointeracao', create_type=False),
                nullable=False,
                server_default='NOTA',
            ),
            sa.Column('texto', sa.Text(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_interacao_lead', 'interacao_lead', ['lead_id'])
        op.create_index('ix_interacao_created', 'interacao_lead', ['created_at'])

    # ALTER TABLE nativo — batch_alter_table é workaround de SQLite e é proibido
    # aqui (ver documentos/tarefa/ARMADILHAS-PRODUCAO.md §2).
    cols_lead = {c['name'] for c in inspector.get_columns('lead')}
    if 'responsavel_id' not in cols_lead:
        op.add_column('lead', sa.Column('responsavel_id', sa.String(36), nullable=True))
    if 'proximo_contato' not in cols_lead:
        op.add_column('lead', sa.Column('proximo_contato', sa.DateTime(), nullable=True))
    if 'motivo_perda' not in cols_lead:
        op.add_column('lead', sa.Column(
            'motivo_perda',
            sa.Enum(*MOTIVOS_PERDA, name='motivoperda', create_type=False),
            nullable=True,
        ))
    if 'motivo_perda_detalhe' not in cols_lead:
        op.add_column('lead', sa.Column('motivo_perda_detalhe', sa.Text(), nullable=True))

    # add_column não cria a FK: ela precisa de um ALTER TABLE próprio, que só o
    # Postgres suporta. O SQLite não faz ALTER de constraint e a alternativa
    # (batch_alter_table) é proibida — no dev a coluna fica sem FK, o que é
    # aceitável porque produção é Postgres.
    if bind.dialect.name == 'postgresql':
        fks_lead = {fk.get('name') for fk in inspector.get_foreign_keys('lead')}
        if 'responsavel_id' not in cols_lead and 'fk_lead_responsavel' not in fks_lead:
            op.create_foreign_key(
                'fk_lead_responsavel', 'lead', 'usuario',
                ['responsavel_id'], ['id'], ondelete='SET NULL',
            )

    indices_lead = {i['name'] for i in inspector.get_indexes('lead')}
    if 'ix_lead_responsavel' not in indices_lead:
        op.create_index('ix_lead_responsavel', 'lead', ['responsavel_id'])
    if 'ix_lead_proximo_contato' not in indices_lead:
        op.create_index('ix_lead_proximo_contato', 'lead', ['proximo_contato'])

    # Backfill: cada lead existente ganha o marco "Lead criado" que antes a UI
    # derivava no cliente. Sem isso a timeline fica vazia para o histórico.
    # "lead" é palavra reservada no SQL padrão — sempre entre aspas duplas.
    # O cast do enum é explícito porque a coluna é tipo nativo no Postgres.
    tipo_sistema = "CAST('SISTEMA' AS tipointeracao)" if bind.dialect.name == 'postgresql' else "'SISTEMA'"
    op.execute(sa.text(
        f"""
        INSERT INTO interacao_lead (id, lead_id, autor_id, autor_nome, tipo, texto, created_at, updated_at)
        SELECT
            l.id || '-criado', l.id, NULL, NULL, {tipo_sistema}, 'Lead criado', l.created_at, l.created_at
        FROM "lead" l
        WHERE NOT EXISTS (
            SELECT 1 FROM interacao_lead i WHERE i.lead_id = l.id AND i.tipo = {tipo_sistema}
        )
        """
    ))


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table('interacao_lead')

    op.drop_index('ix_lead_proximo_contato', table_name='lead')
    op.drop_index('ix_lead_responsavel', table_name='lead')
    op.drop_column('lead', 'motivo_perda_detalhe')
    op.drop_column('lead', 'motivo_perda')
    op.drop_column('lead', 'proximo_contato')
    op.drop_column('lead', 'responsavel_id')

    sa.Enum(name='tipointeracao').drop(bind, checkfirst=True)
    sa.Enum(name='motivoperda').drop(bind, checkfirst=True)
