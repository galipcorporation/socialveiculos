"""
Social Veículos — Esteira pós-venda (/v1/esteira)

O que acontece DEPOIS do clique em "Vender": contrato, pagamento, documentos ao
novo dono e transferência no DETRAN. Ver ESTEIRA-POS-VENDA.md.

A esteira nunca trava a venda; ela acompanha. O estágio exibido é a frente
pendente mais atrasada (não um funil). Só "concluído" é portão duro: exige
todos os itens obrigatórios resolvidos.
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from rbac import can, Acao, Recurso
import json
from models import (
    EsteiraPosVenda,
    ItemChecklist,
    Veiculo,
    ClientePF,
    VeiculoDocumento,
    EstagioPosVenda,
    StatusItemChecklist,
    CategoriaItem,
    LancamentoFinanceiro,
    TipoLancamento,
    ComissaoVenda,
    PapelUsuario,
    Usuario,
)
from schemas import (
    EsteiraResumoResponse,
    EsteiraDetalheResponse,
    ItemChecklistResponse,
    ItemChecklistUpdate,
    TransferenciaUpdate,
    VeiculoResumo,
    CompradorResumo,
    EsteiraDashboardResponse,
    ItemChecklistCreate,
)

router = APIRouter(prefix="/v1/esteira", tags=["Esteira Pós-venda"])

# Ordem das frentes → mapeia categoria de item para o estágio da esteira.
_CATEGORIA_ESTAGIO = {
    CategoriaItem.CONTRATO: EstagioPosVenda.CONTRATO,
    CategoriaItem.FINANCEIRO: EstagioPosVenda.PAGAMENTO,
    CategoriaItem.DOCUMENTO: EstagioPosVenda.DOCUMENTOS,
    CategoriaItem.TRANSFERENCIA: EstagioPosVenda.TRANSFERENCIA,
}
_ORDEM_ESTAGIO = [
    EstagioPosVenda.CONTRATO,
    EstagioPosVenda.PAGAMENTO,
    EstagioPosVenda.DOCUMENTOS,
    EstagioPosVenda.TRANSFERENCIA,
]

# Itens que bloqueiam a conclusão (§5).
_ITENS_BLOQUEIO_CONCLUSAO = {
    "contrato_assinado",
    "recibo_entregue",
    "comunicacao_venda",
    "transferencia_concluida",
    "debitos_quitados",
}


def _now() -> datetime:
    # NAIVE UTC: colunas são TIMESTAMP WITHOUT TIME ZONE; o Postgres/asyncpg
    # rejeita datetime aware em escrita E em comparação. Ver ARMADILHAS-PRODUCAO.md #1.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Normaliza para naive UTC (Postgres devolve naive; SQLite dev pode devolver
    aware). Assim toda comparação em Python fica naive-vs-naive, consistente com _now()."""
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def _vencido(item: ItemChecklist) -> bool:
    prazo = _aware(item.prazo_em)
    if prazo is None or item.status in (StatusItemChecklist.CONCLUIDO, StatusItemChecklist.NAO_APLICAVEL):
        return False
    return prazo < _now()


def _pendente(item: ItemChecklist) -> bool:
    return item.status in (StatusItemChecklist.PENDENTE, StatusItemChecklist.EM_ANDAMENTO)


def recalcular_estagio(esteira: EsteiraPosVenda) -> EstagioPosVenda:
    """Estágio = frente pendente mais 'atrasada' — a primeira, na ordem das frentes,
    com um item OBRIGATÓRIO/bloqueante ainda pendente. Itens opcionais pendentes
    (garantia, nota, vistoria) não prendem o estágio. A conclusão é explícita
    (POST /concluir); enquanto não concluída e sem obrigatório pendente, fica na
    última frente (transferência)."""
    if esteira.concluida_em is not None:
        return EstagioPosVenda.CONCLUIDO
    for estagio in _ORDEM_ESTAGIO:
        for item in esteira.itens:
            bloqueia = item.obrigatorio or item.chave in _ITENS_BLOQUEIO_CONCLUSAO
            if bloqueia and _CATEGORIA_ESTAGIO[item.categoria] == estagio and _pendente(item):
                return estagio
    # nenhum obrigatório pendente: fica na transferência até concluir explicitamente
    return EstagioPosVenda.TRANSFERENCIA


