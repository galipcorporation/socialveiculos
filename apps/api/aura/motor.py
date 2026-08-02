"""
AURA — orquestração de uma pergunta (seção 11.3 da spec).

Ordem obrigatória: resolver quem é / de qual loja / com qual papel → interpretar
→ buscar (já filtrado na origem) → montar contexto → a IA REDIGE → gravar,
contabilizar e auditar.

A IA nunca monta consulta e nunca escreve no banco de negócio (ADR-2, ADR-5).
"""

import json
import logging
import os
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from aura import dominios, interpretador
from aura.busca import ResultadoBusca, VeiculoEncontrado, buscar_veiculos
from aura.permissoes import EscopoAura, resolver_escopo
from deps import B2BContext
from ia_client import chamar_ia
from lib_formatacao import formatar_moeda
from models import (
    AURA_AUTOR_AURA,
    AURA_AUTOR_USUARIO,
    AuraConversa,
    AuraMensagem,
    MarketingUsage,
    utcnow,
)

logger = logging.getLogger("aura")

# Cota mensal de perguntas por loja. `Loja.aura_cota_mensal` sobrescreve por loja.
AURA_COTA_PADRAO = int(os.getenv("AURA_COTA_PADRAO", "300"))

# Quantos turnos anteriores entram no contexto. Contexto enxuto por desenho: é a
# principal defesa contra custo imprevisível (seção 13.3).
TURNOS_DE_HISTORICO = 6

FUNCIONALIDADE = "aura"


class CotaEsgotada(Exception):
    """Evento `aura_cota_esgotada` — a loja bateu o teto do mês."""

    def __init__(self, usadas: int, cota: int):
        self.usadas = usadas
        self.cota = cota
        super().__init__(f"Cota da AURA esgotada ({usadas}/{cota} perguntas no mês).")


@dataclass
class Atalho:
    rotulo: str
    destino: str
    params: dict = field(default_factory=dict)

    def para_dict(self) -> dict:
        return {"rotulo": self.rotulo, "destino": self.destino, "params": self.params}


@dataclass
class RespostaAura:
    texto: str
    atalhos: list[Atalho]
    buscas: dict
    tokens_input: int
    tokens_output: int
    latencia_ms: int
    provedor: Optional[str]
    modelo: Optional[str]


# ─────────────────────────────────────────────────────────────
# Cota
# ─────────────────────────────────────────────────────────────

def _inicio_do_mes() -> datetime:
    """Naive UTC — datetime aware como parâmetro de query é 500 no Postgres."""
    return utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


async def consumo_do_mes(db: AsyncSession, loja_id: str) -> int:
    """Perguntas da AURA já feitas pela loja no mês corrente.

    Conta a mensagem do USUÁRIO, não a chamada de IA: uma pergunta consome duas
    chamadas (interpretar + redigir) e o lojista conta por pergunta.
    """
    inicio = _inicio_do_mes()
    res = await db.execute(
        select(func.count(AuraMensagem.id)).where(
            AuraMensagem.loja_id == loja_id,
            AuraMensagem.autor == AURA_AUTOR_USUARIO,
            AuraMensagem.created_at >= inicio,
        )
    )
    return res.scalar_one() or 0


def cota_da_loja(loja) -> int:
    cota = getattr(loja, "aura_cota_mensal", None)
    return cota if cota is not None else AURA_COTA_PADRAO


async def custo_do_mes(db: AsyncSession, loja_id: str) -> dict:
    """Tokens da AURA no mês, para o painel de consumo do admin."""
    inicio = _inicio_do_mes()
    res = await db.execute(
        select(
            func.coalesce(func.sum(MarketingUsage.tokens_input), 0),
            func.coalesce(func.sum(MarketingUsage.tokens_output), 0),
        ).where(
            MarketingUsage.loja_id == loja_id,
            MarketingUsage.funcionalidade == FUNCIONALIDADE,
            MarketingUsage.created_at >= inicio,
        )
    )
    entrada, saida = res.one()
    return {"tokens_input": entrada, "tokens_output": saida}


# ─────────────────────────────────────────────────────────────
# Conversa
# ─────────────────────────────────────────────────────────────

