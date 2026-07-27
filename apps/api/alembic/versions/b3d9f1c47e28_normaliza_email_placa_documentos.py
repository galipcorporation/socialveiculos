"""normaliza_email_placa_documentos

Uniformiza a grafia dos campos que funcionam como chave de busca. A partir de
agora os schemas normalizam na entrada (B107); esta migration acerta o que já
está gravado, senão a correção **inverte** o problema — quem se cadastrou com
'JOAO@X.COM' passaria a nunca casar com o 'joao@x.com' que o login envia.

O que muda:

  * `usuario.email`   → minúsculo + trim. É a chave de login (`==`, sensível a
    caixa no Postgres) e tem índice único.
  * `loja.cnpj`       → só dígitos. Coluna unique: a máscara permitia o mesmo
    CNPJ em dois registros distintos.
  * `cliente_pf.cpf` / `.cnpj` / `.email` → mesma regra dos acima.
  * `veiculo.placa`   → caixa alta, sem separadores. **Só grafia**: placa
    repetida é legítima (revenda entre lojas, veículo que volta ao estoque,
    clonagem), então NÃO se cria unique nem se remove duplicata.

Idempotente: rodar de novo não encontra mais nada fora do padrão (as cláusulas
WHERE comparam com o próprio valor normalizado).

Compatível com SQLite e Postgres: usa LOWER/UPPER/TRIM/REPLACE, presentes nos
dois. Sem PRAGMA, sem batch_alter_table, sem CREATE TYPE — nenhuma alteração de
schema, apenas UPDATE de dados (ver ARMADILHAS-PRODUCAO.md §2).

⚠️ Colisão de e-mail: se duas contas já existirem diferindo só na caixa
('Joao@x.com' e 'joao@x.com'), o UPDATE violaria o unique. A migration detecta
isso ANTES e aborta com a lista, para resolução manual — em vez de estourar no
meio e deixar o banco pela metade.

Revision ID: b3d9f1c47e28
Revises: c8e4b21f9a53
Create Date: 2026-07-27 21:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3d9f1c47e28'
down_revision: Union[str, None] = 'c8e4b21f9a53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Só dígitos, aninhando REPLACE — funciona em SQLite e Postgres sem regex.
def _so_digitos(col: str) -> str:
    expr = f"TRIM({col})"
    for ch in (".", "-", "/", " ", "(", ")"):
        expr = f"REPLACE({expr}, '{ch}', '')"
    return expr


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. Guarda: e-mails que colidem ao virar minúsculo ────────────────
    # O unique de usuario.email é case-sensitive, então 'A@x.com' e 'a@x.com'
    # coexistem hoje. Baixar a caixa fundiria os dois e violaria a constraint.
    colisoes = conn.execute(sa.text(
        "SELECT LOWER(TRIM(email)) AS e, COUNT(*) AS n FROM usuario "
        "WHERE email IS NOT NULL GROUP BY LOWER(TRIM(email)) HAVING COUNT(*) > 1"
    )).fetchall()
    if colisoes:
        lista = ", ".join(f"{r[0]} ({r[1]} contas)" for r in colisoes)
        raise RuntimeError(
            "Contas duplicadas que diferem só na caixa do e-mail: " + lista +
            ". Resolva manualmente (desativar/mesclar a conta errada) e rode de novo. "
            "Nenhuma alteração foi aplicada."
        )

    # ── 2. usuario.email ─────────────────────────────────────────────────
    conn.execute(sa.text(
        "UPDATE usuario SET email = LOWER(TRIM(email)) "
        "WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))"
    ))

    # ── 3. loja.cnpj (unique) ────────────────────────────────────────────
    d = _so_digitos("cnpj")
    conn.execute(sa.text(
        f"UPDATE loja SET cnpj = {d} WHERE cnpj IS NOT NULL AND cnpj <> {d}"
    ))

    # representante_cpf não é unique, mas segue a mesma regra de gravação.
    d_cpf = _so_digitos("representante_cpf")
    conn.execute(sa.text(
        f"UPDATE loja SET representante_cpf = {d_cpf} "
        f"WHERE representante_cpf IS NOT NULL AND representante_cpf <> {d_cpf}"
    ))

    # ── 4. cliente_pf: documentos + e-mail ───────────────────────────────
    for col in ("cpf", "cnpj"):
        d_col = _so_digitos(col)
        conn.execute(sa.text(
            f"UPDATE cliente_pf SET {col} = {d_col} "
            f"WHERE {col} IS NOT NULL AND {col} <> {d_col}"
        ))
    conn.execute(sa.text(
        "UPDATE cliente_pf SET email = LOWER(TRIM(email)) "
        "WHERE email IS NOT NULL AND email <> LOWER(TRIM(email))"
    ))

    # ── 5. veiculo.placa — grafia apenas, duplicata permanece ────────────
    p = f"UPPER({_so_digitos('placa')})"
    conn.execute(sa.text(
        f"UPDATE veiculo SET placa = {p} WHERE placa IS NOT NULL AND placa <> {p}"
    ))


def downgrade() -> None:
    # Normalização é irreversível: a grafia original (caixa, máscara, hífen) não
    # é recuperável a partir do valor normalizado. Nada a desfazer — os dados
    # continuam íntegros e válidos, só uniformes.
    pass
