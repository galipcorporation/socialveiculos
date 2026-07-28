"""Precos dos planos alinhados ao mercado (Essencial/Profissional/Premium)

Os valores anteriores (99,90 / 299,90) eram simbolicos do seed de desenvolvimento.
Esta migration coloca a tabela de precos real em producao:

    Essencial     R$ 149,90
    Profissional  R$ 349,90
    Premium       R$ 599,90   (novo tier)

Renomeia "Basico" -> "Essencial" preservando o id (assinaturas apontam para ele).
NAO altera Assinatura.valor_mensal: o valor cobrado de cada loja e negociado e
sobrevive a mudanca da tabela.

Idempotente via SELECT previo; sem PRAGMA e sem batch_alter_table.

Revision ID: c5e71a93f204
Revises: b3d9f1c47e28
"""
from typing import Sequence, Union
import json
import uuid

import sqlalchemy as sa
from alembic import op

revision: str = "c5e71a93f204"
down_revision: Union[str, None] = "b3d9f1c47e28"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_PREMIUM_MODULOS = json.dumps(["contratos", "simulador", "marketing", "assistente_ia"])

_DESC_ESSENCIAL = "Gestão de estoque, CRM e vitrine — sem módulos premium"
_DESC_PROFISSIONAL = "Gestão completa + todos os módulos premium"
_DESC_PREMIUM = (
    "Tudo do Profissional + multi-loja, estoque ilimitado e suporte prioritário"
)


def upgrade() -> None:
    bind = op.get_bind()

    nomes = {
        r[0]: r[1]
        for r in bind.execute(sa.text("SELECT nome, id FROM plano")).fetchall()
    }

    # Básico -> Essencial (mantém o id: assinaturas existentes seguem válidas).
    if "Básico" in nomes and "Essencial" not in nomes:
        bind.execute(
            sa.text(
                "UPDATE plano SET nome = 'Essencial', descricao = :d, preco_mensal = 149.90 "
                "WHERE id = :id"
            ),
            {"d": _DESC_ESSENCIAL, "id": nomes["Básico"]},
        )
    elif "Essencial" in nomes:
        bind.execute(
            sa.text(
                "UPDATE plano SET descricao = :d, preco_mensal = 149.90 WHERE id = :id"
            ),
            {"d": _DESC_ESSENCIAL, "id": nomes["Essencial"]},
        )
    else:
        # Nem "Básico" nem "Essencial": base que nunca recebeu o plano de entrada.
        bind.execute(
            sa.text(
                "INSERT INTO plano (id, nome, descricao, preco_mensal, modulos_incluidos, ativo) "
                "VALUES (:id, 'Essencial', :d, 149.90, :m, :ativo)"
            ),
            {
                "id": str(uuid.uuid4()),
                "d": _DESC_ESSENCIAL,
                "m": json.dumps([]),
                "ativo": True,
            },
        )

    if "Profissional" in nomes:
        bind.execute(
            sa.text(
                "UPDATE plano SET descricao = :d, preco_mensal = 349.90 WHERE id = :id"
            ),
            {"d": _DESC_PROFISSIONAL, "id": nomes["Profissional"]},
        )

    if "Premium" not in nomes:
        bind.execute(
            sa.text(
                "INSERT INTO plano (id, nome, descricao, preco_mensal, modulos_incluidos, ativo) "
                "VALUES (:id, 'Premium', :d, 599.90, :m, :ativo)"
            ),
            {
                "id": str(uuid.uuid4()),
                "d": _DESC_PREMIUM,
                "m": _PREMIUM_MODULOS,
                # Bind param em vez de literal: SQLite nao aceita `true` cru.
                "ativo": True,
            },
        )


def downgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("DELETE FROM plano WHERE nome = 'Premium'"))
    bind.execute(
        sa.text(
            "UPDATE plano SET nome = 'Básico', descricao = :d, preco_mensal = 99.90 "
            "WHERE nome = 'Essencial'"
        ),
        {"d": "Gestão de estoque e CRM, sem módulos premium"},
    )
    bind.execute(
        sa.text("UPDATE plano SET preco_mensal = 299.90 WHERE nome = 'Profissional'")
    )
