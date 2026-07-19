"""
Valida todas as colunas Enum do ORM contra os valores realmente gravados no banco.
Detecta descompasso nome-vs-valor (ex.: gravar 'compra' quando o SQLAlchemy
persiste pelos NOMES, COMPRA/TROCA) que gera erro ao ler via ORM.

Uso: python validar_enums.py
Gera também enums.csv com o catálogo de enums do sistema.
"""
import csv
import sqlite3
import sys

import models
from sqlalchemy import Enum as SAEnum

DB = "socialveiculos.db"


def coletar_colunas_enum():
    """(tabela, coluna, EnumClass) para toda coluna mapeada como Enum no ORM."""
    achados = []
    for mapper in models.Base.registry.mappers:
        cls = mapper.class_
        tabela = cls.__tablename__
        for col in mapper.columns:
            if isinstance(col.type, SAEnum):
                enum_cls = getattr(col.type, "enum_class", None)
                achados.append((tabela, col.name, enum_cls, col.type))
    return achados


def main():
    con = sqlite3.connect(DB)
    cur = con.cursor()

    # tabelas existentes no banco
    tabelas_db = {r[0] for r in cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}

    colunas = coletar_colunas_enum()
    problemas = []
    catalogo = []

    for tabela, coluna, enum_cls, satype in sorted(colunas):
        if enum_cls is None:
            continue
        nomes_validos = {m.name for m in enum_cls}        # COMPRA, TROCA…
        valores_membros = {m.value for m in enum_cls}     # compra, troca…

        # catálogo (um por par enum/coluna)
        for m in enum_cls:
            catalogo.append({
                "enum": enum_cls.__name__,
                "tabela": tabela,
                "coluna": coluna,
                "nome": m.name,
                "valor": m.value,
            })

        if tabela not in tabelas_db:
            continue

        try:
            gravados = {
                r[0] for r in cur.execute(
                    f"SELECT DISTINCT {coluna} FROM {tabela} WHERE {coluna} IS NOT NULL"
                ).fetchall()
            }
        except sqlite3.OperationalError as e:
            problemas.append((tabela, coluna, enum_cls.__name__, f"ERRO SQL: {e}"))
            continue

        invalidos = gravados - nomes_validos
        if invalidos:
            # se os inválidos são VALORES do enum, é o bug nome-vs-valor
            eh_valor = invalidos <= valores_membros
            dica = " (descompasso nome-vs-valor)" if eh_valor else ""
            problemas.append((
                tabela, coluna, enum_cls.__name__,
                f"valores gravados fora dos nomes válidos: {sorted(invalidos)}{dica}",
            ))

    # ── Relatório ──
    print(f"Colunas Enum inspecionadas: {len(colunas)}")
    print(f"Enums distintos: {len({c['enum'] for c in catalogo})}\n")

    if problemas:
        print("PROBLEMAS ENCONTRADOS:")
        for tabela, coluna, enum_nome, msg in problemas:
            print(f"  - {tabela}.{coluna} [{enum_nome}]: {msg}")
    else:
        print("Nenhum descompasso: todos os valores gravados batem com os nomes dos enums.")

    # ── CSV catálogo ──
    with open("enums.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["enum", "tabela", "coluna", "nome", "valor"])
        w.writeheader()
        for row in sorted(catalogo, key=lambda r: (r["enum"], r["tabela"], r["nome"])):
            w.writerow(row)
    print("\nCatálogo salvo em enums.csv")

    con.close()
    sys.exit(1 if problemas else 0)


if __name__ == "__main__":
    main()
