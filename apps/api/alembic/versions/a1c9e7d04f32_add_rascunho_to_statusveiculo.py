"""add RASCUNHO to statusveiculo

Revision ID: a1c9e7d04f32
Revises: b3d5f8a12e67, d8f2a1c04e91
Create Date: 2026-06-29 00:00:00.000000

"""
from alembic import op

revision = 'a1c9e7d04f32'
down_revision = ('b3d5f8a12e67', 'd8f2a1c04e91')
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("ALTER TYPE statusveiculo ADD VALUE IF NOT EXISTS 'RASCUNHO'")
    # SQLite: enums são strings sem restrição; nenhuma alteração necessária


def downgrade() -> None:
    op.execute("UPDATE veiculo SET status = 'INATIVO' WHERE status = 'RASCUNHO'")
