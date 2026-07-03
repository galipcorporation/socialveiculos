"""
Social Veículos — Motor de Controle de Acesso Baseado em Papéis (RBAC)
"""

import enum
import json
from fastapi import Depends, HTTPException, status
from typing import Callable, Optional

from models import PapelUsuario, Usuario
from deps import B2BContext, get_current_b2b_user

# Enums de Ações e Recursos
class Acao(str, enum.Enum):
    CRIAR = "criar"
    EDITAR = "editar"
    EXCLUIR = "excluir"
    VER = "ver"
    APROVAR = "aprovar"
    PUBLICAR = "publicar"
    ADMINISTRAR = "administrar"


class Recurso(str, enum.Enum):
    VEICULO = "veiculo"
    CRM_CLIENTE = "crm_cliente"
    CRM_LEAD = "crm_lead"
    FINANCEIRO = "financeiro"
    CONFIGURACOES = "configuracoes"
    MEMBRO_EQUIPE = "membro_equipe"
    APROVACOES = "aprovacoes"


# Matriz de Permissões: PapelUsuario -> { Recurso -> set[Acao] }
PERMISSOES_MATRIZ: dict[PapelUsuario, dict[Recurso, set[Acao]]] = {
    PapelUsuario.ADMIN_PLATAFORMA: {
        recurso: set(Acao) for recurso in Recurso
    },
    PapelUsuario.GESTOR: {
        Recurso.VEICULO: {Acao.CRIAR, Acao.EDITAR, Acao.EXCLUIR, Acao.VER, Acao.PUBLICAR},
        Recurso.CRM_CLIENTE: {Acao.CRIAR, Acao.EDITAR, Acao.EXCLUIR, Acao.VER},
        Recurso.CRM_LEAD: {Acao.CRIAR, Acao.EDITAR, Acao.EXCLUIR, Acao.VER},
        Recurso.FINANCEIRO: {Acao.CRIAR, Acao.EDITAR, Acao.VER},
        Recurso.CONFIGURACOES: {Acao.EDITAR, Acao.VER},
        Recurso.MEMBRO_EQUIPE: {Acao.CRIAR, Acao.EDITAR, Acao.EXCLUIR, Acao.VER},
        Recurso.APROVACOES: {Acao.VER, Acao.APROVAR},
    },
    PapelUsuario.VENDEDOR: {
        Recurso.VEICULO: {Acao.CRIAR, Acao.EDITAR, Acao.VER, Acao.PUBLICAR}, # Excluir exige aprovação do gestor
        Recurso.CRM_CLIENTE: {Acao.CRIAR, Acao.EDITAR, Acao.VER}, # Sem exclusão
        Recurso.CRM_LEAD: {Acao.CRIAR, Acao.EDITAR, Acao.VER}, # Sem exclusão
        Recurso.CONFIGURACOES: {Acao.VER},
        # Sem acesso a membros, financeiro ou aprovações
    },
    PapelUsuario.CLIENTE: {
        Recurso.VEICULO: {Acao.VER},
    }
}


def can(usuario: Usuario, acao: Acao, recurso: Recurso, modulos_liberados: Optional[list[str]] = None) -> bool:
    """
    Retorna True se o usuário possui a permissão especificada na matriz.

    ``modulos_liberados`` é o array de módulos que o gestor liberou para o
    vínculo (MembroLoja.modulos) do vendedor na loja atual. Hoje só é usado
    para conceder VER em Financeiro a vendedores com o módulo liberado
    (gestor acompanha comissão pelo Financeiro; vendedor só enxerga se liberado).
    """
    # Usuários inativos não podem fazer nada
    if not usuario.ativo:
        return False

    # Admin de plataforma (suporte) tem acesso a tudo, independentemente da matriz
    if usuario.papel == PapelUsuario.ADMIN_PLATAFORMA:
        return True

    perm_recurso = PERMISSOES_MATRIZ.get(usuario.papel, {})
    perm_acoes = perm_recurso.get(recurso, set())

    if acao in perm_acoes or Acao.ADMINISTRAR in perm_acoes:
        return True

    if (
        usuario.papel == PapelUsuario.VENDEDOR
        and recurso == Recurso.FINANCEIRO
        and acao == Acao.VER
        and modulos_liberados is not None
        and "financeiro" in modulos_liberados
    ):
        return True

    return False


def exige_permissao(acao: Acao, recurso: Recurso) -> Callable:
    """
    Dependência do FastAPI que lança HTTP 403 Forbidden se o usuário ativo
    não possuir permissão para executar a ação no recurso.
    """
    async def dependencia(context: B2BContext = Depends(get_current_b2b_user)):
        modulos_liberados = None
        if context.membro and context.membro.modulos:
            try:
                modulos_liberados = json.loads(context.membro.modulos)
            except (TypeError, ValueError):
                modulos_liberados = None

        if not can(context.usuario, acao, recurso, modulos_liberados):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permissão negada para {acao.value} o recurso {recurso.value}."
            )
        return context.usuario

    return dependencia
