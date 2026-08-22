#!/usr/bin/env python3
"""
Recifra todas as credenciais em repouso da chave Fernet legada (derivada do
JWT_SECRET — ver B128/C2 em documentos/tarefa/BUGS.md) para a FERNET_KEY
própria configurada em config.py/simulador/crypt.py.

Rodar UMA VEZ, depois de configurar FERNET_KEY no ambiente, e ANTES de
remover a leitura do JWT_SECRET como fallback (se algum dia isso acontecer).

Uso:
    cd apps/api
    python scripts/migrar_fernet_key.py            # dry-run: só relata
    python scripts/migrar_fernet_key.py --aplicar   # grava as recifras

Cobre as 7 colunas cifradas conhecidas (models.py):
  CredencialBanco.credenciais_cifradas
  CredencialIA.api_key_cifrada
  CredencialDetran.api_key_cifrada
  ConfiguracaoFiscal.certificado_a1_cifrado
  ConfiguracaoFiscal.certificado_senha_cifrada
  ConfiguracaoFiscal.focus_nfe_token_cifrado
  CredencialRedeSocial.access_token_cifrado / refresh_token_cifrado
  CredencialPortal.credenciais_cifradas
"""
import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.future import select  # noqa: E402

from config import settings  # noqa: E402
from database import async_session  # noqa: E402
from models import (  # noqa: E402
    CredencialBanco, CredencialIA, CredencialDetran, ConfiguracaoFiscal,
    CredencialRedeSocial, CredencialPortal,
)
from simulador.crypt import get_fernet_key, _get_legacy_fernet_key  # noqa: E402
from cryptography.fernet import Fernet, InvalidToken  # noqa: E402


def _recifrar(fernet_novo: Fernet, fernet_legado: Fernet, valor: str | None) -> tuple[str | None, str]:
    """Retorna (novo_valor, status). status: 'ja_atual' | 'migrado' | 'vazio' | 'erro'."""
    if not valor:
        return valor, "vazio"
    try:
        fernet_novo.decrypt(valor.encode("utf-8"))
        return valor, "ja_atual"  # já está com a chave nova
    except InvalidToken:
        pass
    try:
        plano = fernet_legado.decrypt(valor.encode("utf-8"))
        return fernet_novo.encrypt(plano).decode("utf-8"), "migrado"
    except InvalidToken:
        return valor, "erro"


async def main(aplicar: bool) -> None:
    if not settings.fernet_key:
        print("[ERRO] FERNET_KEY não está configurada no ambiente atual. Configure antes de rodar.")
        sys.exit(1)

    fernet_novo = Fernet(get_fernet_key())
    fernet_legado = Fernet(_get_legacy_fernet_key())

    contagem = {"ja_atual": 0, "migrado": 0, "vazio": 0, "erro": 0}
    erros: list[str] = []

    async with async_session() as db:
        # ── CredencialBanco ──
        for row in (await db.execute(select(CredencialBanco))).scalars().all():
            novo, status = _recifrar(fernet_novo, fernet_legado, row.credenciais_cifradas)
            contagem[status] += 1
            if status == "erro":
                erros.append(f"CredencialBanco id={row.id}")
            elif status == "migrado" and aplicar:
                row.credenciais_cifradas = novo

        # ── CredencialIA ──
        for row in (await db.execute(select(CredencialIA))).scalars().all():
            novo, status = _recifrar(fernet_novo, fernet_legado, row.api_key_cifrada)
            contagem[status] += 1
            if status == "erro":
                erros.append(f"CredencialIA id={row.id}")
            elif status == "migrado" and aplicar:
                row.api_key_cifrada = novo

        # ── CredencialDetran ──
        for row in (await db.execute(select(CredencialDetran))).scalars().all():
            novo, status = _recifrar(fernet_novo, fernet_legado, row.api_key_cifrada)
            contagem[status] += 1
            if status == "erro":
                erros.append(f"CredencialDetran id={row.id}")
            elif status == "migrado" and aplicar:
                row.api_key_cifrada = novo

        # ── ConfiguracaoFiscal (3 colunas) ──
        for row in (await db.execute(select(ConfiguracaoFiscal))).scalars().all():
            for campo in ("certificado_a1_cifrado", "certificado_senha_cifrada", "focus_nfe_token_cifrado"):
                atual = getattr(row, campo)
                novo, status = _recifrar(fernet_novo, fernet_legado, atual)
                contagem[status] += 1
                if status == "erro":
                    erros.append(f"ConfiguracaoFiscal id={row.id} campo={campo}")
                elif status == "migrado" and aplicar:
                    setattr(row, campo, novo)

        # ── CredencialRedeSocial (2 colunas) ──
        for row in (await db.execute(select(CredencialRedeSocial))).scalars().all():
            for campo in ("access_token_cifrado", "refresh_token_cifrado"):
                atual = getattr(row, campo)
                novo, status = _recifrar(fernet_novo, fernet_legado, atual)
                contagem[status] += 1
                if status == "erro":
                    erros.append(f"CredencialRedeSocial id={row.id} campo={campo}")
                elif status == "migrado" and aplicar:
                    setattr(row, campo, novo)

        # ── CredencialPortal ──
        for row in (await db.execute(select(CredencialPortal))).scalars().all():
            novo, status = _recifrar(fernet_novo, fernet_legado, row.credenciais_cifradas)
            contagem[status] += 1
            if status == "erro":
                erros.append(f"CredencialPortal id={row.id}")
            elif status == "migrado" and aplicar:
                row.credenciais_cifradas = novo

        if aplicar:
            await db.commit()

    print(f"já na chave atual : {contagem['ja_atual']}")
    print(f"migrados          : {contagem['migrado']}{'' if aplicar else ' (dry-run — nada gravado)'}")
    print(f"vazios (nulos)    : {contagem['vazio']}")
    print(f"erro (nem legado) : {contagem['erro']}")
    if erros:
        print("\nRegistros que não decifraram nem com a chave legada — não migrados, requer investigação manual:")
        for e in erros:
            print(f"  - {e}")
    if not aplicar and contagem["migrado"] > 0:
        print("\nRodar de novo com --aplicar para gravar.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--aplicar", action="store_true", help="Grava as recifras (sem isso, só relata).")
    args = parser.parse_args()
    asyncio.run(main(args.aplicar))
