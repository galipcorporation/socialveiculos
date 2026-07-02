"""add_esteira_pos_venda

Esteira pós-venda (ESTEIRA-POS-VENDA.md §6): tabelas esteira_pos_venda +
item_checklist. Novos enums (EstagioPosVenda, StatusItemChecklist, CategoriaItem,
ResponsavelItem) e novo valor REPASSE em OrigemLead. Em SQLite os Enums são
VARCHAR sem constraint nativa, então o novo valor de OrigemLead não exige ALTER.

Revision ID: c1a2b3d4e5f6
Revises: d3f8a1c46b90
Create Date: 2026-07-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, None] = 'd3f8a1c46b90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotente: dev cria as tabelas via Base.metadata.create_all no startup.
    bind = op.get_bind()
    existentes = set(sa.inspect(bind).get_table_names())
    if 'esteira_pos_venda' in existentes and 'item_checklist' in existentes:
        return

    op.create_table(
        'esteira_pos_venda',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('loja_id', sa.String(length=36), nullable=False),
        sa.Column('veiculo_id', sa.String(length=36), nullable=True),
        sa.Column('contrato_id', sa.String(length=36), nullable=True),
        sa.Column('comprador_id', sa.String(length=36), nullable=True),
        sa.Column('vendedor_id', sa.String(length=36), nullable=True),
        sa.Column('estagio', sa.Enum('CONTRATO', 'PAGAMENTO', 'DOCUMENTOS', 'TRANSFERENCIA', 'CONCLUIDO', name='estagioposvenda'), nullable=False),
        sa.Column('origem', sa.Enum('VITRINE', 'MANUAL', 'SIMULADOR', 'WHATSAPP', 'REPASSE', name='origemlead'), nullable=True),
        sa.Column('comunicacao_venda_em', sa.DateTime(), nullable=True),
        sa.Column('transferencia_em', sa.DateTime(), nullable=True),
        sa.Column('aberta_em', sa.DateTime(), nullable=True),
        sa.Column('concluida_em', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['loja_id'], ['loja.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['veiculo_id'], ['veiculo.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['contrato_id'], ['contrato.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['comprador_id'], ['cliente_pf.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['vendedor_id'], ['usuario.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_esteira_loja', 'esteira_pos_venda', ['loja_id'], unique=False)
    op.create_index('ix_esteira_estagio', 'esteira_pos_venda', ['estagio'], unique=False)
    op.create_index('ix_esteira_veiculo', 'esteira_pos_venda', ['veiculo_id'], unique=False)

    op.create_table(
        'item_checklist',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('esteira_id', sa.String(length=36), nullable=False),
        sa.Column('chave', sa.String(length=50), nullable=False),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('categoria', sa.Enum('CONTRATO', 'FINANCEIRO', 'DOCUMENTO', 'TRANSFERENCIA', name='categoriaitem'), nullable=False),
        sa.Column('responsavel', sa.Enum('LOJA', 'COMPRADOR', name='responsavelitem'), nullable=True),
        sa.Column('status', sa.Enum('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'NAO_APLICAVEL', name='statusitemchecklist'), nullable=False),
        sa.Column('obrigatorio', sa.Boolean(), nullable=True),
        sa.Column('prazo_em', sa.DateTime(), nullable=True),
        sa.Column('doc_id', sa.String(length=36), nullable=True),
        sa.Column('observacao', sa.Text(), nullable=True),
        sa.Column('concluido_em', sa.DateTime(), nullable=True),
        sa.Column('concluido_por', sa.String(length=36), nullable=True),
        sa.ForeignKeyConstraint(['esteira_id'], ['esteira_pos_venda.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['doc_id'], ['veiculo_documento.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['concluido_por'], ['usuario.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_item_esteira', 'item_checklist', ['esteira_id'], unique=False)
    op.create_index('ix_item_status', 'item_checklist', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_item_status', table_name='item_checklist')
    op.drop_index('ix_item_esteira', table_name='item_checklist')
    op.drop_table('item_checklist')
    op.drop_index('ix_esteira_veiculo', table_name='esteira_pos_venda')
    op.drop_index('ix_esteira_estagio', table_name='esteira_pos_venda')
    op.drop_index('ix_esteira_loja', table_name='esteira_pos_venda')
    op.drop_table('esteira_pos_venda')
