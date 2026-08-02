"""
AURA — matriz de permissões (seção 12 da spec).

A AURA nunca alarga o que o usuário já pode ver: a decisão é derivada do papel
e dos módulos que o gestor liberou para o vínculo, exatamente como o resto do
sistema faz. Este módulo só traduz aquela matriz em perguntas objetivas — quem
decide continua sendo `rbac.py` e `modulos.py`.
"""

import json
from dataclasses import dataclass
from typing import Optional

from deps import B2BContext
from models import PapelUsuario


@dataclass(frozen=True)
class EscopoAura:
    """O que a AURA pode olhar nesta requisição."""
    papel: PapelUsuario
    ve_custo_e_margem: bool     # preço de custo e margem da própria loja
    ve_financeiro: bool         # caixa, despesas, DRE da loja
    ve_comissao_de_terceiros: bool
    ve_equipe: bool
    edita_memoria_da_loja: bool

    @property
    def eh_gestor_ou_admin(self) -> bool:
        return self.papel in (PapelUsuario.GESTOR, PapelUsuario.ADMIN_PLATAFORMA)


def modulos_do_vinculo(context: B2BContext) -> Optional[list[str]]:
    """Módulos liberados ao vínculo. `None` = sem restrição por vínculo (gestor)."""
    if not context.membro or not context.membro.modulos:
        return None
    try:
        valor = json.loads(context.membro.modulos)
    except (ValueError, TypeError):
        return None
    return valor if isinstance(valor, list) else None


def resolver_escopo(context: B2BContext) -> EscopoAura:
    """Traduz papel + módulos do vínculo na matriz da seção 12."""
    papel = context.usuario.papel
    gestor = papel in (PapelUsuario.GESTOR, PapelUsuario.ADMIN_PLATAFORMA)
    liberados = modulos_do_vinculo(context)
    # Vendedor só alcança financeiro/custo se o gestor liberou o módulo para o
    # vínculo — a mesma regra do `rbac.can`, não uma cópia com critério próprio.
    financeiro_liberado = bool(liberados) and "financeiro" in liberados

    return EscopoAura(
        papel=papel,
        ve_custo_e_margem=gestor or financeiro_liberado,
        ve_financeiro=gestor or financeiro_liberado,
        ve_comissao_de_terceiros=gestor,
        ve_equipe=gestor,
        edita_memoria_da_loja=gestor,
    )
