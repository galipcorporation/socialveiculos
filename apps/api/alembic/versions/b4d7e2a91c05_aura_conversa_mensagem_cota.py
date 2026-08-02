"""AURA (M124): conversa, mensagem e cota mensal por loja

Revision ID: b4d7e2a91c05
Revises: e1a7c934db50
Create Date: 2026-08-02

Compatível com Postgres (produção) e SQLite (dev):
- sem PRAGMA e sem batch_alter_table (ARMADILHAS-PRODUCAO §2);
- sem Enum nativo — `autor` é VARCHAR, então não há CREATE TYPE para duplicar;
- idempotente via sa.inspect, porque o DDL do SQLite não é transacional e um
  upgrade interrompido deixa estado parcial.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b4d7e2a91c05'
down_revision = 'e1a7c934db50'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    if 'aura_conversa' not in tabelas:
        op.create_table(
            'aura_conversa',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('usuario_id', sa.String(36), sa.ForeignKey('usuario.id', ondelete='CASCADE'), nullable=False),
            sa.Column('silenciada', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('ultima_mensagem_em', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('loja_id', 'usuario_id', name='uq_aura_conversa_loja_usuario'),
        )
        op.create_index('ix_aura_conversa_loja_usuario', 'aura_conversa', ['loja_id', 'usuario_id'])

    if 'aura_mensagem' not in tabelas:
        op.create_table(
            'aura_mensagem',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('conversa_id', sa.String(36), sa.ForeignKey('aura_conversa.id', ondelete='CASCADE'), nullable=False),
            sa.Column('loja_id', sa.String(36), sa.ForeignKey('loja.id', ondelete='CASCADE'), nullable=False),
            sa.Column('autor', sa.String(10), nullable=False),
            sa.Column('conteudo', sa.Text(), nullable=False),
            sa.Column('atalhos', sa.Text(), nullable=True),
            sa.Column('buscas', sa.Text(), nullable=True),
            sa.Column('tokens_input', sa.Integer(), nullable=True),
            sa.Column('tokens_output', sa.Integer(), nullable=True),
            sa.Column('latencia_ms', sa.Integer(), nullable=True),
            sa.Column('provedor', sa.String(50), nullable=True),
            sa.Column('modelo', sa.String(100), nullable=True),
            sa.Column('avaliacao', sa.Integer(), nullable=True),
            sa.Column('atalho_seguido', sa.String(100), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
        )
        op.create_index('ix_aura_mensagem_conversa', 'aura_mensagem', ['conversa_id', 'created_at'])
        op.create_index('ix_aura_mensagem_loja', 'aura_mensagem', ['loja_id'])

    colunas_loja = {c['name'] for c in inspector.get_columns('loja')}
    if 'aura_cota_mensal' not in colunas_loja:
        op.add_column('loja', sa.Column('aura_cota_mensal', sa.Integer(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tabelas = set(inspector.get_table_names())

    colunas_loja = {c['name'] for c in inspector.get_columns('loja')}
    if 'aura_cota_mensal' in colunas_loja:
        op.drop_column('loja', 'aura_cota_mensal')

    if 'aura_mensagem' in tabelas:
        op.drop_index('ix_aura_mensagem_loja', table_name='aura_mensagem')
        op.drop_index('ix_aura_mensagem_conversa', table_name='aura_mensagem')
        op.drop_table('aura_mensagem')

    if 'aura_conversa' in tabelas:
        op.drop_index('ix_aura_conversa_loja_usuario', table_name='aura_conversa')
        op.drop_table('aura_conversa')
