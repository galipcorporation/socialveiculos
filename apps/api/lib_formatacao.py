"""
Social Veículos — Formatação central de valores.
Padrão do projeto: dinheiro/CPF/CNPJ/telefone/CEP sempre via função própria,
nunca `f"{x:,.2f}"` cru espalhado pelo código (esse formato é en-US: vírgula
de milhar e ponto decimal — errado para pt-BR e fácil de esquecer o replace).
"""

from decimal import Decimal
from typing import Optional, Union


def formatar_moeda(valor: Optional[Union[float, Decimal, int]]) -> str:
    """
    Formata um valor numérico como moeda brasileira: "R$ 1.234,56".
    Retorna "R$ 0,00" se valor for None.
    """
    if valor is None:
        valor = 0
    return f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
