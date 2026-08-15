"""
Testes do texto de 403 devolvido pelo RBAC.

Contexto: o app mobile e o painel mostram o `detail` da resposta na tela de
erro. Enquanto o texto era "Permissão negada para ver o recurso veiculo.", o
usuário via um erro genérico de carregamento (com botão "Tentar de novo" que
nunca resolvia) em vez de saber que faltava liberação do gestor. Estes testes
prendem o contrato: a mensagem cita a tela e quem libera, sem jargão da matriz.
"""
from types import SimpleNamespace

from models import PapelUsuario
from rbac import Acao, Recurso, mensagem_permissao_negada


def _usuario(papel=PapelUsuario.VENDEDOR, ativo: bool = True) -> SimpleNamespace:
    return SimpleNamespace(papel=papel, ativo=ativo)


def test_mensagem_cita_papel_tela_e_quem_libera():
    msg = mensagem_permissao_negada(_usuario(), Acao.EXCLUIR, Recurso.VEICULO)
    assert "vendedor" in msg
    assert "excluir" in msg
    assert "estoque" in msg
    assert "gestor" in msg


def test_mensagem_nao_vaza_jargao_da_matriz():
    msg = mensagem_permissao_negada(_usuario(), Acao.VER, Recurso.CRM_LEAD)
    assert "recurso" not in msg.lower()
    assert Recurso.CRM_LEAD.value not in msg


def test_usuario_desativado_explica_reativacao():
    msg = mensagem_permissao_negada(_usuario(ativo=False), Acao.VER, Recurso.VEICULO)
    assert "desativado" in msg
    assert "Equipe" in msg


def test_cobre_todos_os_recursos_e_acoes_sem_cair_no_generico():
    for recurso in Recurso:
        for acao in Acao:
            msg = mensagem_permissao_negada(_usuario(PapelUsuario.GESTOR), acao, recurso)
            assert "este recurso" not in msg
            assert msg.endswith("Peça ao gestor da loja para liberar esse acesso em Equipe.")