def _obrigatorios_faltando(esteira: EsteiraPosVenda) -> List[str]:
    """Itens que impedem a conclusão (§5)."""
    faltando = []
    for item in esteira.itens:
        bloqueia = item.obrigatorio or item.chave in _ITENS_BLOQUEIO_CONCLUSAO
        if bloqueia and item.status not in (StatusItemChecklist.CONCLUIDO, StatusItemChecklist.NAO_APLICAVEL):
            faltando.append(item.titulo)
    return faltando


def _veiculo_resumo(v: Optional[Veiculo]) -> Optional[VeiculoResumo]:
    if not v:
        return None
    foto = None
    midias = getattr(v, "midias", None)
    if midias:
        foto = getattr(midias[0], "url", None)
    return VeiculoResumo(
        id=v.id, marca=v.marca, modelo=v.modelo,
        ano_modelo=getattr(v, "ano_modelo", None),
        placa=getattr(v, "placa", None), foto=foto,
    )


def _comprador_resumo(c: Optional[ClientePF]) -> Optional[CompradorResumo]:
    if not c:
        return None
    return CompradorResumo(
        id=c.id, nome=getattr(c, "nome", None),
        telefone=getattr(c, "telefone", None),
    )


# itens financeiros que, quando pagos pela loja, viram DESPESA no financeiro (§6.6)
_ITENS_DESPESA = {
    "debitos_quitados": "Débitos do veículo (IPVA/licenciamento/multas)",
    "taxa_transferencia_paga": "Taxa de transferência",
}
_ITEM_RECEITA = {"entrada_recebida": "Entrada"}


async def _lancar_financeiro(
    db: AsyncSession, esteira: EsteiraPosVenda, item: ItemChecklist,
    valor: Optional[float] = None,
) -> None:
    """Ao concluir um item financeiro, gera o LancamentoFinanceiro correspondente,
    sem duplicar (idempotente pela descrição+veiculo). `valor` vem da tela ao
    concluir o item; se omitido, lança 0 para o usuário ajustar no financeiro."""
    if item.chave in _ITENS_DESPESA:
        tipo, rotulo, categoria = TipoLancamento.DESPESA, _ITENS_DESPESA[item.chave], "documentacao"
    elif item.chave in _ITEM_RECEITA:
        tipo, rotulo, categoria = TipoLancamento.RECEITA, _ITEM_RECEITA[item.chave], "venda_veiculo"
    else:
        return

    # Descrição legível: usa o veículo, não o id técnico da esteira. A
    # idempotência (não duplicar ao reconcluir o item) passa a filtrar por
    # veiculo_id + descrição, então o id da esteira não precisa mais aparecer.
    veic = esteira.veiculo
    ref_veiculo = (
        f"{veic.marca} {veic.modelo}".strip()
        + (f" · {veic.placa}" if veic and veic.placa else "")
    ) if veic else None
    descricao = f"{rotulo} — {ref_veiculo}" if ref_veiculo else rotulo
    ja = await db.execute(
        select(LancamentoFinanceiro.id).where(
            LancamentoFinanceiro.loja_id == esteira.loja_id,
            LancamentoFinanceiro.veiculo_id == esteira.veiculo_id,
            LancamentoFinanceiro.descricao == descricao,
        ).limit(1)
    )
    if ja.first():
        return
    valor_lanc = round(valor, 2) if valor and valor > 0 else 0.0
    db.add(LancamentoFinanceiro(
        loja_id=esteira.loja_id, tipo=tipo, descricao=descricao,
        valor=valor_lanc, veiculo_id=esteira.veiculo_id, categoria=categoria,
        observacoes=(
            "Lançado automaticamente pela esteira pós-venda."
            if valor_lanc else
            "Lançado automaticamente pela esteira pós-venda. Ajuste o valor no financeiro."
        ),
    ))


async def _comissao_paga(db: AsyncSession, esteira: EsteiraPosVenda) -> Optional[bool]:
    """Lê ComissaoVenda.pago do veículo, se houver."""
    if not esteira.veiculo_id:
        return None
    res = await db.execute(
        select(ComissaoVenda.pago).where(ComissaoVenda.veiculo_id == esteira.veiculo_id).limit(1)
    )
    row = res.first()
    return bool(row[0]) if row else None