async def obter_ou_criar_conversa(
    db: AsyncSession, loja_id: str, usuario_id: str,
) -> AuraConversa:
    """Uma conversa por usuário por loja. Privada: ninguém mais lê."""
    res = await db.execute(
        select(AuraConversa).where(
            AuraConversa.loja_id == loja_id,
            AuraConversa.usuario_id == usuario_id,
        )
    )
    conversa = res.scalar_one_or_none()
    if conversa:
        return conversa

    conversa = AuraConversa(loja_id=loja_id, usuario_id=usuario_id)
    db.add(conversa)
    await db.commit()
    await db.refresh(conversa)
    return conversa


async def _historico(db: AsyncSession, conversa_id: str) -> list[AuraMensagem]:
    res = await db.execute(
        select(AuraMensagem)
        .where(AuraMensagem.conversa_id == conversa_id)
        .order_by(AuraMensagem.created_at.desc())
        .limit(TURNOS_DE_HISTORICO * 2)
    )
    return list(reversed(res.scalars().all()))


# ─────────────────────────────────────────────────────────────
# Contexto para a redação
# ─────────────────────────────────────────────────────────────

def _ficha(v: VeiculoEncontrado, *, parceiro: bool) -> str:
    partes = [f"{v.marca} {v.modelo}".strip()]
    if v.versao:
        partes.append(v.versao)
    partes.append(f"{v.ano_fabricacao}/{v.ano_modelo}")
    if v.km is not None:
        partes.append(f"{v.km:,} km".replace(",", "."))
    for campo in (v.cor, v.cambio, v.combustivel):
        if campo:
            partes.append(campo)

    linha = " · ".join(partes)
    if parceiro:
        local = " / ".join(p for p in (v.loja_cidade, v.loja_estado) if p)
        linha += f"\n  Repasse: {formatar_moeda(v.valor_repasse)} — {v.loja_nome or 'parceiro'}"
        if local:
            linha += f" ({local})"
        linha += f"\n  [id_publicacao: {v.publicacao_id}]"
    else:
        linha += f"\n  Preço de venda: {formatar_moeda(v.preco_venda)}"
        if v.preco_custo is not None:
            margem = (v.preco_venda or 0) - v.preco_custo
            linha += f" · custo {formatar_moeda(v.preco_custo)} · margem {formatar_moeda(margem)}"
        if v.dias_em_estoque is not None:
            linha += f"\n  {v.dias_em_estoque} dias em estoque"
        linha += f"\n  [id_veiculo: {v.id}]"
    return linha


def _contexto_da_busca(resultado: ResultadoBusca) -> str:
    blocos = [f"CRITÉRIOS BUSCADOS: {json.dumps(resultado.criterios_usados, ensure_ascii=False)}"]

    if resultado.relaxamentos_aplicados:
        blocos.append(
            "CRITÉRIOS AFROUXADOS (diga isso na resposta): "
            + "; ".join(resultado.relaxamentos_aplicados)
        )

    if resultado.proprios:
        blocos.append("ESTOQUE PRÓPRIO — encontrados:\n" + "\n".join(
            f"{i}. {_ficha(v, parceiro=False)}" for i, v in enumerate(resultado.proprios, 1)
        ))
    else:
        blocos.append(
            f"ESTOQUE PRÓPRIO: nenhum veículo bate com os critérios "
            f"(a loja tem {resultado.total_proprios_sem_filtro} veículos ativos no total)."
        )

    if resultado.parceiros:
        blocos.append(
            "REPASSE DE PARCEIROS — encontrados (ordenados do mais perto para o mais longe):\n"
            + "\n".join(f"{i}. {_ficha(v, parceiro=True)}" for i, v in enumerate(resultado.parceiros, 1))
        )
    else:
        blocos.append("REPASSE DE PARCEIROS: nenhum veículo de parceiro bate com os critérios.")

    return "\n\n".join(blocos)


def _prompt_de_redacao(escopo: EscopoAura, nome_usuario: str, nome_loja: str) -> str:
    regras_de_papel = (
        "Você PODE citar preço de custo e margem da própria loja."
        if escopo.ve_custo_e_margem
        else "NUNCA cite preço de custo nem margem — o usuário não tem acesso a esses números."
    )
    return f"""Você é a AURA, assistente interna da loja de veículos {nome_loja}.
Está falando com {nome_usuario}, que trabalha na loja. Ele NÃO é cliente.

Como você escreve:
- Português do Brasil, direto, no jeito de quem trabalha em loja de carro.
- Curto. Duas a cinco linhas na maioria das respostas.
- Sem saudação genérica, sem "espero ter ajudado", sem se apresentar de novo.
- Nada de emoji, a não ser que fique natural. No máximo um.

Regras que você NUNCA quebra:
1. Todo veículo, preço, quilometragem e nome de loja que você citar tem que estar
   no CONTEXTO abaixo. Se não está lá, não existe. Não invente e não arredonde
   valor que não foi dado.
2. Se o contexto diz que não achou nada, diga isso com todas as letras e ofereça
   o próximo passo. Não preencha o vazio com sugestão inventada.
3. Se algum critério foi afrouxado, avise qual foi, na mesma resposta.
4. Quando houver carro de parceiro que atende e o próprio não atende, deixe esse
   contraste claro — é a informação mais útil que você tem.
5. {regras_de_papel}
6. Nunca cite custo ou margem de loja parceira. Só o valor de repasse publicado.
7. Você não executa ação nenhuma: não cria lead, não move funil, não manda
   proposta. Você aponta o caminho e quem faz é a pessoa.

Responda só com o texto da mensagem, sem título e sem markdown de cabeçalho."""


