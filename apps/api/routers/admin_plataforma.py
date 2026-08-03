"""
Social Veículos — Caixa da plataforma e prestação de contas (/v1/admin/plataforma/*)

Responde três perguntas de sócio: quanto entrou, quanto saiu e quanto ainda vou
precisar pôr. Acesso exclusivo de admin_plataforma.

Fonte de cada número (importa para não haver dois donos do mesmo fato):
  - receita de assinatura → `pagamento` (status PAGO), gerado ao ativar/renovar;
  - receita de destaque   → `destaque_pagamento`;
  - aporte/despesa/avulsa → `lancamento_plataforma` (lançado à mão no admin).
A projeção é a única parte que estima, e ela parte desses mesmos números.
"""

import calendar
import html as html_lib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from deps import registrar_auditoria
from lib_formatacao import formatar_moeda
from models import (
    Assinatura,
    DestaquePagamento,
    LancamentoPlataforma,
    Loja,
    Pagamento,
    Plano,
    StatusAssinatura,
    StatusPagamento,
    TipoLancamentoPlataforma,
    Usuario,
    utcnow,
)
from pdf_service import html_para_pdf
from routers.admin import exige_admin_plataforma
from schemas import (
    PlataformaLancamentoCreate,
    PlataformaLancamentoItem,
    PlataformaProjecaoCenario,
    PlataformaProjecaoPonto,
    PlataformaProjecaoResponse,
    PlataformaResumoResponse,
    PlataformaValorPorChave,
)

router = APIRouter(prefix="/v1/admin/plataforma", tags=["Administração Global"])

_now = utcnow

_MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]

# Ritmo de novas lojas assumido por cenário: os primeiros meses explícitos, o
# último valor se repete até o fim do horizonte. O cenário "base" são as metas
# do PLANO-TUDO-OU-NADA (3 em D30, 6 em D60, 10 em D90).
_RITMOS: Dict[str, Tuple[str, List[int]]] = {
    "base": ("Base (metas do plano)", [3, 3, 4, 2]),
    "pessimista": ("Pessimista", [1]),
    "otimista": ("Otimista", [4, 5, 6, 3]),
}

# Usados só quando ainda não há histórico suficiente no banco (mês 1 da operação).
# Vêm do orçamento consolidado do PLANO-TUDO-OU-NADA §11.
_CUSTO_FIXO_PADRAO = 600.0
_TICKET_PADRAO = 99.90


def _rotulo_mes(dt: datetime) -> str:
    return f"{_MESES_PT[dt.month - 1]}/{dt.year % 100:02d}"


def _somar_meses(base: datetime, meses: int) -> datetime:
    total = base.month - 1 + meses
    ano = base.year + total // 12
    mes = total % 12 + 1
    return base.replace(year=ano, month=mes, day=1)


def _intervalo_mes(mes: str) -> Tuple[datetime, datetime]:
    """'YYYY-MM' → (primeiro instante do mês, primeiro instante do mês seguinte), naive UTC.

    Naive de propósito: datetime aware como parâmetro de query faz o asyncpg
    estourar em produção (ver ARMADILHAS-PRODUCAO §1).
    """
    try:
        ano, num = mes.split("-")
        inicio = datetime(int(ano), int(num), 1)
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mês inválido. Use o formato AAAA-MM (ex.: 2026-08).",
        )
    return inicio, _somar_meses(inicio, 1)