async def _venda_info(db: AsyncSession, esteira: EsteiraPosVenda) -> dict:
    """Nome do vendedor + valores da venda/comissão, para exibir no detalhe."""
    info: dict = {
        "vendedor_nome": None,
        "valor_venda": None,
        "comissao_valor": None,
        "comissao_percentual": None,
    }
    if esteira.vendedor_id:
        res = await db.execute(select(Usuario.nome).where(Usuario.id == esteira.vendedor_id))
        row = res.first()
        if row:
            info["vendedor_nome"] = row[0]
    if esteira.veiculo_id:
        res = await db.execute(
            select(ComissaoVenda.valor_venda, ComissaoVenda.valor_comissao, ComissaoVenda.percentual)
            .where(ComissaoVenda.veiculo_id == esteira.veiculo_id)
            .limit(1)
        )
        row = res.first()
        if row:
            info["valor_venda"], info["comissao_valor"], info["comissao_percentual"] = row
    return info


async def _carregar_esteira(db: AsyncSession, esteira_id: str, loja_id: str) -> EsteiraPosVenda:
    stmt = (
        select(EsteiraPosVenda)
        .where(EsteiraPosVenda.id == esteira_id, EsteiraPosVenda.loja_id == loja_id)
        .options(
            selectinload(EsteiraPosVenda.itens),
            selectinload(EsteiraPosVenda.veiculo).selectinload(Veiculo.midias),
            selectinload(EsteiraPosVenda.comprador),
        )
    )
    res = await db.execute(stmt)
    esteira = res.scalar_one_or_none()
    if not esteira:
        raise HTTPException(status_code=404, detail="Esteira não encontrada")
    return esteira


# ═══════════════════════════════════════════════════════════════
# BOARD
# ═══════════════════════════════════════════════════════════════

