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


_UNIDADES = ("", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove")
_DEZ_A_DEZENOVE = ("dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis",
                   "dezessete", "dezoito", "dezenove")
_DEZENAS = ("", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta",
            "setenta", "oitenta", "noventa")
_CENTENAS = ("", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
             "seiscentos", "setecentos", "oitocentos", "novecentos")

_MESES = ("janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
          "agosto", "setembro", "outubro", "novembro", "dezembro")


def _grupo_extenso(n: int) -> str:
    """Escreve um número de 1 a 999 por extenso."""
    if n == 100:
        return "cem"
    partes = []
    centena, resto = divmod(n, 100)
    if centena:
        partes.append(_CENTENAS[centena])
    if resto:
        if resto < 10:
            partes.append(_UNIDADES[resto])
        elif resto < 20:
            partes.append(_DEZ_A_DEZENOVE[resto - 10])
        else:
            dezena, unidade = divmod(resto, 10)
            partes.append(_DEZENAS[dezena] if not unidade
                          else f"{_DEZENAS[dezena]} e {_UNIDADES[unidade]}")
    return " e ".join(partes)


def _inteiro_extenso(n: int) -> str:
    """Escreve um inteiro de 0 a 999.999.999 por extenso."""
    if n == 0:
        return "zero"
    milhoes, resto = divmod(n, 1_000_000)
    milhares, unidades = divmod(resto, 1000)
    partes = []
    if milhoes:
        partes.append("um milhão" if milhoes == 1 else f"{_grupo_extenso(milhoes)} milhões")
    if milhares:
        partes.append("mil" if milhares == 1 else f"{_grupo_extenso(milhares)} mil")
    if unidades:
        partes.append(_grupo_extenso(unidades))
    # "e" antes do último grupo só quando ele é pequeno ou redondo (norma pt-BR)
    if len(partes) > 1 and unidades and (unidades < 100 or unidades % 100 == 0):
        return f"{' '.join(partes[:-1])} e {partes[-1]}"
    return " ".join(partes)


def valor_por_extenso(valor: Optional[Union[float, Decimal, int]]) -> str:
    """
    Escreve um valor monetário por extenso em pt-BR, para uso em contratos:
    1234.56 → "mil duzentos e trinta e quatro reais e cinquenta e seis centavos".
    """
    if valor is None:
        valor = 0
    centavos_totais = int(round(float(valor) * 100))
    reais, centavos = divmod(abs(centavos_totais), 100)

    partes = []
    if reais == 1:
        partes.append("um real")
    elif reais:
        # Milhão/bilhão redondo pede a preposição: "um milhão DE reais".
        de = " de" if reais >= 1_000_000 and reais % 1_000_000 == 0 else ""
        partes.append(f"{_inteiro_extenso(reais)}{de} reais")
    if centavos:
        partes.append(f"{_inteiro_extenso(centavos)} {'centavo' if centavos == 1 else 'centavos'}")
    if not partes:
        return "zero real"

    texto = " e ".join(partes)
    return f"menos {texto}" if centavos_totais < 0 else texto


def data_por_extenso(data) -> str:
    """Data no formato de fechamento de contrato: "26 de julho de 2026"."""
    if data is None:
        return ""
    return f"{data.day} de {_MESES[data.month - 1]} de {data.year}"