async def _receita_no_periodo(db: AsyncSession, inicio: datetime, fim: datetime) -> Dict[str, float]:
    """Receita efetivamente recebida no período, por origem."""
    assinaturas = (await db.execute(
        select(func.coalesce(func.sum(Pagamento.valor), 0.0)).where(
            Pagamento.status == StatusPagamento.PAGO,
            Pagamento.data_pagamento.isnot(None),
            Pagamento.data_pagamento >= inicio,
            Pagamento.data_pagamento < fim,
        )
    )).scalar_one()

    destaques = (await db.execute(
        select(func.coalesce(func.sum(DestaquePagamento.valor), 0.0)).where(
            DestaquePagamento.status == StatusPagamento.PAGO,
            DestaquePagamento.data_pagamento.isnot(None),
            DestaquePagamento.data_pagamento >= inicio,
            DestaquePagamento.data_pagamento < fim,
        )
    )).scalar_one()

    avulsas = (await db.execute(
        select(func.coalesce(func.sum(LancamentoPlataforma.valor), 0.0)).where(
            LancamentoPlataforma.tipo == TipoLancamentoPlataforma.RECEITA,
            LancamentoPlataforma.data >= inicio,
            LancamentoPlataforma.data < fim,
        )
    )).scalar_one()

    return {
        "assinaturas": float(assinaturas or 0),
        "destaques": float(destaques or 0),
        "avulsas": float(avulsas or 0),
        "total": float((assinaturas or 0) + (destaques or 0) + (avulsas or 0)),
    }


async def _soma_lancamentos(
    db: AsyncSession,
    tipo: TipoLancamentoPlataforma,
    inicio: Optional[datetime] = None,
    fim: Optional[datetime] = None,
) -> float:
    stmt = select(func.coalesce(func.sum(LancamentoPlataforma.valor), 0.0)).where(
        LancamentoPlataforma.tipo == tipo
    )
    if inicio is not None:
        stmt = stmt.where(LancamentoPlataforma.data >= inicio)
    if fim is not None:
        stmt = stmt.where(LancamentoPlataforma.data < fim)
    return float((await db.execute(stmt)).scalar_one() or 0)


async def _agrupar_lancamentos(
    db: AsyncSession,
    tipo: TipoLancamentoPlataforma,
    inicio: Optional[datetime] = None,
    fim: Optional[datetime] = None,
) -> List[PlataformaValorPorChave]:
    stmt = (
        select(LancamentoPlataforma.categoria, func.sum(LancamentoPlataforma.valor))
        .where(LancamentoPlataforma.tipo == tipo)
        .group_by(LancamentoPlataforma.categoria)
        .order_by(func.sum(LancamentoPlataforma.valor).desc())
    )
    if inicio is not None:
        stmt = stmt.where(LancamentoPlataforma.data >= inicio)
    if fim is not None:
        stmt = stmt.where(LancamentoPlataforma.data < fim)
    return [
        PlataformaValorPorChave(chave=categoria, valor=float(valor or 0))
        for categoria, valor in (await db.execute(stmt)).all()
    ]


async def _base_projecao(db: AsyncSession) -> Tuple[float, float, float, int, float]:
    """
    (caixa, custo_fixo_mensal, ticket_medio, pagantes, preco_nova_loja) — do banco.

    `ticket_medio` e `preco_nova_loja` são coisas diferentes e não podem ser o
    mesmo número: o primeiro descreve a carteira de hoje (média do que as lojas
    ativas pagam); o segundo é a hipótese de quanto entra a PRÓXIMA loja, e usa
    o plano ativo mais barato — a oferta de entrada. Projetar loja nova pelo
    ticket médio infla a receita futura quando a carteira tem plano caro.
    """
    agora = _now()
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_receita = await _receita_no_periodo(db, datetime(2000, 1, 1), _somar_meses(inicio_mes, 1))
    total_aporte = await _soma_lancamentos(db, TipoLancamentoPlataforma.APORTE)
    total_despesa = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA)
    caixa = total_aporte + total_receita["total"] - total_despesa

    # Custo fixo: soma do que foi marcado como recorrente no mês mais recente que
    # tenha algum recorrente; sem isso, cai na média de despesa dos 3 últimos meses.
    recorrentes = (await db.execute(
        select(func.coalesce(func.sum(LancamentoPlataforma.valor), 0.0)).where(
            LancamentoPlataforma.tipo == TipoLancamentoPlataforma.DESPESA,
            LancamentoPlataforma.recorrente.is_(True),
            LancamentoPlataforma.data >= _somar_meses(inicio_mes, -1),
        )
    )).scalar_one()
    custo_fixo = float(recorrentes or 0)
    if custo_fixo <= 0:
        despesa_90d = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA, agora - timedelta(days=90))
        custo_fixo = despesa_90d / 3 if despesa_90d > 0 else _CUSTO_FIXO_PADRAO

    ativas = (await db.execute(
        select(Assinatura.valor_mensal, Plano.preco_mensal)
        .join(Plano, Plano.id == Assinatura.plano_id)
        .where(Assinatura.status == StatusAssinatura.ATIVA)
    )).all()
    valores = [float(v if v is not None else p) for v, p in ativas]

    mais_barato = (await db.execute(
        select(func.min(Plano.preco_mensal)).where(Plano.ativo.is_(True))
    )).scalar_one_or_none()
    preco_entrada = float(mais_barato) if mais_barato else _TICKET_PADRAO

    ticket = sum(valores) / len(valores) if valores else preco_entrada

    return caixa, custo_fixo, ticket, len(valores), preco_entrada


