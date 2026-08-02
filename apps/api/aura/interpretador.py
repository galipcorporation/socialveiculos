"""
AURA — passo 1 da busca: entender a frase.

A frase do usuário vira critérios estruturados. É o ÚNICO ponto em que a IA
toca a pergunta bruta, e mesmo aqui ela não monta consulta: devolve um JSON
com campos previstos, que `busca.py` valida e converte em filtros. A frase
nunca escolhe o escopo — loja e papel entram depois, na origem da consulta.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ia_client import chamar_ia
from models import TipoCambio, TipoCombustivel

# Domínios que a AURA cobre (seção 4 da spec).
DOMINIO_ESTOQUE = "estoque"
DOMINIO_REPASSE = "repasse"
DOMINIO_CRM = "crm"
DOMINIO_COMISSAO = "comissao"
DOMINIO_FERRAMENTA = "ferramenta"
DOMINIO_FORA = "fora_de_escopo"
DOMINIO_AMBIGUO = "ambiguo"

DOMINIOS_VALIDOS = {
    DOMINIO_ESTOQUE, DOMINIO_REPASSE, DOMINIO_CRM,
    DOMINIO_COMISSAO, DOMINIO_FERRAMENTA, DOMINIO_FORA, DOMINIO_AMBIGUO,
}

_CAMBIOS = {c.value for c in TipoCambio}
_COMBUSTIVEIS = {c.value for c in TipoCombustivel}
_CARROCERIAS = {"sedan", "hatch", "suv", "pickup", "picape", "van", "utilitario", "cupe", "conversivel"}
_TIPOS = {"carro", "moto", "caminhao", "onibus", "barco", "jetski", "aeronave", "maquina"}


@dataclass
class CriteriosBusca:
    """Critérios extraídos da frase. Tudo opcional — nada aqui é obrigatório."""
    marca: Optional[str] = None
    modelo: Optional[str] = None
    versao: Optional[str] = None
    ano_min: Optional[int] = None
    ano_max: Optional[int] = None
    km_max: Optional[int] = None
    cor: Optional[str] = None
    cambio: Optional[str] = None
    combustivel: Optional[str] = None
    carroceria: Optional[str] = None
    tipo: Optional[str] = None
    preco_min: Optional[float] = None
    preco_max: Optional[float] = None
    opcionais: list[str] = field(default_factory=list)

    def vazio(self) -> bool:
        return not any([
            self.marca, self.modelo, self.versao, self.ano_min, self.ano_max,
            self.km_max, self.cor, self.cambio, self.combustivel,
            self.carroceria, self.tipo, self.preco_min, self.preco_max, self.opcionais,
        ])

    def resumo(self) -> str:
        """Texto curto do que foi buscado — a AURA sempre diz o que procurou."""
        partes = []
        if self.marca:
            partes.append(self.marca)
        if self.modelo:
            partes.append(self.modelo)
        if self.versao:
            partes.append(self.versao)
        if self.ano_min and self.ano_max:
            partes.append(f"{self.ano_min}–{self.ano_max}")
        elif self.ano_min:
            partes.append(f"a partir de {self.ano_min}")
        elif self.ano_max:
            partes.append(f"até {self.ano_max}")
        if self.km_max:
            partes.append(f"até {self.km_max:,} km".replace(",", "."))
        if self.cor:
            partes.append(f"cor {self.cor}")
        if self.cambio:
            partes.append(self.cambio)
        if self.combustivel:
            partes.append(self.combustivel)
        if self.carroceria:
            partes.append(self.carroceria)
        if self.preco_max:
            partes.append(f"até R$ {self.preco_max:,.0f}".replace(",", "."))
        if self.preco_min:
            partes.append(f"a partir de R$ {self.preco_min:,.0f}".replace(",", "."))
        if self.opcionais:
            partes.append("com " + ", ".join(self.opcionais))
        return " · ".join(partes) if partes else "sem critérios específicos"

    def para_dict(self) -> dict:
        return {k: v for k, v in self.__dict__.items() if v not in (None, [], "")}


@dataclass
class Interpretacao:
    dominio: str
    criterios: CriteriosBusca
    pergunta_de_volta: Optional[str] = None
    assunto: Optional[str] = None  # texto livre para CRM/comissão/ferramenta


_PROMPT = """Você interpreta a frase de um lojista de veículos e devolve APENAS um JSON.

Escolha um domínio:
- "estoque": procura veículo (no estoque próprio e no repasse de parceiros)
- "repasse": explicitamente sobre carro de parceiro / repasse
- "crm": clientes, leads, funil, negociações, simulações de crédito
- "comissao": quanto o vendedor ganha numa venda
- "ferramenta": como usar o sistema (onde cadastro, como gero contrato, etc.)
- "ambiguo": a frase não dá para virar busca sem uma pergunta de volta
- "fora_de_escopo": não tem relação com a loja de veículos

Formato exato:
{
  "dominio": "estoque",
  "criterios": {
    "marca": null, "modelo": null, "versao": null,
    "ano_min": null, "ano_max": null, "km_max": null,
    "cor": null, "cambio": null, "combustivel": null,
    "carroceria": null, "tipo": null,
    "preco_min": null, "preco_max": null, "opcionais": []
  },
  "pergunta_de_volta": null,
  "assunto": null
}

