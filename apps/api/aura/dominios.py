"""
AURA — domínios de resposta que não são busca de veículo.

Comissão (seção 4.3) e ferramentas do sistema (seção 4.4). Ambos determinísticos:
a comissão sai da MESMA regra que a venda usa, não de um cálculo paralelo, e o
mapa de ferramentas é escrito à mão — a AURA não adivinha onde fica cada tela.
"""

from dataclasses import dataclass
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from lib_formatacao import formatar_moeda
from models import Loja, MembroLoja


@dataclass
class ComissaoCalculada:
    percentual: float
    origem: str                    # "membro" | "padrao_da_loja"
    valor_venda: Optional[float]
    valor_comissao: Optional[float]

    def para_contexto(self) -> str:
        origem_txt = (
            "percentual individual do vínculo" if self.origem == "membro"
            else "percentual padrão da loja"
        )
        linhas = [f"Percentual de comissão: {self.percentual:.2f}% ({origem_txt})."]
        if self.valor_venda is not None and self.valor_comissao is not None:
            linhas.append(
                f"Sobre uma venda de {formatar_moeda(self.valor_venda)}, "
                f"a comissão é {formatar_moeda(self.valor_comissao)}."
            )
        if self.percentual == 0:
            linhas.append("Atenção: o percentual está zerado — o gestor precisa defini-lo em Equipe.")
        return "\n".join(linhas)


async def calcular_comissao(
    *,
    db: AsyncSession,
    loja: Loja,
    usuario_id: str,
    valor_venda: Optional[float] = None,
) -> ComissaoCalculada:
    """
    Mesma regra da venda (`routers/contratos.py`): override do membro → padrão da
    loja → 0. Recalcular por fora criaria um segundo dono da regra, e ele diverge
    em silêncio (padrão a vigiar nº 25).

    O excedente de troca, que na venda soma na comissão, não entra aqui: ele só
    existe dentro de uma negociação concreta.
    """
    res = await db.execute(
        select(MembroLoja.percentual_comissao).where(
            MembroLoja.usuario_id == usuario_id,
            MembroLoja.loja_id == loja.id,
        )
    )
    percentual_membro = res.scalar_one_or_none()
    if percentual_membro is not None:
        percentual, origem = percentual_membro, "membro"
    else:
        percentual, origem = (loja.percentual_comissao_padrao or 0.0), "padrao_da_loja"

    valor_comissao = (
        round(valor_venda * (percentual / 100.0), 2) if valor_venda is not None else None
    )
    return ComissaoCalculada(
        percentual=percentual,
        origem=origem,
        valor_venda=valor_venda,
        valor_comissao=valor_comissao,
    )


# Mapa de ferramentas: o que a AURA sabe explicar e para onde ela manda o usuário.
# Rota é a do gestor web; o app usa a mesma chave para resolver o destino dele.
FERRAMENTAS = {
    "estoque": ("Cadastrar e gerenciar veículos", "/estoque"),
    "crm": ("Funil de vendas, leads e clientes", "/crm"),
    "simulador": ("Simulação de crédito com os bancos", "/ferramentas/simulador"),
    "contratos": ("Modelos e geração de contrato", "/ferramentas/contratos"),
    "marketing": ("Gerar post e anúncio a partir de um veículo", "/ferramentas/marketing"),
    "repasse": ("Feed de repasse entre lojas parceiras", "/rede-social"),
    "financeiro": ("Caixa, despesas e recebimentos", "/financeiro"),
    "pos_venda": ("Esteira de pós-venda: contrato → pagamento → transferência", "/pos-venda"),
    "equipe": ("Vendedores, permissões e comissão", "/equipe"),
    "assinatura": ("Plano, módulos e cobrança", "/configuracoes"),
    "assistente_ia": ("Assistente que responde clientes no WhatsApp", "/assistente-ia"),
    "vitrine": ("Vitrine pública da loja", "/configuracoes"),
}


def contexto_de_ferramentas() -> str:
    """Bloco de contexto com as telas do sistema, para o domínio 'ferramenta'."""
    linhas = ["Telas do sistema (use estes nomes e caminhos, não invente outros):"]
    linhas += [f"- {descricao} → {rota}" for descricao, rota in FERRAMENTAS.values()]
    return "\n".join(linhas)