# ═══════════════════════════════════════════════════════════════
# Resumo — os KPIs do topo da aba Financeiro
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/resumo",
    response_model=PlataformaResumoResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_resumo(db: AsyncSession = Depends(get_db)):
    agora = _now()
    inicio_mes = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    fim_mes = _somar_meses(inicio_mes, 1)

    caixa, custo_fixo, ticket, pagantes, _preco_entrada = await _base_projecao(db)

    mrr = float((await db.execute(
        select(func.coalesce(func.sum(func.coalesce(Assinatura.valor_mensal, Plano.preco_mensal)), 0.0))
        .select_from(Assinatura)
        .join(Plano, Plano.id == Assinatura.plano_id)
        .where(Assinatura.status == StatusAssinatura.ATIVA)
    )).scalar_one() or 0)

    # Trial = loja com assinatura ativa ainda sem nenhum pagamento confirmado.
    trials = int((await db.execute(
        select(func.count(Assinatura.id)).where(
            Assinatura.status == StatusAssinatura.ATIVA,
            ~select(Pagamento.id).where(
                Pagamento.assinatura_id == Assinatura.id,
                Pagamento.status == StatusPagamento.PAGO,
            ).exists(),
        )
    )).scalar_one() or 0)

    receita_mes = (await _receita_no_periodo(db, inicio_mes, fim_mes))["total"]
    despesa_mes = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA, inicio_mes, fim_mes)
    aporte_mes = await _soma_lancamentos(db, TipoLancamentoPlataforma.APORTE, inicio_mes, fim_mes)

    despesa_90d = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA, agora - timedelta(days=90))
    burn = despesa_90d / 3

    queima_liquida = burn - mrr
    runway = round(caixa / queima_liquida, 1) if (queima_liquida > 0 and caixa > 0) else None

    return PlataformaResumoResponse(
        caixa=round(caixa, 2),
        mrr=round(mrr, 2),
        pagantes=pagantes,
        trials=trials,
        receita_mes=round(receita_mes, 2),
        despesa_mes=round(despesa_mes, 2),
        aporte_mes=round(aporte_mes, 2),
        burn_mensal=round(burn, 2),
        runway_meses=runway,
        aportes_por_socio=await _agrupar_lancamentos(db, TipoLancamentoPlataforma.APORTE),
        despesas_por_categoria=await _agrupar_lancamentos(
            db, TipoLancamentoPlataforma.DESPESA, agora - timedelta(days=90)
        ),
        custo_fixo_estimado=round(custo_fixo, 2),
        ticket_medio=round(ticket, 2),
    )