@router.get("", response_model=List[EsteiraResumoResponse])
async def listar_board(
    estagio: Optional[EstagioPosVenda] = Query(None),
    atrasadas: bool = Query(False),
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Board (Kanban) das esteiras da loja. Não mostra concluídas por padrão."""
    stmt = (
        select(EsteiraPosVenda)
        .where(EsteiraPosVenda.loja_id == ctx.loja.id)
        .options(
            selectinload(EsteiraPosVenda.itens),
            selectinload(EsteiraPosVenda.veiculo).selectinload(Veiculo.midias),
            selectinload(EsteiraPosVenda.comprador),
        )
        .order_by(EsteiraPosVenda.aberta_em.desc())
    )
    if estagio:
        stmt = stmt.where(EsteiraPosVenda.estagio == estagio)
    else:
        stmt = stmt.where(EsteiraPosVenda.estagio != EstagioPosVenda.CONCLUIDO)

    res = await db.execute(stmt)
    esteiras = res.scalars().all()

    cards: List[EsteiraResumoResponse] = []
    for e in esteiras:
        aplicaveis = [i for i in e.itens if i.status != StatusItemChecklist.NAO_APLICAVEL]
        concluidos = [i for i in aplicaveis if i.status == StatusItemChecklist.CONCLUIDO]
        pendentes = [i for i in e.itens if _pendente(i)]
        vencidos = [i for i in e.itens if _vencido(i)]
        # próximo item = pendente com prazo mais próximo, senão o primeiro pendente
        pendentes_ordenados = sorted(
            pendentes, key=lambda i: (_aware(i.prazo_em) is None, _aware(i.prazo_em) or _now())
        )
        proximo = pendentes_ordenados[0] if pendentes_ordenados else None
        prazos = [_aware(i.prazo_em) for i in pendentes if _aware(i.prazo_em)]

        if atrasadas and not vencidos:
            continue

        cards.append(EsteiraResumoResponse(
            id=e.id, estagio=e.estagio, origem=e.origem,
            veiculo=_veiculo_resumo(e.veiculo),
            comprador=_comprador_resumo(e.comprador),
            proximo_item=proximo.titulo if proximo else None,
            prazo_mais_proximo=min(prazos) if prazos else None,
            tem_vencido=bool(vencidos),
            total_itens=len(aplicaveis),
            concluidos=len(concluidos),
            aberta_em=e.aberta_em,
        ))
    return cards


# ═══════════════════════════════════════════════════════════════
# DASHBOARD (nudges §7 + indicadores §10)
# ═══════════════════════════════════════════════════════════════

@router.get("/dashboard/resumo", response_model=EsteiraDashboardResponse)
async def dashboard_resumo(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(EsteiraPosVenda)
        .where(
            EsteiraPosVenda.loja_id == ctx.loja.id,
            EsteiraPosVenda.estagio != EstagioPosVenda.CONCLUIDO,
        )
        .options(selectinload(EsteiraPosVenda.itens))
    )
    esteiras = (await db.execute(stmt)).scalars().all()

    agora = _now()
    limiar_d7 = agora + timedelta(days=7)
    por_estagio: dict = {}
    vencendo_7d = comunicacao_vencida = itens_vencidos = travados_30d = 0

    for e in esteiras:
        por_estagio[e.estagio.value] = por_estagio.get(e.estagio.value, 0) + 1
        aberta = _aware(e.aberta_em)
        if aberta and (agora - aberta).days > 30:
            travados_30d += 1
        for i in e.itens:
            if _vencido(i):
                itens_vencidos += 1
                if i.chave == "comunicacao_venda":
                    comunicacao_vencida += 1
            prazo = _aware(i.prazo_em)
            if (i.chave == "transferencia_concluida" and _pendente(i)
                    and prazo and agora <= prazo <= limiar_d7):
                vencendo_7d += 1

    return EsteiraDashboardResponse(
        total_ativas=len(esteiras),
        por_estagio=por_estagio,
        transferencias_vencendo_7d=vencendo_7d,
        comunicacao_venda_vencida=comunicacao_vencida,
        itens_vencidos=itens_vencidos,
        vendidos_travados_30d=travados_30d,
    )


# ═══════════════════════════════════════════════════════════════
# DETALHE
# ═══════════════════════════════════════════════════════════════

@router.get("/{esteira_id}", response_model=EsteiraDetalheResponse)
async def detalhe(
    esteira_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)

    # espelha o status real da comissão (ComissaoVenda.pago) no item da esteira
    comissao_pago = await _comissao_paga(db, e)
    if comissao_pago:
        for i in e.itens:
            if i.chave == "comissao_paga" and i.status != StatusItemChecklist.CONCLUIDO:
                i.status = StatusItemChecklist.CONCLUIDO
                i.concluido_em = i.concluido_em or _now()
        await db.commit()

    itens_resp = []
    vencidos = 0
    for i in sorted(e.itens, key=lambda x: (x.categoria.value, x.chave)):
        venc = _vencido(i)
        if venc:
            vencidos += 1
        r = ItemChecklistResponse.model_validate(i)
        r.vencido = venc
        itens_resp.append(r)
    aplicaveis = [i for i in e.itens if i.status != StatusItemChecklist.NAO_APLICAVEL]
    concluidos = sum(1 for i in aplicaveis if i.status == StatusItemChecklist.CONCLUIDO)
    venda_info = await _venda_info(db, e)

    return EsteiraDetalheResponse(
        id=e.id, estagio=e.estagio, origem=e.origem,
        veiculo=_veiculo_resumo(e.veiculo),
        comprador=_comprador_resumo(e.comprador),
        contrato_id=e.contrato_id, vendedor_id=e.vendedor_id,
        **venda_info,
        comunicacao_venda_em=e.comunicacao_venda_em,
        transferencia_em=e.transferencia_em,
        aberta_em=e.aberta_em, concluida_em=e.concluida_em,
        itens=itens_resp,
        total_itens=len(aplicaveis), concluidos=concluidos, vencidos=vencidos,
    )


# ═══════════════════════════════════════════════════════════════
# ATUALIZAR ITEM
# ═══════════════════════════════════════════════════════════════

@router.patch("/{esteira_id}/itens/{item_id}", response_model=EsteiraDetalheResponse)
async def atualizar_item(
    esteira_id: str,
    item_id: str,
    body: ItemChecklistUpdate,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if e.concluida_em is not None:
        raise HTTPException(status_code=400, detail="Esteira já concluída")
    item = next((i for i in e.itens if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")

    if body.status is not None:
        if body.status == StatusItemChecklist.CONCLUIDO and item.categoria == CategoriaItem.FINANCEIRO:
            modulos_liberados = None
            if ctx.membro and ctx.membro.modulos:
                try:
                    modulos_liberados = json.loads(ctx.membro.modulos)
                except (TypeError, ValueError):
                    modulos_liberados = None
            if not can(ctx.usuario, Acao.CRIAR, Recurso.FINANCEIRO, modulos_liberados):
                raise HTTPException(
                    status_code=403,
                    detail="Permissão negada para concluir item financeiro da esteira.",
                )
        item.status = body.status
        if body.status == StatusItemChecklist.CONCLUIDO:
            item.concluido_em = _now()
            item.concluido_por = ctx.usuario.id
            if item.categoria == CategoriaItem.FINANCEIRO:
                await _lancar_financeiro(db, e, item, valor=body.valor)
        else:
            item.concluido_em = None
            item.concluido_por = None
    if body.observacao is not None:
        item.observacao = body.observacao
    if body.prazo_em is not None:
        item.prazo_em = body.prazo_em
    if body.doc_id is not None:
        item.doc_id = body.doc_id

    e.estagio = recalcular_estagio(e)
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_item_atualizado", "esteira_pos_venda", e.id,
        f"Item '{item.titulo}' → {item.status.value} (esteira {e.id}).",
    )
    return await detalhe(esteira_id, ctx, db)


# ═══════════════════════════════════════════════════════════════
# DOCUMENTOS (reusa M018 VeiculoDocumento)
# ═══════════════════════════════════════════════════════════════

async def anexar_documento_interno(
    db: AsyncSession,
    e: EsteiraPosVenda,
    item_chave: str,
    nome: str,
    url: str,
    concluido_por: Optional[str] = None,
) -> Optional[VeiculoDocumento]:
    """Núcleo de `anexar_documento`, reusável fora do HTTP (ex.: webhook do gateway fiscal).
    Não commita nem recarrega a esteira — quem chama decide o momento do commit."""
    if not e.veiculo_id:
        return None
    item = next((i for i in e.itens if i.chave == item_chave and i.categoria == CategoriaItem.DOCUMENTO), None)
    if not item:
        return None

    doc = VeiculoDocumento(
        veiculo_id=e.veiculo_id, loja_id=e.loja_id,
        nome=nome, url=url, visivel_comprador=True,
    )
    db.add(doc)
    await db.flush()
    item.doc_id = doc.id
    item.status = StatusItemChecklist.CONCLUIDO
    item.concluido_em = _now()
    item.concluido_por = concluido_por
    e.estagio = recalcular_estagio(e)
    return doc


@router.post("/{esteira_id}/documentos", response_model=EsteiraDetalheResponse)
async def anexar_documento(
    esteira_id: str,
    item_chave: str = Query(..., description="chave do item de documento a ligar"),
    nome: str = Query(...),
    url: str = Query(...),
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Registra um VeiculoDocumento e liga ao item de documento correspondente."""
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if not e.veiculo_id:
        raise HTTPException(status_code=400, detail="Esteira sem veículo vinculado")
    doc = await anexar_documento_interno(db, e, item_chave, nome, url, concluido_por=ctx.usuario.id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Item de documento não encontrado")
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_documento_anexado", "esteira_pos_venda", e.id,
        f"Documento '{nome}' anexado ao item '{item_chave}' (esteira {e.id}).",
    )
    return await detalhe(esteira_id, ctx, db)


# ═══════════════════════════════════════════════════════════════
# TRANSFERÊNCIA (comunicação de venda + transferência DETRAN)
# ═══════════════════════════════════════════════════════════════

@router.patch("/{esteira_id}/transferencia", response_model=EsteiraDetalheResponse)
async def registrar_transferencia(
    esteira_id: str,
    body: TransferenciaUpdate,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Grava comunicacao_venda_em e/ou transferencia_em e liga os itens correspondentes."""
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if body.comunicacao_venda_em is not None:
        e.comunicacao_venda_em = body.comunicacao_venda_em
        item = next((i for i in e.itens if i.chave == "comunicacao_venda"), None)
        if item:
            item.status = StatusItemChecklist.CONCLUIDO
            item.concluido_em = _now()
            item.concluido_por = ctx.usuario.id
    if body.transferencia_em is not None:
        e.transferencia_em = body.transferencia_em
        item = next((i for i in e.itens if i.chave == "transferencia_concluida"), None)
        if item:
            item.status = StatusItemChecklist.CONCLUIDO
            item.concluido_em = _now()
            item.concluido_por = ctx.usuario.id

    e.estagio = recalcular_estagio(e)
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_transferencia", "esteira_pos_venda", e.id,
        f"Transferência atualizada (esteira {e.id}).",
    )
    return await detalhe(esteira_id, ctx, db)


# ═══════════════════════════════════════════════════════════════
# CONSULTAS DETRAN (Fase 3 — plugável, sem inventar dado)
# ═══════════════════════════════════════════════════════════════

@router.get("/{esteira_id}/debitos")
async def consultar_debitos(
    esteira_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Consulta débitos do veículo no DETRAN (IPVA/licenciamento/multas).
    Retorna disponivel=false enquanto não houver provedor configurado."""
    from detran_provider import consultar_debitos as _detran_debitos
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    placa = getattr(e.veiculo, "placa", None) if e.veiculo else None
    if not placa:
        raise HTTPException(status_code=400, detail="Veículo sem placa para consulta")
    r = await _detran_debitos(ctx.loja.id, placa, db)
    return r


@router.get("/{esteira_id}/situacao")
async def consultar_situacao(
    esteira_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Consulta situação da ATPV-e/transferência no DETRAN.
    Retorna disponivel=false enquanto não houver provedor configurado."""
    from detran_provider import consultar_situacao as _detran_situacao
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    placa = getattr(e.veiculo, "placa", None) if e.veiculo else None
    if not placa:
        raise HTTPException(status_code=400, detail="Veículo sem placa para consulta")
    r = await _detran_situacao(ctx.loja.id, placa, db)
    return r


# ═══════════════════════════════════════════════════════════════
# GERENCIAR ITENS PERSONALIZADOS
# ═══════════════════════════════════════════════════════════════

@router.post("/{esteira_id}/itens", response_model=EsteiraDetalheResponse)
async def criar_item(
    esteira_id: str,
    body: ItemChecklistCreate,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    if ctx.usuario.papel not in (PapelUsuario.GESTOR, PapelUsuario.ADMIN_PLATAFORMA):
        raise HTTPException(
            status_code=403,
            detail="Permissão negada. Apenas gestores podem gerenciar itens do checklist.",
        )
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if e.concluida_em is not None:
        raise HTTPException(status_code=400, detail="Esteira já concluída")
    
    # Gerar chave slug a partir do título
    import re
    from unicodedata import normalize
    clean_title = normalize('NFKD', body.titulo).encode('ASCII', 'ignore').decode('ASCII')
    key = re.sub(r'[^a-z0-9_]', '', clean_title.lower().replace(' ', '_'))[:50]
    if not key:
        key = "item_customizado"
    
    item = ItemChecklist(
        esteira_id=e.id,
        chave=key,
        titulo=body.titulo,
        categoria=body.categoria,
        responsavel=body.responsavel,
        status=StatusItemChecklist.PENDENTE,
        obrigatorio=body.obrigatorio,
        prazo_em=body.prazo_em,
    )
    db.add(item)
    e.estagio = recalcular_estagio(e)
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_item_criado", "esteira_pos_venda", e.id,
        f"Item personalizado '{body.titulo}' criado na esteira {e.id}.",
    )
    return await detalhe(esteira_id, ctx, db)


@router.delete("/{esteira_id}/itens/{item_id}", response_model=EsteiraDetalheResponse)
async def deletar_item(
    esteira_id: str,
    item_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    if ctx.usuario.papel not in (PapelUsuario.GESTOR, PapelUsuario.ADMIN_PLATAFORMA):
        raise HTTPException(
            status_code=403,
            detail="Permissão negada. Apenas gestores podem gerenciar itens do checklist.",
        )
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if e.concluida_em is not None:
        raise HTTPException(status_code=400, detail="Esteira já concluída")
    
    item = next((i for i in e.itens if i.id == item_id), None)
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
        
    await db.delete(item)
    e.estagio = recalcular_estagio(e)
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_item_deletado", "esteira_pos_venda", e.id,
        f"Item '{item.titulo}' removido da esteira {e.id}.",
    )
    return await detalhe(esteira_id, ctx, db)


# ═══════════════════════════════════════════════════════════════
# CONCLUIR (portão duro)
# ═══════════════════════════════════════════════════════════════

@router.post("/{esteira_id}/concluir", response_model=EsteiraDetalheResponse)
async def concluir(
    esteira_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    e = await _carregar_esteira(db, esteira_id, ctx.loja.id)
    if e.concluida_em is not None:
        raise HTTPException(status_code=400, detail="Esteira já concluída")
    faltando = _obrigatorios_faltando(e)
    if faltando:
        raise HTTPException(
            status_code=400,
            detail={"message": "Itens obrigatórios pendentes", "faltando": faltando},
        )
    e.estagio = EstagioPosVenda.CONCLUIDO
    e.concluida_em = _now()
    await db.commit()
    await registrar_auditoria(
        db, e.loja_id, ctx.usuario.id, ctx.usuario.nome, "esteira_concluida", "esteira_pos_venda", e.id,
        f"Esteira pós-venda {e.id} concluída — arquivada na Carteira do Proprietário.",
    )
    return await detalhe(esteira_id, ctx, db)
