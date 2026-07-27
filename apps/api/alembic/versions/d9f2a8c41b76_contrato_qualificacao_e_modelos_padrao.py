"""Campos de qualificação para contratos (cliente/veiculo/loja) + seed dos 2 modelos padrão

Revision ID: d9f2a8c41b76
Revises: c5e1a7b93d20
Create Date: 2026-07-26 00:00:00.000000

Compatível com Postgres (ARMADILHAS-PRODUCAO.md §2): sem PRAGMA, sem
batch_alter_table, idempotente via sa.inspect.
"""
from typing import Sequence, Union
import json
import uuid
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa


revision: str = 'd9f2a8c41b76'
down_revision: Union[str, None] = 'c5e1a7b93d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# tabela → [(coluna, tipo)]
_COLUNAS = {
    "cliente_pf": [
        ("nacionalidade", sa.String(50)),
        ("estado_civil", sa.String(30)),
        ("profissao", sa.String(100)),
        ("cnh", sa.String(11)),
        ("cnh_categoria", sa.String(5)),
    ],
    "veiculo": [
        ("chassi", sa.String(17)),
        ("renavam", sa.String(11)),
    ],
    "loja": [
        ("inscricao_estadual", sa.String(20)),
        ("representante_nome", sa.String(200)),
        ("representante_cpf", sa.String(14)),
        ("representante_rg", sa.String(20)),
    ],
}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    for tabela, colunas in _COLUNAS.items():
        existentes = {c["name"] for c in inspector.get_columns(tabela)}
        for nome, tipo in colunas:
            if nome not in existentes:
                op.add_column(tabela, sa.Column(nome, tipo, nullable=True))

    _seed_modelos(bind)


def _seed_modelos(bind) -> None:
    """Cria os 2 modelos padrão nas lojas que ainda não os têm."""
    import sys
    from pathlib import Path

    # A migration roda com o cwd em apps/api, mas garantir o path evita
    # ImportError quando o alembic é invocado de outro diretório.
    raiz = Path(__file__).resolve().parents[2]
    if str(raiz) not in sys.path:
        sys.path.insert(0, str(raiz))
    from contrato_modelos_padrao import MODELOS_PADRAO

    template_table = sa.table(
        'template_contrato',
        sa.column('id', sa.String),
        sa.column('loja_id', sa.String),
        sa.column('nome', sa.String),
        sa.column('conteudo_html', sa.Text),
        sa.column('campos_extras', sa.Text),
        sa.column('ativo', sa.Boolean),
        sa.column('created_at', sa.DateTime),
        sa.column('updated_at', sa.DateTime),
    )

    now = datetime.now(timezone.utc)
    lojas = bind.execute(sa.text("SELECT id FROM loja")).fetchall()

    # Pares (loja_id, nome) já existentes — não recriar.
    ja_tem = {
        (r[0], r[1])
        for r in bind.execute(
            sa.text("SELECT loja_id, nome FROM template_contrato")
        ).fetchall()
    }

    rows = []
    for (loja_id,) in lojas:
        for nome, (html, campos) in MODELOS_PADRAO.items():
            if (loja_id, nome) in ja_tem:
                continue
            rows.append({
                'id': uuid.uuid4().hex,
                'loja_id': loja_id,
                'nome': nome,
                'conteudo_html': html,
                'campos_extras': json.dumps(campos),
                'ativo': True,
                'created_at': now,
                'updated_at': now,
            })

    if rows:
        op.bulk_insert(template_table, rows)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    import sys
    from pathlib import Path
    raiz = Path(__file__).resolve().parents[2]
    if str(raiz) not in sys.path:
        sys.path.insert(0, str(raiz))
    from contrato_modelos_padrao import MODELOS_PADRAO

    bind.execute(
        sa.text("DELETE FROM template_contrato WHERE nome IN :nomes").bindparams(
            sa.bindparam('nomes', expanding=True)
        ),
        {"nomes": list(MODELOS_PADRAO.keys())},
    )

    # SQLite não faz DROP COLUMN em versões antigas; produção é Postgres.
    if bind.dialect.name != 'postgresql':
        return

    for tabela, colunas in _COLUNAS.items():
        existentes = {c["name"] for c in inspector.get_columns(tabela)}
        for nome, _ in colunas:
            if nome in existentes:
                op.drop_column(tabela, nome)