# ═══════════════════════════════════════════════════════════════
# Lançamentos — aporte, despesa, receita avulsa
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/lancamentos",
    response_model=List[PlataformaLancamentoItem],
    dependencies=[Depends(exige_admin_plataforma)],
)
async def listar_lancamentos(
    mes: Optional[str] = Query(default=None, description="Filtra por mês (AAAA-MM)"),
    tipo: Optional[TipoLancamentoPlataforma] = None,
    limite: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(LancamentoPlataforma).order_by(
        LancamentoPlataforma.data.desc(), LancamentoPlataforma.created_at.desc()
    )
    if mes:
        inicio, fim = _intervalo_mes(mes)
        stmt = stmt.where(LancamentoPlataforma.data >= inicio, LancamentoPlataforma.data < fim)
    if tipo:
        stmt = stmt.where(LancamentoPlataforma.tipo == tipo)

    itens = (await db.execute(stmt.limit(limite))).scalars().all()
    return [PlataformaLancamentoItem.model_validate(i) for i in itens]


@router.post(
    "/lancamentos",
    response_model=PlataformaLancamentoItem,
    status_code=status.HTTP_201_CREATED,
)
async def criar_lancamento(
    data: PlataformaLancamentoCreate,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    lanc = LancamentoPlataforma(
        tipo=data.tipo,
        categoria=data.categoria,
        descricao=data.descricao,
        valor=data.valor,
        # `data` do cliente pode vir aware (ISO com offset); o banco só aceita naive UTC.
        data=(data.data.replace(tzinfo=None) if data.data else _now()),
        recorrente=data.recorrente,
        observacoes=data.observacoes,
        criado_por_admin_id=admin.id,
    )
    db.add(lanc)
    await registrar_auditoria(
        db, None, admin.id, admin.nome,
        "plataforma_lancamento_criado", "lancamento_plataforma", lanc.id,
        f"{data.tipo.value} · {data.categoria} · {formatar_moeda(data.valor)}",
    )
    await db.commit()
    await db.refresh(lanc)
    return PlataformaLancamentoItem.model_validate(lanc)


@router.delete("/lancamentos/{lancamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_lancamento(
    lancamento_id: str,
    db: AsyncSession = Depends(get_db),
    admin: Usuario = Depends(exige_admin_plataforma),
):
    lanc = (await db.execute(
        select(LancamentoPlataforma).where(LancamentoPlataforma.id == lancamento_id)
    )).scalar_one_or_none()
    if not lanc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lançamento não encontrado.")

    await registrar_auditoria(
        db, None, admin.id, admin.nome,
        "plataforma_lancamento_excluido", "lancamento_plataforma", lanc.id,
        f"{lanc.tipo.value} · {lanc.categoria} · {formatar_moeda(lanc.valor)}",
    )
    await db.delete(lanc)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ═══════════════════════════════════════════════════════════════
# Projeção de caixa — quanto ainda preciso aportar, e quando vira
# ═══════════════════════════════════════════════════════════════

def _simular(
    cenario_id: str,
    caixa_inicial: float,
    mrr_atual: float,
    pagantes_atuais: int,
    custo_fixo: float,
    ticket: float,
    churn: float,
    horizonte: int,
    aportes_ja_feitos: float,
) -> PlataformaProjecaoCenario:
    nome, ritmo = _RITMOS[cenario_id]
    base_dt = _now().replace(day=1)

    # Cada coorte é um grupo de lojas que entrou no mesmo mês; ela derrete pelo churn.
    coortes: List[Tuple[int, float, float]] = []  # (mês de entrada, qtd, ticket)
    if pagantes_atuais:
        coortes.append((0, float(pagantes_atuais), mrr_atual / pagantes_atuais))

    caixa = caixa_inicial
    pontos = [PlataformaProjecaoPonto(
        mes=0, rotulo=_rotulo_mes(base_dt), caixa=round(caixa, 2),
        receita=0.0, custos=0.0, pagantes=float(pagantes_atuais),
    )]
    break_even: Optional[int] = None
    payback: Optional[int] = 0 if caixa >= 0 else None
    pico = caixa

    for m in range(1, horizonte + 1):
        novas = ritmo[m - 1] if m <= len(ritmo) else ritmo[-1]
        if novas:
            coortes.append((m, float(novas), ticket))

        receita = 0.0
        pagantes = 0.0
        for entrada, qtd, preco in coortes:
            vivos = qtd * ((1 - churn) ** (m - entrada))
            receita += vivos * preco
            pagantes += vivos

        caixa += receita - custo_fixo
        if break_even is None and receita >= custo_fixo:
            break_even = m
        if payback is None and caixa >= 0:
            payback = m
        pico = min(pico, caixa)

        pontos.append(PlataformaProjecaoPonto(
            mes=m, rotulo=_rotulo_mes(_somar_meses(base_dt, m)), caixa=round(caixa, 2),
            receita=round(receita, 2), custos=round(custo_fixo, 2), pagantes=round(pagantes, 1),
        ))

    resultado_12m = pontos[min(12, horizonte)].caixa - pontos[0].caixa
    # Investimento a recuperar = o que os sócios já puseram + o que a projeção
    # ainda vai exigir (o fundo do caixa, quando ele fica negativo).
    investimento = aportes_ja_feitos + max(0.0, -pico)

    return PlataformaProjecaoCenario(
        id=cenario_id,
        nome=nome,
        novas_lojas_mes=ritmo,
        pontos=pontos,
        pico_negativo=round(pico, 2),
        break_even_mes=break_even,
        payback_mes=payback,
        resultado_12m=round(resultado_12m, 2),
        roi_12m=round(resultado_12m / investimento, 4) if investimento > 0 else None,
    )


@router.get(
    "/projecao",
    response_model=PlataformaProjecaoResponse,
    dependencies=[Depends(exige_admin_plataforma)],
)
async def get_projecao(
    meses: int = Query(default=18, ge=6, le=36),
    churn_percent: float = Query(default=3.0, ge=0, le=50),
    custo_fixo: Optional[float] = Query(default=None, ge=0, description="Sobrescreve o custo fixo estimado"),
    preco_nova_loja: Optional[float] = Query(
        default=None, gt=0,
        description="Quanto paga cada loja nova; padrão = plano ativo mais barato (oferta de entrada)",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Projeta o caixa nos próximos meses em três cenários de venda.

    O ponto de partida é sempre real (caixa, MRR e pagantes de hoje, custo fixo
    do que já foi lançado como recorrente); só o ritmo de novas lojas é hipótese.
    A loja nova entra pelo preço de entrada, não pela média da carteira — supor
    que todo mundo entra no plano caro é o jeito mais fácil de a projeção mentir.
    """
    caixa, custo_estimado, _ticket_carteira, pagantes, preco_entrada = await _base_projecao(db)
    custo = custo_fixo if custo_fixo is not None else custo_estimado
    ticket = preco_nova_loja if preco_nova_loja is not None else preco_entrada
    aportes = await _soma_lancamentos(db, TipoLancamentoPlataforma.APORTE)

    mrr = float((await db.execute(
        select(func.coalesce(func.sum(func.coalesce(Assinatura.valor_mensal, Plano.preco_mensal)), 0.0))
        .select_from(Assinatura)
        .join(Plano, Plano.id == Assinatura.plano_id)
        .where(Assinatura.status == StatusAssinatura.ATIVA)
    )).scalar_one() or 0)

    return PlataformaProjecaoResponse(
        caixa_inicial=round(caixa, 2),
        custo_fixo_mensal=round(custo, 2),
        preco_nova_loja=round(ticket, 2),
        churn_percent=churn_percent,
        horizonte_meses=meses,
        cenarios=[
            _simular(cid, caixa, mrr, pagantes, custo, ticket, churn_percent / 100, meses, aportes)
            for cid in ("base", "pessimista", "otimista")
        ],
    )


# ═══════════════════════════════════════════════════════════════
# Prestação de contas — HTML com gráficos, imprimível, e PDF
# ═══════════════════════════════════════════════════════════════

def _esc(v: Optional[str]) -> str:
    return html_lib.escape(v or "")


def _barras(titulo: str, itens: List[Tuple[str, float]], cor: str) -> str:
    """
    Gráfico de barras em tabela HTML.

    Tabela e não SVG/flex de propósito: o xhtml2pdf (gerador do PDF) só entende
    um subconjunto de CSS, sem flex/grid nem SVG — tabela com largura percentual
    renderiza igual no navegador e no PDF.
    """
    if not itens:
        return ""
    maximo = max(v for _, v in itens) or 1
    linhas = []
    for rotulo, valor in itens:
        pct = max(2, round(valor / maximo * 100))
        linhas.append(f"""
        <tr>
          <td style="width:38%;padding:3pt 6pt 3pt 0;font-size:9.5pt;color:#52514e">{_esc(rotulo)}</td>
          <td style="width:44%;padding:3pt 0">
            <table style="width:100%;border-collapse:collapse"><tr>
              <td style="width:{pct}%;background-color:{cor};height:11pt"></td>
              <td style="width:{100 - pct}%"></td>
            </tr></table>
          </td>
          <td style="width:18%;padding:3pt 0 3pt 6pt;text-align:right;font-size:9.5pt">{formatar_moeda(valor)}</td>
        </tr>""")
    return f"""
    <h3 style="font-size:10.5pt;margin:14pt 0 5pt;color:#0b0b0b">{_esc(titulo)}</h3>
    <table style="width:100%;border-collapse:collapse">{''.join(linhas)}</table>"""


def _linha_kpi(rotulo: str, valor: str, cor: str = "#0b0b0b") -> str:
    return f"""
    <tr>
      <td style="padding:4pt 0;font-size:10pt;color:#52514e">{_esc(rotulo)}</td>
      <td style="padding:4pt 0;font-size:10pt;text-align:right;font-weight:bold;color:{cor}">{valor}</td>
    </tr>"""


@router.get("/prestacao-contas", dependencies=[Depends(exige_admin_plataforma)])
async def prestacao_de_contas(
    mes: str = Query(description="Mês de referência (AAAA-MM)"),
    formato: str = Query(default="html", pattern="^(html|pdf)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Relatório mensal para o sócio: entrou, saiu, sobrou, e como está a carteira.

    `formato=pdf` devolve PDF; se a lib de PDF não estiver disponível no ambiente,
    cai para o HTML (que o navegador imprime) em vez de falhar.
    """
    inicio, fim = _intervalo_mes(mes)

    receita = await _receita_no_periodo(db, inicio, fim)
    despesa = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA, inicio, fim)
    aporte = await _soma_lancamentos(db, TipoLancamentoPlataforma.APORTE, inicio, fim)

    # Saldo inicial = tudo que ocorreu antes do mês (mesma conta do caixa, com corte).
    receita_antes = (await _receita_no_periodo(db, datetime(2000, 1, 1), inicio))["total"]
    aporte_antes = await _soma_lancamentos(db, TipoLancamentoPlataforma.APORTE, None, inicio)
    despesa_antes = await _soma_lancamentos(db, TipoLancamentoPlataforma.DESPESA, None, inicio)
    saldo_inicial = aporte_antes + receita_antes - despesa_antes

    resultado = receita["total"] - despesa
    saldo_final = saldo_inicial + aporte + resultado

    aportes_socio = await _agrupar_lancamentos(db, TipoLancamentoPlataforma.APORTE, inicio, fim)
    despesas_cat = await _agrupar_lancamentos(db, TipoLancamentoPlataforma.DESPESA, inicio, fim)

    lancamentos = (await db.execute(
        select(LancamentoPlataforma)
        .where(LancamentoPlataforma.data >= inicio, LancamentoPlataforma.data < fim)
        .order_by(LancamentoPlataforma.data.asc())
    )).scalars().all()

    pagamentos = (await db.execute(
        select(Pagamento, Loja.nome)
        .join(Assinatura, Assinatura.id == Pagamento.assinatura_id)
        .join(Loja, Loja.id == Assinatura.loja_id)
        .where(
            Pagamento.status == StatusPagamento.PAGO,
            Pagamento.data_pagamento >= inicio,
            Pagamento.data_pagamento < fim,
        )
        .order_by(Pagamento.data_pagamento.asc())
    )).all()

    carteira = (await db.execute(
        select(Loja.nome, Plano.nome, Assinatura.valor_mensal, Plano.preco_mensal, Assinatura.proximo_vencimento)
        .select_from(Assinatura)
        .join(Loja, Loja.id == Assinatura.loja_id)
        .join(Plano, Plano.id == Assinatura.plano_id)
        .where(Assinatura.status == StatusAssinatura.ATIVA)
        .order_by(Loja.nome)
    )).all()
    mrr = sum(float(v if v is not None else p) for _, _, v, p, _ in carteira)

    ref = datetime(inicio.year, inicio.month, 1)
    nome_mes = f"{_MESES_PT[ref.month - 1]}/{ref.year}"
    _, ultimo_dia = calendar.monthrange(ref.year, ref.month)

    linhas_extrato = "".join(
        f"""<tr>
          <td style="padding:3pt 0;font-size:9pt">{lanc.data.strftime('%d/%m')}</td>
          <td style="padding:3pt 0;font-size:9pt">{_esc(lanc.tipo.value.capitalize())}</td>
          <td style="padding:3pt 0;font-size:9pt">{_esc(lanc.categoria)}</td>
          <td style="padding:3pt 0;font-size:9pt;color:#52514e">{_esc(lanc.descricao)}</td>
          <td style="padding:3pt 0;font-size:9pt;text-align:right;color:{'#c0392b' if lanc.tipo == TipoLancamentoPlataforma.DESPESA else '#1e7a3c'}">
            {'−' if lanc.tipo == TipoLancamentoPlataforma.DESPESA else '+'} {formatar_moeda(lanc.valor)}
          </td>
        </tr>"""
        for lanc in lancamentos
    ) or '<tr><td colspan="5" style="padding:6pt 0;font-size:9pt;color:#898781">Sem lançamentos manuais no mês.</td></tr>'

    linhas_pagamentos = "".join(
        f"""<tr>
          <td style="padding:3pt 0;font-size:9pt">{p.data_pagamento.strftime('%d/%m')}</td>
          <td style="padding:3pt 0;font-size:9pt">{_esc(loja_nome)}</td>
          <td style="padding:3pt 0;font-size:9pt">{_esc(p.metodo or 'pix_manual')}</td>
          <td style="padding:3pt 0;font-size:9pt;text-align:right;color:#1e7a3c">+ {formatar_moeda(p.valor)}</td>
        </tr>"""
        for p, loja_nome in pagamentos
    ) or '<tr><td colspan="4" style="padding:6pt 0;font-size:9pt;color:#898781">Nenhuma mensalidade recebida no mês.</td></tr>'

    linhas_carteira = "".join(
        f"""<tr>
          <td style="padding:3pt 0;font-size:9pt">{_esc(loja)}</td>
          <td style="padding:3pt 0;font-size:9pt;color:#52514e">{_esc(plano)}</td>
          <td style="padding:3pt 0;font-size:9pt;text-align:right">{formatar_moeda(float(valor if valor is not None else preco))}</td>
          <td style="padding:3pt 0;font-size:9pt;text-align:right;color:#52514e">{venc.strftime('%d/%m/%Y') if venc else '—'}</td>
        </tr>"""
        for loja, plano, valor, preco, venc in carteira
    ) or '<tr><td colspan="4" style="padding:6pt 0;font-size:9pt;color:#898781">Nenhuma assinatura ativa.</td></tr>'

    cor_resultado = "#1e7a3c" if resultado >= 0 else "#c0392b"
    cor_saldo = "#1e7a3c" if saldo_final >= 0 else "#c0392b"

    html = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Prestação de contas — {nome_mes}</title></head>
<body style="font-family:Helvetica,Arial,sans-serif;color:#0b0b0b;font-size:10pt;line-height:1.45">
  <h1 style="font-size:15pt;margin:0 0 2pt">Prestação de contas — {nome_mes}</h1>
  <p style="margin:0 0 14pt;font-size:9pt;color:#898781">
    Social Veículos · período de 01/{ref.month:02d}/{ref.year} a {ultimo_dia}/{ref.month:02d}/{ref.year}
    · emitido em {_now().strftime('%d/%m/%Y')}
  </p>

  <h2 style="font-size:11.5pt;border-bottom:1px solid #cccccc;padding-bottom:3pt;margin:0 0 6pt">Resumo do mês</h2>
  <table style="width:100%;border-collapse:collapse">
    {_linha_kpi("Saldo inicial", formatar_moeda(saldo_inicial))}
    {_linha_kpi("Aportes dos sócios", "+ " + formatar_moeda(aporte))}
    {_linha_kpi("Receita (mensalidades)", "+ " + formatar_moeda(receita["assinaturas"]))}
    {_linha_kpi("Receita (destaques na vitrine)", "+ " + formatar_moeda(receita["destaques"])) if receita["destaques"] else ""}
    {_linha_kpi("Receita (avulsa)", "+ " + formatar_moeda(receita["avulsas"])) if receita["avulsas"] else ""}
    {_linha_kpi("Despesas", "− " + formatar_moeda(despesa), "#c0392b")}
    <tr><td colspan="2" style="border-top:1px solid #cccccc;padding-top:2pt"></td></tr>
    {_linha_kpi("Resultado operacional (receita − despesa)", formatar_moeda(resultado), cor_resultado)}
    {_linha_kpi("Saldo final em caixa", formatar_moeda(saldo_final), cor_saldo)}
  </table>

  <h2 style="font-size:11.5pt;border-bottom:1px solid #cccccc;padding-bottom:3pt;margin:18pt 0 6pt">Carteira no fechamento</h2>
  <table style="width:100%;border-collapse:collapse">
    {_linha_kpi("MRR (receita recorrente mensal)", formatar_moeda(mrr))}
    {_linha_kpi("Lojas pagantes ativas", str(len(carteira)))}
  </table>

  {_barras("Aportes por sócio", [(i.chave, i.valor) for i in aportes_socio], "#2a78d6")}
  {_barras("Despesas por categoria", [(i.chave, i.valor) for i in despesas_cat], "#eb6834")}

  <h2 style="font-size:11.5pt;border-bottom:1px solid #cccccc;padding-bottom:3pt;margin:18pt 0 6pt">Mensalidades recebidas</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Data</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Loja</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Método</th>
      <th style="text-align:right;font-size:8.5pt;color:#898781;padding-bottom:3pt">Valor</th>
    </tr>
    {linhas_pagamentos}
  </table>

  <h2 style="font-size:11.5pt;border-bottom:1px solid #cccccc;padding-bottom:3pt;margin:18pt 0 6pt">Aportes e despesas do mês</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Data</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Tipo</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Sócio/categoria</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Descrição</th>
      <th style="text-align:right;font-size:8.5pt;color:#898781;padding-bottom:3pt">Valor</th>
    </tr>
    {linhas_extrato}
  </table>

  <h2 style="font-size:11.5pt;border-bottom:1px solid #cccccc;padding-bottom:3pt;margin:18pt 0 6pt">Assinaturas ativas</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Loja</th>
      <th style="text-align:left;font-size:8.5pt;color:#898781;padding-bottom:3pt">Plano</th>
      <th style="text-align:right;font-size:8.5pt;color:#898781;padding-bottom:3pt">Mensalidade</th>
      <th style="text-align:right;font-size:8.5pt;color:#898781;padding-bottom:3pt">Próx. vencimento</th>
    </tr>
    {linhas_carteira}
  </table>

  <p style="margin-top:20pt;font-size:8pt;color:#898781">
    Relatório gerado pelo painel administrativo da Social Veículos. Mensalidades e destaques vêm do
    registro de pagamentos do sistema; aportes e despesas, dos lançamentos manuais do caixa da plataforma.
  </p>
</body></html>"""

    nome_base = f"prestacao-contas-{mes}"
    if formato == "pdf":
        pdf = html_para_pdf(html)
        if pdf:
            return Response(
                content=pdf,
                media_type="application/pdf",
                headers={"Content-Disposition": f'inline; filename="{nome_base}.pdf"'},
            )
        # Sem a lib de PDF no ambiente: entrega o HTML para o navegador imprimir.

    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Content-Disposition": f'inline; filename="{nome_base}.html"'},
    )