Regras:
- "cambio" só pode ser: manual, automatico, cvt, automatizado.
- "combustivel" só pode ser: gasolina, etanol, flex, diesel, eletrico, hibrido, gnv.
- "carroceria" só pode ser: sedan, hatch, suv, pickup, van, utilitario, cupe, conversivel.
- "tipo" só pode ser: carro, moto, caminhao, onibus, barco, jetski, aeronave, maquina.
- Nomes de modelo em português do Brasil como o lojista fala (Hilux, Compass, Corolla Cross, Strada).
- "até 45 mil km" → km_max: 45000. "até 100 mil" falando de preço → preco_max: 100000.
- "2020 pra cima" → ano_min: 2020. "2020" sozinho → ano_min e ano_max iguais a 2020.
- Se a frase for vaga demais ("um carro bom pra família"), use dominio "ambiguo" e escreva
  em "pergunta_de_volta" UMA pergunta curta e objetiva que destrave a busca.
- Nunca invente marca, modelo ou valor que não esteja na frase.
- Responda só o JSON, sem comentário e sem markdown."""


def _inteiro(valor) -> Optional[int]:
    try:
        n = int(float(valor))
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _decimal(valor) -> Optional[float]:
    try:
        n = float(valor)
    except (TypeError, ValueError):
        return None
    return n if n > 0 else None


def _texto(valor, maximo: int = 100) -> Optional[str]:
    if not isinstance(valor, str):
        return None
    limpo = valor.strip()
    return limpo[:maximo] if limpo else None


def _do_conjunto(valor, permitidos: set[str]) -> Optional[str]:
    limpo = _texto(valor, 30)
    if not limpo:
        return None
    normalizado = limpo.lower()
    if normalizado == "picape":
        normalizado = "pickup"
    return normalizado if normalizado in permitidos else None


def _criterios_do_json(bruto: dict) -> CriteriosBusca:
    """Converte o JSON do modelo em critérios, descartando o que não é previsto.

    Nada aqui confia no modelo: campo desconhecido é ignorado, enum fora da lista
    vira None. É a fronteira entre texto livre e consulta ao banco.
    """
    opcionais_bruto = bruto.get("opcionais") or []
    opcionais = [
        o.strip()[:60] for o in opcionais_bruto
        if isinstance(o, str) and o.strip()
    ][:8] if isinstance(opcionais_bruto, list) else []

    ano_min = _inteiro(bruto.get("ano_min"))
    ano_max = _inteiro(bruto.get("ano_max"))
    if ano_min and ano_max and ano_min > ano_max:
        ano_min, ano_max = ano_max, ano_min

    preco_min = _decimal(bruto.get("preco_min"))
    preco_max = _decimal(bruto.get("preco_max"))
    if preco_min and preco_max and preco_min > preco_max:
        preco_min, preco_max = preco_max, preco_min

    return CriteriosBusca(
        marca=_texto(bruto.get("marca")),
        modelo=_texto(bruto.get("modelo"), 200),
        versao=_texto(bruto.get("versao"), 200),
        ano_min=ano_min if ano_min and 1900 <= ano_min <= 2100 else None,
        ano_max=ano_max if ano_max and 1900 <= ano_max <= 2100 else None,
        km_max=_inteiro(bruto.get("km_max")),
        cor=_texto(bruto.get("cor"), 50),
        cambio=_do_conjunto(bruto.get("cambio"), _CAMBIOS),
        combustivel=_do_conjunto(bruto.get("combustivel"), _COMBUSTIVEIS),
        carroceria=_do_conjunto(bruto.get("carroceria"), _CARROCERIAS),
        tipo=_do_conjunto(bruto.get("tipo"), _TIPOS),
        preco_min=preco_min,
        preco_max=preco_max,
        opcionais=opcionais,
    )


def _extrair_json(texto: str) -> Optional[dict]:
    """Modelo às vezes embrulha o JSON em markdown; pegar o primeiro objeto."""
    try:
        return json.loads(texto)
    except (ValueError, TypeError):
        pass
    achado = re.search(r"\{.*\}", texto, re.DOTALL)
    if not achado:
        return None
    try:
        return json.loads(achado.group(0))
    except (ValueError, TypeError):
        return None


async def interpretar(
    *,
    db: AsyncSession,
    loja_id: str,
    usuario_id: str,
    frase: str,
) -> tuple[Interpretacao, int, int]:
    """Frase → (interpretação, tokens_input, tokens_output)."""
    resposta = await chamar_ia(
        db=db,
        loja_id=loja_id,
        usuario_id=usuario_id,
        funcionalidade="aura",
        prompt_system=_PROMPT,
        conteudo=frase.strip()[:1000],
        max_tokens=500,
        temperatura=0.0,
        json_mode=True,
    )

    bruto = _extrair_json(resposta.texto) or {}
    dominio = bruto.get("dominio")
    if dominio not in DOMINIOS_VALIDOS:
        dominio = DOMINIO_AMBIGUO

    criterios_bruto = bruto.get("criterios")
    criterios = _criterios_do_json(criterios_bruto) if isinstance(criterios_bruto, dict) else CriteriosBusca()

    # Domínio de busca sem nenhum critério é ambiguidade disfarçada — perguntar
    # de volta é melhor que devolver o estoque inteiro.
    pergunta = _texto(bruto.get("pergunta_de_volta"), 300)
    if dominio in (DOMINIO_ESTOQUE, DOMINIO_REPASSE) and criterios.vazio() and not pergunta:
        dominio = DOMINIO_AMBIGUO
        pergunta = "O que você está procurando? Me diga modelo, ano ou faixa de preço."

    return (
        Interpretacao(
            dominio=dominio,
            criterios=criterios,
            pergunta_de_volta=pergunta,
            assunto=_texto(bruto.get("assunto"), 300),
        ),
        resposta.tokens_input,
        resposta.tokens_output,
    )