# ─────────────────────────────────────────────────────────────
# Atalhos
# ─────────────────────────────────────────────────────────────

def _atalhos_da_busca(resultado: ResultadoBusca) -> list[Atalho]:
    atalhos: list[Atalho] = []
    if resultado.proprios:
        primeiro = resultado.proprios[0]
        atalhos.append(Atalho("Abrir no estoque", "/estoque", {"veiculo_id": primeiro.id}))
    if resultado.parceiros:
        primeiro = resultado.parceiros[0]
        atalhos.append(Atalho(
            "Ver no feed de repasse", "/rede-social",
            {"publicacao_id": primeiro.publicacao_id, "aba": "feed"},
        ))
        atalhos.append(Atalho(
            "Falar com o parceiro", "/rede-social",
            {"publicacao_id": primeiro.publicacao_id, "aba": "chat"},
        ))
    if not resultado.proprios and not resultado.parceiros:
        atalhos.append(Atalho("Cadastrar veículo", "/estoque", {"novo": True}))
    return atalhos[:3]


# ─────────────────────────────────────────────────────────────
# Fluxo principal
# ─────────────────────────────────────────────────────────────

async def responder(
    *,
    db: AsyncSession,
    context: B2BContext,
    conversa: AuraConversa,
    pergunta: str,
) -> tuple[AuraMensagem, AuraMensagem]:
    """
    Processa uma pergunta e devolve (mensagem do usuário, mensagem da AURA).

    Levanta `CotaEsgotada` antes de gastar qualquer token.
    """
    loja = context.loja
    if loja is None:
        raise ValueError("AURA exige loja no contexto.")

    cota = cota_da_loja(loja)
    usadas = await consumo_do_mes(db, loja.id)
    if usadas >= cota:
        raise CotaEsgotada(usadas, cota)

    escopo = resolver_escopo(context)
    inicio = time.monotonic()

    msg_usuario = AuraMensagem(
        conversa_id=conversa.id,
        loja_id=loja.id,
        autor=AURA_AUTOR_USUARIO,
        conteudo=pergunta.strip()[:2000],
    )
    db.add(msg_usuario)
    await db.commit()
    await db.refresh(msg_usuario)

    resposta = await _produzir_resposta(
        db=db, context=context, conversa=conversa, escopo=escopo, pergunta=pergunta,
    )
    resposta.latencia_ms = int((time.monotonic() - inicio) * 1000)

    msg_aura = AuraMensagem(
        conversa_id=conversa.id,
        loja_id=loja.id,
        autor=AURA_AUTOR_AURA,
        conteudo=resposta.texto,
        atalhos=json.dumps([a.para_dict() for a in resposta.atalhos], ensure_ascii=False),
        buscas=json.dumps(resposta.buscas, ensure_ascii=False),
        tokens_input=resposta.tokens_input,
        tokens_output=resposta.tokens_output,
        latencia_ms=resposta.latencia_ms,
        provedor=resposta.provedor,
        modelo=resposta.modelo,
    )
    db.add(msg_aura)
    conversa.ultima_mensagem_em = utcnow()
    await db.commit()
    await db.refresh(msg_aura)

    logger.info(
        f"[AURA] loja={loja.id} usuario={context.usuario.id} "
        f"tokens={resposta.tokens_input}+{resposta.tokens_output} "
        f"latencia={resposta.latencia_ms}ms buscas={resposta.buscas}"
    )
    return msg_usuario, msg_aura


