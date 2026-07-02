"""add_stories_seguir_config_triagem

Adiciona:
- story: publicação de veículo com expiração 24h e delay de exclusividade B2B
- loja_seguida: cliente B2C segue loja
- loja_config: configuração por loja (delay exclusividade)
- lead_triagem: score IA de leads B2C
- veiculo.publicar_rede_social, veiculo.visivel_publico_em, veiculo.valor_repasse

Revision ID: d8f2a1c04e91
Revises: c9e1f4a83d20
Create Date: 2026-06-29 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd8f2a1c04e91'
down_revision: Union[str, None] = 'c9e1f4a83d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tem_coluna(tabela: str, coluna: str) -> bool:
    bind = op.get_bind()
    cols = [r[1] for r in bind.exec_driver_sql(f"PRAGMA table_info({tabela})").fetchall()]
    return coluna in cols


def _tem_tabela(tabela: str) -> bool:
    bind = op.get_bind()
    res = bind.exec_driver_sql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tabela,)
    ).fetchone()
    return res is not None


def upgrade() -> None:
    # ── story ──────────────────────────────────────────────────
    if not _tem_tabela('story'):
        op.create_table(
            'story',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('veiculo_id', sa.String(36), sa.ForeignKey('veiculo.id', ondelete='SET NULL'), nullable=True),
            sa.Column('legenda', sa.Text(), nullable=True),
            sa.Column('expira_em', sa.DateTime(), nullable=False),
            sa.Column('visivel_publico_em', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    # ── loja_seguida ───────────────────────────────────────────
    if not _tem_tabela('loja_seguida'):
        op.create_table(
            'loja_seguida',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('usuario_id', sa.String(36), sa.ForeignKey('usuario.id', ondelete='CASCADE'), nullable=False),
            sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
        )

    # ── loja_config ────────────────────────────────────────────
    if not _tem_tabela('loja_config'):
        op.create_table(
            'loja_config',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('delay_exclusividade_horas', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )

    # ── lead_triagem ───────────────────────────────────────────
    if not _tem_tabela('lead_triagem'):
        op.create_table(
            'lead_triagem',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('conversa_id', sa.String(36), sa.ForeignKey('conversa.id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('score', sa.Integer(), nullable=False),
            sa.Column('classificacao', sa.String(20), nullable=False),  # quente | ruido
            sa.Column('justificativa', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
        )

    # ── colunas novas em veiculo ───────────────────────────────
    if not _tem_coluna('veiculo', 'publicar_rede_social'):
        op.add_column('veiculo', sa.Column('publicar_rede_social', sa.Boolean(), nullable=False, server_default='0'))
    if not _tem_coluna('veiculo', 'visivel_publico_em'):
        op.add_column('veiculo', sa.Column('visivel_publico_em', sa.DateTime(), nullable=True))
    if not _tem_coluna('veiculo', 'valor_repasse'):
        op.add_column('veiculo', sa.Column('valor_repasse', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_table('lead_triagem')
    op.drop_table('loja_config')
    op.drop_table('loja_seguida')
    op.drop_table('story')
    op.drop_column('veiculo', 'valor_repasse')
    op.drop_column('veiculo', 'visivel_publico_em')
    op.drop_column('veiculo', 'publicar_rede_social')
