"""
Testes unitários do gate financeiro por módulo liberado (rbac.can()).

Contexto: vendedor nunca tem Recurso.FINANCEIRO na matriz fixa
(PERMISSOES_MATRIZ), mas o gestor pode liberar o módulo "financeiro" por
vendedor via MembroLoja.modulos. Antes desta correção, o menu (front) usava
esse array para exibir o link, mas o backend sempre negava com 403 — bug
reportado com Carlos (vendedor) tendo "financeiro" liberado e recebendo 403
em GET /v1/financeiro/resumo e /v1/financeiro/lancamentos.
"""
from types import SimpleNamespace

from models import PapelUsuario
from rbac import Acao, Recurso, can


def _vendedor(ativo: bool = True) -> SimpleNamespace:
    return SimpleNamespace(papel=PapelUsuario.VENDEDOR, ativo=ativo)


def test_vendedor_sem_modulo_liberado_nao_ve_financeiro():
    assert can(_vendedor(), Acao.VER, Recurso.FINANCEIRO, modulos_liberados=None) is False
    assert can(_vendedor(), Acao.VER, Recurso.FINANCEIRO, modulos_liberados=["estoque", "crm"]) is False


def test_vendedor_com_modulo_liberado_ve_financeiro():
    assert can(_vendedor(), Acao.VER, Recurso.FINANCEIRO, modulos_liberados=["financeiro"]) is True


def test_vendedor_com_modulo_liberado_nao_cria_nem_edita_financeiro():
    modulos = ["financeiro"]
    assert can(_vendedor(), Acao.CRIAR, Recurso.FINANCEIRO, modulos_liberados=modulos) is False
    assert can(_vendedor(), Acao.EDITAR, Recurso.FINANCEIRO, modulos_liberados=modulos) is False


def test_vendedor_inativo_nunca_acessa_mesmo_com_modulo_liberado():
    assert can(_vendedor(ativo=False), Acao.VER, Recurso.FINANCEIRO, modulos_liberados=["financeiro"]) is False


def test_gestor_ve_financeiro_independente_de_modulos():
    gestor = SimpleNamespace(papel=PapelUsuario.GESTOR, ativo=True)
    assert can(gestor, Acao.VER, Recurso.FINANCEIRO, modulos_liberados=None) is True
