"""
Social Veículos — Plano & Acesso (fonte única da verdade).

Reúne, num lugar só, o que antes estava espalhado entre `routers/admin.py`,
`routers/assinaturas.py` e o form de módulos da loja — e que divergia entre si:

  - sincronizar os módulos de uma loja a partir do plano contratado
    (ligando os que entram, desligando os que saem, preservando cortesias);
  - decidir se a loja está com o acesso liberado agora (status + vencimento);
  - transições de estado da assinatura (ativar / renovar / suspender /
    reativar / cancelar), com as regras de qual estado pode ir para qual.

Regra dos módulos: o plano é a origem. Um módulo habilitado sem a flag
`cortesia` pertence ao plano vigente e é recalculado a cada troca. Um módulo
com `cortesia=True` foi liberado à mão pelo admin e sobrevive à troca.
"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Iterable, List, Optional, Set

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import (
    Assinatura,
    Loja,
    ModuloHabilitado,
    Plano,
    StatusAssinatura,
    utcnow,
)

# Grava e compara sempre naive UTC — colunas são TIMESTAMP WITHOUT TIME ZONE
# (Postgres rejeita datetime aware nessas colunas; ver ARMADILHAS-PRODUCAO.md #1).
_now = utcnow

# Estados em que a assinatura ainda existe comercialmente (dá para renovar,
# reativar, trocar plano). CANCELADA é terminal: exige nova ativação.
STATUS_RECUPERAVEIS = {
    StatusAssinatura.ATIVA,
    StatusAssinatura.SUSPENSA,
    StatusAssinatura.EXPIRADA,
}


def modulos_do_plano(plano: Optional[Plano]) -> List[str]:
    """Lista de módulos incluídos no plano (JSON array na coluna)."""
    if not plano or not plano.modulos_incluidos:
        return []
    try:
        valores = json.loads(plano.modulos_incluidos)
    except (ValueError, TypeError):
        return []
    return [v for v in valores if isinstance(v, str)]


@dataclass
class DiffModulos:
    """O que uma troca de plano faria — usado para pré-visualizar na UI."""
    liberados: List[str]
    removidos: List[str]
    mantidos_cortesia: List[str]

    @property
    def tem_mudanca(self) -> bool:
        return bool(self.liberados or self.removidos)


async def _habilitados(db: AsyncSession, loja_id: str) -> List[ModuloHabilitado]:
    return list((await db.execute(
        select(ModuloHabilitado).where(ModuloHabilitado.loja_id == loja_id)
    )).scalars().all())


async def prever_troca_plano(
    db: AsyncSession, loja_id: str, novo_plano: Optional[Plano]
) -> DiffModulos:
    """
    Calcula o efeito de trocar para `novo_plano` SEM aplicar nada.
    Alimenta o diff que o admin vê antes de confirmar.
    """
    alvo = set(modulos_do_plano(novo_plano))
    atuais = await _habilitados(db, loja_id)

    ativos_agora = {m.nome_modulo for m in atuais if m.ativo}
    cortesias = {m.nome_modulo for m in atuais if m.ativo and m.cortesia}

    liberados = sorted(alvo - ativos_agora)
    # Sai quem está ativo, não está no plano novo e não é cortesia.
    removidos = sorted(ativos_agora - alvo - cortesias)
    mantidos = sorted(cortesias - alvo)

    return DiffModulos(
        liberados=liberados,
        removidos=removidos,
        mantidos_cortesia=mantidos,
    )


async def sincronizar_modulos(
    db: AsyncSession, loja_id: str, plano: Optional[Plano]
) -> DiffModulos:
    """
    Aplica os módulos do plano na loja: liga os incluídos, desliga os que
    saíram do plano, preserva os de cortesia. Retorna o que mudou.

    Chamar SEMPRE que o plano da loja mudar (ativação, renovação com troca,
    troca avulsa) — era exatamente o passo que faltava no renovar, deixando
    o plano novo sem os módulos novos.
    """
    diff = await prever_troca_plano(db, loja_id, plano)
    alvo = set(modulos_do_plano(plano))
    atuais = {m.nome_modulo: m for m in await _habilitados(db, loja_id)}

    for nome in alvo:
        existente = atuais.get(nome)
        if existente:
            existente.ativo = True
            existente.cortesia = False  # passou a ser coberto pelo plano
        else:
            db.add(ModuloHabilitado(
                loja_id=loja_id, nome_modulo=nome, ativo=True, cortesia=False,
            ))

    for nome in diff.removidos:
        existente = atuais.get(nome)
        if existente:
            existente.ativo = False

    return diff


async def definir_cortesias(
    db: AsyncSession, loja_id: str, plano: Optional[Plano], cortesias: Iterable[str]
) -> List[str]:
    """
    Define quais módulos FORA do plano ficam liberados como cortesia.
    Módulos do plano são ignorados aqui (o plano já manda neles), evitando o
    conflito antigo entre o form de módulos da loja e a ativação por plano.
    """
    do_plano = set(modulos_do_plano(plano))
    desejadas: Set[str] = {c for c in cortesias if c not in do_plano}
    atuais = {m.nome_modulo: m for m in await _habilitados(db, loja_id)}

    for nome in desejadas:
        existente = atuais.get(nome)
        if existente:
            existente.ativo = True
            existente.cortesia = True
        else:
            db.add(ModuloHabilitado(
                loja_id=loja_id, nome_modulo=nome, ativo=True, cortesia=True,
            ))

    # Cortesia que o admin desmarcou volta a ficar desligada.
    for nome, mh in atuais.items():
        if mh.cortesia and mh.ativo and nome not in desejadas:
            mh.ativo = False

    return sorted(desejadas)


async def assinatura_vigente(db: AsyncSession, loja_id: str) -> Optional[Assinatura]:
    """Assinatura mais recente da loja, em qualquer status."""
    return (await db.execute(
        select(Assinatura)
        .where(Assinatura.loja_id == loja_id)
        .order_by(Assinatura.created_at.desc())
        .limit(1)
    )).scalar_one_or_none()


def acesso_liberado(assinatura: Optional[Assinatura], agora: Optional[datetime] = None) -> bool:
    """
    Regra única de "está em dia": precisa estar ATIVA **e** dentro do
    vencimento. Antes só o status era checado, então uma assinatura vencida
    seguia liberada até o worker diário rodar.
    """
    if not assinatura or assinatura.status != StatusAssinatura.ATIVA:
        return False
    if assinatura.proximo_vencimento is None:
        return True  # sem vencimento definido = liberada (legado / cortesia total)
    return assinatura.proximo_vencimento >= (agora or _now())


def proximo_vencimento_apos(base: Optional[datetime], meses: int, agora: Optional[datetime] = None) -> datetime:
    """
    Estende o vencimento sem acumular atraso: parte do vencimento atual se ele
    ainda está no futuro, senão parte de agora.
    """
    agora = agora or _now()
    inicio = base if (base and base > agora) else agora
    return inicio + timedelta(days=30 * meses)


async def reativar_loja(db: AsyncSession, loja_id: str) -> None:
    """
    Religa o login da loja. O worker de vencimento desativa `Loja.ativa` ao
    expirar; sem isso, reativar a assinatura deixava todo mundo fora do sistema.
    """
    loja = (await db.execute(select(Loja).where(Loja.id == loja_id))).scalar_one_or_none()
    if loja and not loja.ativa:
        loja.ativa = True