async def _produzir_resposta(
    *,
    db: AsyncSession,
    context: B2BContext,
    conversa: AuraConversa,
    escopo: EscopoAura,
    pergunta: str,
) -> RespostaAura:
    loja = context.loja
    usuario = context.usuario

    interpretacao, tk_in, tk_out = await interpretador.interpretar(
        db=db, loja_id=loja.id, usuario_id=usuario.id, frase=pergunta,
    )
    dominio = interpretacao.dominio
    buscas: dict = {"dominio": dominio}

    # Ambiguidade se pergunta, não se adivinha — e sem gastar uma segunda
    # chamada de IA para redigir uma pergunta que já veio pronta.
    if dominio == interpretador.DOMINIO_AMBIGUO:
        return RespostaAura(
            texto=interpretacao.pergunta_de_volta or "Me dá um pouco mais de detalhe?",
            atalhos=[],
            buscas=buscas,
            tokens_input=tk_in,
            tokens_output=tk_out,
            latencia_ms=0,
            provedor=None,
            modelo=None,
        )

    if dominio == interpretador.DOMINIO_FORA:
        return RespostaAura(
            texto=(
                "Isso está fora do que eu alcanço. Eu ajudo com estoque, repasse "
                "de parceiros, clientes do CRM, comissão e como usar o sistema."
            ),
            atalhos=[],
            buscas=buscas,
            tokens_input=tk_in,
            tokens_output=tk_out,
            latencia_ms=0,
            provedor=None,
            modelo=None,
        )

    atalhos: list[Atalho] = []
    blocos_de_contexto: list[str] = []

    if dominio in (interpretador.DOMINIO_ESTOQUE, interpretador.DOMINIO_REPASSE):
        resultado = await buscar_veiculos(
            db=db, loja_id=loja.id, loja=loja,
            criterios=interpretacao.criterios, escopo=escopo,
        )
        buscas.update(resultado.para_auditoria())
        blocos_de_contexto.append(_contexto_da_busca(resultado))
        atalhos = _atalhos_da_busca(resultado)

    elif dominio == interpretador.DOMINIO_COMISSAO:
        valor = interpretacao.criterios.preco_max or interpretacao.criterios.preco_min
        comissao = await dominios.calcular_comissao(
            db=db, loja=loja, usuario_id=usuario.id, valor_venda=valor,
        )
        buscas["comissao"] = {"percentual": comissao.percentual, "origem": comissao.origem}
        blocos_de_contexto.append("COMISSÃO (dados reais do sistema):\n" + comissao.para_contexto())
        atalhos = [Atalho("Ver minhas comissões", "/minhas-comissoes", {})]

    elif dominio == interpretador.DOMINIO_FERRAMENTA:
        blocos_de_contexto.append(dominios.contexto_de_ferramentas())

    elif dominio == interpretador.DOMINIO_CRM:
        # CRM entra no Release 2. Dizer que não alcança é melhor que responder
        # com o que a AURA não consultou (regra 5 da seção 8).
        return RespostaAura(
            texto=(
                "Ainda não consulto o CRM — isso entra na próxima versão. "
                "Por enquanto eu ajudo com estoque, repasse, comissão e o sistema."
            ),
            atalhos=[Atalho("Abrir o CRM", "/crm", {})],
            buscas=buscas,
            tokens_input=tk_in,
            tokens_output=tk_out,
            latencia_ms=0,
            provedor=None,
            modelo=None,
        )

    historico = await _historico(db, conversa.id)
    if historico:
        linhas = [
            f"{'Você' if m.autor == AURA_AUTOR_AURA else usuario.nome}: {m.conteudo}"
            for m in historico
        ]
        blocos_de_contexto.insert(0, "CONVERSA ATÉ AQUI:\n" + "\n".join(linhas))

    conteudo = (
        f"PERGUNTA: {pergunta.strip()[:1000]}\n\n"
        + "\n\n".join(blocos_de_contexto)
    )

    redacao = await chamar_ia(
        db=db,
        loja_id=loja.id,
        usuario_id=usuario.id,
        funcionalidade=FUNCIONALIDADE,
        prompt_system=_prompt_de_redacao(escopo, usuario.nome, loja.nome),
        conteudo=conteudo,
        max_tokens=700,
        temperatura=0.5,
    )

    return RespostaAura(
        texto=redacao.texto.strip(),
        atalhos=atalhos,
        buscas=buscas,
        tokens_input=tk_in + redacao.tokens_input,
        tokens_output=tk_out + redacao.tokens_output,
        latencia_ms=0,
        provedor=redacao.provedor,
        modelo=redacao.modelo,
    )
