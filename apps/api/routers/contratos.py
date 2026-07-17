"""
Social Veículos — Rotas de Contratos (B2B)
Gestão de contratos de compra/venda, consignação e garantia.
Inclui ação de venda (Estoque → Contrato) e geração de PDF.

Melhoria 14 — Vender veículo → gerar contrato
"""

import math
import io
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from jinja2 import Environment
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, desc

from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import (
    utcnow,
    Contrato, Veiculo, ClientePF, StatusContrato, TipoContrato,
    StatusVeiculo, LancamentoFinanceiro, TipoLancamento,
    EsteiraPosVenda, OrigemLead, OrigemVeiculo, ComissaoVenda, MembroLoja,
    TemplateContrato, PublicacaoB2B, PropostaRepasse, StatusPropostaRepasse,
    EtapaLead, Lead,
)
from pos_venda_template import montar_checklist
from schemas import (
    ContratoCreateRequest,
    ContratoUpdateRequest,
    ContratoResponse,
    ContratoListResponse,
    VenderVeiculoRequest,
    VenderVeiculoResponse,
    TemplateContratoCreateRequest,
    TemplateContratoUpdateRequest,
    TemplateContratoResponse,
    TemplateContratoListResponse,
)

router = APIRouter(prefix="/v1", tags=["Contratos"])


# ── Helpers ────────────────────────────────────────────────────

async def gerar_numero_contrato(db: AsyncSession, loja_id: str, tipo: TipoContrato) -> str:
    """Gera número sequencial: CV-2026-0001, TC-2026-0001, TG-2026-0001."""
    prefixos = {
        TipoContrato.COMPRA_VENDA: "CV",
        TipoContrato.CONSIGNACAO: "TC",
        TipoContrato.GARANTIA: "TG",
    }
    prefixo = prefixos.get(tipo, "CV")
    ano = datetime.now(timezone.utc).year

    # Conta contratos existentes do tipo neste ano para esta loja
    stmt = select(func.count(Contrato.id)).where(
        Contrato.loja_id == loja_id,
        Contrato.numero.like(f"{prefixo}-{ano}-%"),
    )
    result = await db.execute(stmt)
    count = result.scalar() or 0

    return f"{prefixo}-{ano}-{count + 1:04d}"


def _contrato_to_response(c: Contrato) -> ContratoResponse:
    """Converte modelo Contrato para response com dados expandidos."""
    veiculo_nome = None
    if c.veiculo:
        v = c.veiculo
        veiculo_nome = f"{v.marca} {v.modelo}"
        if v.versao:
            veiculo_nome += f" {v.versao}"

    cliente_nome = c.cliente.nome if c.cliente else None

    return ContratoResponse(
        id=c.id,
        loja_id=c.loja_id,
        veiculo_id=c.veiculo_id,
        cliente_id=c.cliente_id,
        tipo=c.tipo,
        status=c.status,
        numero=c.numero,
        valor_venda=c.valor_venda,
        valor_entrada=c.valor_entrada,
        parcelas=c.parcelas,
        observacoes=c.observacoes,
        dados_ocr=c.dados_ocr,
        created_at=c.created_at,
        updated_at=c.updated_at,
        veiculo_nome=veiculo_nome,
        cliente_nome=cliente_nome,
    )


# ═══════════════════════════════════════════════════════════════
# ── CRUD DE CONTRATOS
# ═══════════════════════════════════════════════════════════════

@router.get("/contratos", response_model=ContratoListResponse)
async def listar_contratos(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status_filter: Optional[str] = Query(None, alias="status"),
    tipo: Optional[str] = None,
    q: Optional[str] = None,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista contratos da loja com filtros e paginação."""
    stmt = select(Contrato).where(Contrato.loja_id == ctx.loja.id)

    if status_filter:
        try:
            s = StatusContrato(status_filter)
            stmt = stmt.where(Contrato.status == s)
        except ValueError:
            pass

    if tipo:
        try:
            t = TipoContrato(tipo)
            stmt = stmt.where(Contrato.tipo == t)
        except ValueError:
            pass

    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Contrato.numero.ilike(like),
                Contrato.observacoes.ilike(like),
            )
        )

    # Total count
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    pages = max(1, math.ceil(total / per_page))

    # Fetch items
    from sqlalchemy.orm import selectinload
    stmt = stmt.options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
    ).order_by(desc(Contrato.created_at))
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(stmt)
    contratos = result.scalars().all()

    return ContratoListResponse(
        items=[_contrato_to_response(c) for c in contratos],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.post("/contratos", response_model=ContratoResponse, status_code=201)
async def criar_contrato(
    body: ContratoCreateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria um novo contrato (rascunho)."""
    numero = await gerar_numero_contrato(db, ctx.loja.id, body.tipo)

    contrato = Contrato(
        loja_id=ctx.loja.id,
        veiculo_id=body.veiculo_id,
        cliente_id=body.cliente_id,
        tipo=body.tipo,
        status=StatusContrato.RASCUNHO,
        numero=numero,
        valor_venda=body.valor_venda,
        valor_entrada=body.valor_entrada,
        parcelas=body.parcelas,
        observacoes=body.observacoes,
        dados_ocr=body.dados_ocr,
        template_id=body.template_id,
        dados_extras=json.dumps(body.dados_extras) if body.dados_extras else None,
    )
    db.add(contrato)
    await db.commit()
    await db.refresh(contrato)

    # Eager-load relationships
    from sqlalchemy.orm import selectinload
    stmt = select(Contrato).where(Contrato.id == contrato.id).options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one()

    await registrar_auditoria(
        db=db,
        loja_id=ctx.loja.id,
        ator_id=ctx.usuario.id,
        ator_nome=ctx.usuario.nome,
        acao="contrato.criar",
        entidade="contrato",
        entidade_id=contrato.id,
        detalhes=f"Contrato {numero} criado",
    )

    return _contrato_to_response(contrato)


@router.get("/contratos/{contrato_id}", response_model=ContratoResponse)
async def obter_contrato(
    contrato_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Obtém detalhes de um contrato."""
    from sqlalchemy.orm import selectinload
    stmt = select(Contrato).where(
        Contrato.id == contrato_id,
        Contrato.loja_id == ctx.loja.id,
    ).options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one_or_none()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")

    return _contrato_to_response(contrato)


@router.patch("/contratos/{contrato_id}", response_model=ContratoResponse)
async def atualizar_contrato(
    contrato_id: str,
    body: ContratoUpdateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Atualiza um contrato (dados ou status)."""
    stmt = select(Contrato).where(
        Contrato.id == contrato_id,
        Contrato.loja_id == ctx.loja.id,
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one_or_none()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(contrato, key, value)

    contrato.updated_at = utcnow()
    await db.commit()

    # Reload with relationships
    from sqlalchemy.orm import selectinload
    stmt = select(Contrato).where(Contrato.id == contrato.id).options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one()

    return _contrato_to_response(contrato)


@router.get("/contratos/{contrato_id}/pdf")
async def gerar_pdf_contrato(
    contrato_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Gera e retorna PDF do contrato."""
    from sqlalchemy.orm import selectinload
    stmt = select(Contrato).where(
        Contrato.id == contrato_id,
        Contrato.loja_id == ctx.loja.id,
    ).options(
        selectinload(Contrato.veiculo),
        selectinload(Contrato.cliente),
        selectinload(Contrato.template),
    )
    result = await db.execute(stmt)
    contrato = result.scalar_one_or_none()
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato não encontrado")

    # Gera HTML do contrato: template editável (se houver) ou gerador legado.
    # Cabeçalho/rodapé/marca-d'água da loja envolvem o corpo, repetindo em toda
    # página impressa — salvo se o modelo tiver desativado a identidade da loja.
    if contrato.template_id and contrato.template:
        usar_identidade = contrato.template.usar_identidade_loja
        corpo = _render_template_contrato(contrato.template, contrato, ctx.loja)
    else:
        usar_identidade = True
        corpo = _gerar_html_contrato(contrato, ctx.loja)

    html_content = _envolver_identidade_loja(corpo, contrato, ctx.loja, usar_identidade)

    # Retorna como HTML para impressão (PDF real requer wkhtmltopdf/weasyprint)
    return StreamingResponse(
        io.BytesIO(html_content.encode("utf-8")),
        media_type="text/html",
        headers={
            "Content-Disposition": f'inline; filename="contrato-{contrato.numero}.html"',
        },
    )


# ═══════════════════════════════════════════════════════════════
# ── CRUD DE MODELOS DE CONTRATO (TEMPLATES)
# ═══════════════════════════════════════════════════════════════

def _template_to_response(t: TemplateContrato) -> TemplateContratoResponse:
    campos = json.loads(t.campos_extras) if t.campos_extras else []
    return TemplateContratoResponse(
        id=t.id,
        loja_id=t.loja_id,
        nome=t.nome,
        conteudo_html=t.conteudo_html,
        campos_extras=campos,
        usar_identidade_loja=t.usar_identidade_loja,
        ativo=t.ativo,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


@router.get("/templates-contrato", response_model=TemplateContratoListResponse)
async def listar_templates_contrato(
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Lista modelos de contrato ativos da loja."""
    stmt = select(TemplateContrato).where(
        TemplateContrato.loja_id == ctx.loja.id,
        TemplateContrato.ativo == True,  # noqa: E712
    ).order_by(TemplateContrato.nome)
    result = await db.execute(stmt)
    templates = result.scalars().all()
    return TemplateContratoListResponse(items=[_template_to_response(t) for t in templates])


@router.post("/templates-contrato", response_model=TemplateContratoResponse, status_code=201)
async def criar_template_contrato(
    body: TemplateContratoCreateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Cria um novo modelo de contrato editável."""
    campos_json = json.dumps([c.model_dump() for c in body.campos_extras]) if body.campos_extras else None
    template = TemplateContrato(
        loja_id=ctx.loja.id,
        nome=body.nome,
        conteudo_html=body.conteudo_html,
        campos_extras=campos_json,
        usar_identidade_loja=body.usar_identidade_loja,
        ativo=True,
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


async def _obter_template_ou_404(template_id: str, loja_id: str, db: AsyncSession) -> TemplateContrato:
    stmt = select(TemplateContrato).where(
        TemplateContrato.id == template_id,
        TemplateContrato.loja_id == loja_id,
    )
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de contrato não encontrado")
    return template


@router.get("/templates-contrato/{template_id}", response_model=TemplateContratoResponse)
async def obter_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    return _template_to_response(template)


@router.patch("/templates-contrato/{template_id}", response_model=TemplateContratoResponse)
async def atualizar_template_contrato(
    template_id: str,
    body: TemplateContratoUpdateRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    update_data = body.model_dump(exclude_unset=True)
    if "campos_extras" in update_data:
        campos = update_data.pop("campos_extras")
        template.campos_extras = json.dumps(campos) if campos else None
    for key, value in update_data.items():
        setattr(template, key, value)
    template.updated_at = utcnow()
    await db.commit()
    await db.refresh(template)
    return _template_to_response(template)


@router.delete("/templates-contrato/{template_id}", status_code=204)
async def excluir_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete — marca como inativo."""
    template = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    template.ativo = False
    template.updated_at = utcnow()
    await db.commit()


@router.post("/templates-contrato/{template_id}/duplicar", response_model=TemplateContratoResponse, status_code=201)
async def duplicar_template_contrato(
    template_id: str,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    original = await _obter_template_ou_404(template_id, ctx.loja.id, db)
    copia = TemplateContrato(
        loja_id=ctx.loja.id,
        nome=f"{original.nome} (cópia)",
        conteudo_html=original.conteudo_html,
        campos_extras=original.campos_extras,
        usar_identidade_loja=original.usar_identidade_loja,
        ativo=True,
    )
    db.add(copia)
    await db.commit()
    await db.refresh(copia)
    return _template_to_response(copia)


# ═══════════════════════════════════════════════════════════════
# ── AÇÃO DE VENDA (Estoque → Contrato)
# ═══════════════════════════════════════════════════════════════

@router.post("/veiculos/{veiculo_id}/vender", response_model=VenderVeiculoResponse)
async def vender_veiculo(
    veiculo_id: str,
    body: VenderVeiculoRequest,
    ctx: B2BContext = Depends(get_current_b2b_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Fecha a venda de um veículo num ato só (tudo na mesma transação):
    1. Cliente existente (cliente_id) ou cadastrado na hora (cliente_novo)
    2. Trocas entram no estoque como rascunho (origem=troca, custo=avaliação,
       vinculadas à venda via contrato_origem_id)
    3. Contrato de compra e venda com dação em pagamento nas observações
    4. Receita = o que entra de fato em caixa (dinheiro + financiado); as
       trocas entram como ativo de estoque
    5. Excedente (composto > venda) soma na comissão do vendedor — "volta ao
       cliente" não existe na prática dos garagistas
    6. Esteira pós-venda com checklist
    """
    # Buscar veículo
    stmt = select(Veiculo).where(
        Veiculo.id == veiculo_id,
        Veiculo.loja_id == ctx.loja.id,
    )
    result = await db.execute(stmt)
    veiculo = result.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado")

    if veiculo.status == StatusVeiculo.VENDIDO:
        raise HTTPException(status_code=400, detail="Veículo já está vendido")

    # 1. Cliente: existente ou cadastro rápido no ato
    if body.cliente_id:
        stmt_cli = select(ClientePF).where(
            ClientePF.id == body.cliente_id,
            ClientePF.loja_id == ctx.loja.id,
        )
        result_cli = await db.execute(stmt_cli)
        cliente = result_cli.scalar_one_or_none()
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado")
    elif body.cliente_novo:
        cliente = ClientePF(
            loja_id=ctx.loja.id,
            nome=body.cliente_novo.nome,
            cpf=body.cliente_novo.cpf,
            telefone=body.cliente_novo.telefone,
        )
        db.add(cliente)
        await db.flush()  # garante cliente.id
    else:
        raise HTTPException(
            status_code=422,
            detail="Informe cliente_id ou cliente_novo para fechar a venda.",
        )

    # Composição do pagamento (pagamento_dinheiro/financiamento novos;
    # valor_entrada/parcelas legados continuam aceitos)
    valor_venda = body.valor_venda or veiculo.preco_venda or 0
    dinheiro = body.pagamento_dinheiro if body.pagamento_dinheiro is not None else (body.valor_entrada or 0)
    fin_valor = body.financiamento.valor if body.financiamento else 0
    parcelas = body.financiamento.parcelas if body.financiamento else body.parcelas
    financiado = bool(body.financiamento) or bool(body.financiado)
    total_trocas = round(sum(t.valor_avaliacao for t in body.trocas), 2)
    composto = round(total_trocas + dinheiro + fin_valor, 2)
    excedente = round(composto - valor_venda, 2) if valor_venda and composto > valor_venda else 0.0
    entrada_total = round(dinheiro + total_trocas, 2)

    # 2. Marcar veículo como vendido
    veiculo.status = StatusVeiculo.VENDIDO
    veiculo.publicado_marketplace = False
    veiculo.updated_at = utcnow()

    # 2b. Desativar publicação B2B e rejeitar propostas de repasse pendentes
    #     (venda no balcão fecha o ciclo mesmo se o veículo estava em REPASSE)
    pub_res = await db.execute(
        select(PublicacaoB2B).where(PublicacaoB2B.veiculo_id == veiculo.id)
    )
    publicacao_b2b = pub_res.scalar_one_or_none()
    if publicacao_b2b:
        publicacao_b2b.ativa = False
        publicacao_b2b.updated_at = utcnow()

    propostas_res = await db.execute(
        select(PropostaRepasse).where(
            PropostaRepasse.veiculo_id == veiculo.id,
            PropostaRepasse.status == StatusPropostaRepasse.PENDENTE,
        )
    )
    for proposta_pendente in propostas_res.scalars().all():
        proposta_pendente.status = StatusPropostaRepasse.REJEITADA
        proposta_pendente.updated_at = utcnow()

    # 2c. Fechar leads em aberto deste veículo (o carro foi vendido)
    leads_res = await db.execute(
        select(Lead).where(
            Lead.veiculo_id == veiculo.id,
            Lead.etapa.notin_([EtapaLead.FECHAMENTO, EtapaLead.PERDIDO]),
        )
    )
    for lead_aberto in leads_res.scalars().all():
        lead_aberto.etapa = EtapaLead.FECHAMENTO

    # 3. Criar contrato de compra e venda (trocas = dação em pagamento)
    observacoes = body.observacoes or ""
    if body.trocas:
        dacao = "\n".join(
            f"Dação em pagamento: {t.marca} {t.modelo}"
            + (f" {t.ano_fabricacao}/{t.ano_modelo}" if t.ano_fabricacao and t.ano_modelo else "")
            + (f", placa {t.placa}" if t.placa else ", sem placa")
            + f" — avaliado em R$ {t.valor_avaliacao:,.2f}"
            for t in body.trocas
        )
        observacoes = f"{observacoes}\n{dacao}".strip() if observacoes else dacao

    numero = await gerar_numero_contrato(db, ctx.loja.id, TipoContrato.COMPRA_VENDA)
    contrato = Contrato(
        loja_id=ctx.loja.id,
        veiculo_id=veiculo.id,
        cliente_id=cliente.id,
        tipo=TipoContrato.COMPRA_VENDA,
        status=StatusContrato.AGUARDANDO,
        numero=numero,
        valor_venda=valor_venda,
        valor_entrada=entrada_total or None,
        parcelas=parcelas,
        observacoes=observacoes or None,
    )
    db.add(contrato)
    await db.flush()  # garante contrato.id para vincular as trocas

    # 4. Trocas entram no estoque como rascunho, rastreáveis até o contrato
    ano_fallback = datetime.now(timezone.utc).year
    trocas_criadas = []
    for t in body.trocas:
        v_troca = Veiculo(
            loja_id=ctx.loja.id,
            marca=t.marca,
            modelo=t.modelo,
            versao=t.versao,
            ano_fabricacao=t.ano_fabricacao or ano_fallback,
            ano_modelo=t.ano_modelo or t.ano_fabricacao or ano_fallback,
            placa=t.placa,
            km=t.km or 0,
            cor=t.cor,
            preco_custo=t.valor_avaliacao,
            status=StatusVeiculo.RASCUNHO,
            publicado_marketplace=False,
            origem=OrigemVeiculo.TROCA,
            contrato_origem_id=contrato.id,
        )
        db.add(v_troca)
        trocas_criadas.append(v_troca)

    # 5. Receita = só o que entra de fato em caixa (dinheiro + financiado).
    #    O valor das trocas vira custo de estoque dos veículos criados acima.
    receita = round(dinheiro + fin_valor, 2)
    if receita > 0:
        composicao = []
        if dinheiro:
            composicao.append(f"dinheiro/PIX R$ {dinheiro:,.2f}")
        if fin_valor:
            composicao.append(f"financiado R$ {fin_valor:,.2f}" + (f" em {parcelas}x" if parcelas else ""))
        if total_trocas:
            composicao.append(f"troca(s) R$ {total_trocas:,.2f} (entraram no estoque)")
        lancamento = LancamentoFinanceiro(
            loja_id=ctx.loja.id,
            tipo=TipoLancamento.RECEITA,
            descricao=f"Venda: {veiculo.marca} {veiculo.modelo} — {cliente.nome}",
            valor=receita,
            veiculo_id=veiculo.id,
            categoria="venda_veiculo",
            observacoes="Composição: " + ", ".join(composicao) if composicao else None,
            data=utcnow(),
        )
        db.add(lancamento)

    # 6. Gravar o comprador no veículo (Carteira do Proprietário — M018)
    veiculo.comprador_id = cliente.id

    # 7. Abrir a esteira pós-venda + semear o checklist invisível (§6.4)
    try:
        origem = OrigemLead(body.origem) if body.origem else OrigemLead.MANUAL
    except ValueError:
        origem = OrigemLead.MANUAL
    esteira = EsteiraPosVenda(
        loja_id=ctx.loja.id,
        veiculo_id=veiculo.id,
        contrato_id=contrato.id,
        comprador_id=cliente.id,
        vendedor_id=ctx.usuario.id,
        origem=origem,
        lead_id=body.lead_id,
    )
    db.add(esteira)
    await db.flush()  # garante esteira.id para os itens
    for item in montar_checklist(
        esteira, veiculo, contrato,
        valor_entrada=entrada_total or None,
        parcelas=parcelas,
        financiado=financiado,
        data_venda=utcnow(),
    ):
        db.add(item)

    # 8. Comissão automática do vendedor (TDD 2026-07-02)
    #    % resolvido: override do membro → padrão da loja → 0 (nunca silenciosa:
    #    com % 0 a comissão aparece no financeiro como "definir %").
    #    O excedente da troca (composto > venda) soma na comissão — volta ao
    #    cliente não existe na prática.
    membro_res = await db.execute(
        select(MembroLoja.percentual_comissao).where(
            MembroLoja.usuario_id == ctx.usuario.id,
            MembroLoja.loja_id == ctx.loja.id,
        )
    )
    percentual_membro = membro_res.scalar_one_or_none()
    percentual = (
        percentual_membro
        if percentual_membro is not None
        else (ctx.loja.percentual_comissao_padrao or 0.0)
    )
    comissao = ComissaoVenda(
        loja_id=ctx.loja.id,
        vendedor_id=ctx.usuario.id,
        veiculo_id=veiculo.id,
        esteira_id=esteira.id,
        valor_venda=valor_venda,
        percentual=percentual,
        valor_comissao=round(valor_venda * (percentual / 100.0) + excedente, 2),
        pago=False,
    )
    db.add(comissao)

    await db.commit()
    await db.refresh(contrato)
    await db.refresh(esteira)

    detalhe_trocas = f" {len(trocas_criadas)} veículo(s) recebidos em troca." if trocas_criadas else ""
    detalhe_excedente = f" Excedente de R$ {excedente:,.2f} somado à comissão do vendedor." if excedente > 0 else ""
    await registrar_auditoria(
        db=db,
        loja_id=ctx.loja.id,
        ator_id=ctx.usuario.id,
        ator_nome=ctx.usuario.nome,
        acao="veiculo.vender",
        entidade="veiculo",
        entidade_id=veiculo.id,
        detalhes=(
            f"Veículo {veiculo.marca} {veiculo.modelo} vendido para {cliente.nome}. "
            f"Contrato {numero}. Esteira pós-venda {esteira.id} aberta."
            f"{detalhe_trocas}{detalhe_excedente}"
        ),
    )

    return VenderVeiculoResponse(
        message=f"Veículo vendido com sucesso! Contrato {numero} gerado.",
        contrato_id=contrato.id,
        veiculo_id=veiculo.id,
        esteira_id=esteira.id,
        trocas_veiculo_ids=[v.id for v in trocas_criadas],
        comissao_excedente=excedente if excedente > 0 else None,
        lead_id=esteira.lead_id,
    )


# ═══════════════════════════════════════════════════════════════
# ── RENDER DE MODELOS DE CONTRATO (Jinja2)
# ═══════════════════════════════════════════════════════════════

_jinja_env = Environment(autoescape=True)


def _fmt_brl(v):
    if v is None:
        return "R$ ___________"
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _render_template_contrato(template: TemplateContrato, contrato: Contrato, loja) -> str:
    """Renderiza um TemplateContrato com Jinja2 usando os dados do contrato."""
    veiculo = contrato.veiculo
    cliente = contrato.cliente
    dados_extras = json.loads(contrato.dados_extras) if contrato.dados_extras else {}

    contexto = {
        "cliente": {
            "nome": cliente.nome if cliente else "___________",
            "cpf": (cliente.cpf if cliente else None) or "___.___.___-__",
            "rg": (cliente.rg if cliente else None) or "___________",
            "telefone": (cliente.telefone if cliente else None) or "___________",
            "endereco": (cliente.endereco if cliente else None) or "___________",
            "cidade": (cliente.cidade if cliente else None) or "___________",
            "estado": (cliente.estado if cliente else None) or "__",
        },
        "veiculo": {
            "marca": (veiculo.marca if veiculo else None) or "___________",
            "modelo": (veiculo.modelo if veiculo else None) or "___________",
            "versao": (veiculo.versao if veiculo else None) or "",
            "ano_fabricacao": veiculo.ano_fabricacao if veiculo else "____",
            "ano_modelo": veiculo.ano_modelo if veiculo else "____",
            "placa": (veiculo.placa if veiculo else None) or "___________",
            "cor": (veiculo.cor if veiculo else None) or "___________",
            "km": veiculo.km if veiculo else 0,
            "combustivel": (veiculo.combustivel if veiculo else None) or "___________",
        },
        "loja": {
            "nome": loja.nome,
            "cnpj": loja.cnpj or "___.___.___/____-__",
            "endereco": loja.endereco or "___________",
            "cidade": loja.cidade or "___________",
            "estado": loja.estado or "__",
            "telefone": loja.telefone or loja.whatsapp or "___________",
        },
        "contrato": {
            "numero": contrato.numero,
            "valor_venda": _fmt_brl(contrato.valor_venda),
            "valor_entrada": _fmt_brl(contrato.valor_entrada),
            "parcelas": contrato.parcelas or "___",
            "observacoes": contrato.observacoes or "",
            "data": contrato.created_at.strftime("%d/%m/%Y") if contrato.created_at else "___/___/______",
        },
        **dados_extras,
    }

    return _jinja_env.from_string(template.conteudo_html).render(**contexto)


# ═══════════════════════════════════════════════════════════════
# ── IDENTIDADE DA LOJA NO DOCUMENTO (cabeçalho/rodapé/marca-d'água)
# ═══════════════════════════════════════════════════════════════

def _contexto_documento(contrato: Contrato, loja) -> dict:
    """Contexto Jinja compartilhado (cabeçalho/rodapé aceitam as mesmas variáveis)."""
    veiculo = contrato.veiculo
    cliente = contrato.cliente
    return {
        "loja": {
            "nome": loja.nome,
            "cnpj": loja.cnpj or "___.___.___/____-__",
            "endereco": loja.endereco or "___________",
            "cidade": loja.cidade or "___________",
            "estado": loja.estado or "__",
            "telefone": loja.telefone or loja.whatsapp or "___________",
        },
        "cliente": {"nome": cliente.nome if cliente else "___________"},
        "veiculo": {
            "marca": (veiculo.marca if veiculo else None) or "___________",
            "modelo": (veiculo.modelo if veiculo else None) or "___________",
        },
        "contrato": {
            "numero": contrato.numero,
            "data": contrato.created_at.strftime("%d/%m/%Y") if contrato.created_at else "___/___/______",
        },
    }


def _envolver_identidade_loja(corpo_html: str, contrato: Contrato, loja, usar_identidade: bool) -> str:
    """
    Envolve o corpo do contrato com cabeçalho/rodapé/marca-d'água da loja, fixos
    para repetir no topo e no rodapé de CADA página impressa (@page + position:fixed).

    - Respeita o toggle do modelo (usar_identidade=False → devolve o corpo intacto).
    - Cabeçalho/rodapé são HTML rico do editor e podem conter variáveis Jinja.
    - Marca-d'água usa a imagem própria da loja ou, na ausência, a logo.
    """
    cabecalho = (loja.contrato_cabecalho or "").strip() if usar_identidade else ""
    rodape = (loja.contrato_rodape or "").strip() if usar_identidade else ""
    marca_url = None
    if usar_identidade and loja.contrato_marca_dagua_ativa:
        marca_url = loja.contrato_marca_dagua_url or loja.logo_url

    # Nada a aplicar: preserva o documento como veio (inclui o gerador legado completo).
    if not cabecalho and not rodape and not marca_url:
        return corpo_html

    ctx = _contexto_documento(contrato, loja)
    if cabecalho:
        cabecalho = _jinja_env.from_string(cabecalho).render(**ctx)
    if rodape:
        rodape = _jinja_env.from_string(rodape).render(**ctx)

    header_html = f'<div class="doc-cabecalho">{cabecalho}</div>' if cabecalho else ""
    footer_html = f'<div class="doc-rodape">{rodape}</div>' if rodape else ""
    marca_html = (
        f'<div class="doc-marca-dagua"><img src="{marca_url}" alt=""></div>' if marca_url else ""
    )

    # Se o corpo é um documento completo (gerador legado), extrai só o miolo do <body>.
    corpo_interno = corpo_html
    low = corpo_html.lower()
    if "<body" in low and "</body>" in low:
        ini = low.index("<body")
        ini = low.index(">", ini) + 1
        corpo_interno = corpo_html[ini: low.index("</body>")]

    identidade_css = """
  @page { margin: 3.2cm 2cm 2.6cm 2cm; }
  .doc-cabecalho { position: fixed; top: -2.6cm; left: 0; right: 0; text-align: center; font-size: 12px; }
  .doc-rodape    { position: fixed; bottom: -2cm; left: 0; right: 0; text-align: center; font-size: 11px; color: #888; }
  .doc-cabecalho img, .doc-rodape img { max-height: 60px; }
  .doc-marca-dagua { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: -1; }
  .doc-marca-dagua img { width: 55%; max-width: 480px; opacity: 0.06; }
  .doc-corpo { position: relative; }
"""

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{contrato.numero}</title>
<style>
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }}
  h1 {{ text-align: center; font-size: 18px; margin-bottom: 4px; letter-spacing: 1px; }}
  h2 {{ font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; color: #333; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0; }}
  td {{ padding: 4px 8px; vertical-align: top; }}
  td:first-child {{ width: 180px; color: #555; }}
  .numero {{ text-align: center; color: #666; font-size: 12px; margin-bottom: 30px; }}
  .valor {{ font-size: 16px; font-weight: bold; color: #0053db; }}
  .assinatura {{ margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }}
  .assinatura div {{ flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px; }}
  .obs {{ background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; margin: 12px 0; }}
  .footer {{ margin-top: 40px; text-align: center; font-size: 11px; color: #999; }}
{identidade_css}
</style>
</head>
<body>
{marca_html}
{header_html}
{footer_html}
<div class="doc-corpo">
{corpo_interno}
</div>
</body>
</html>"""


# ═══════════════════════════════════════════════════════════════
# ── GERAÇÃO DE HTML DO CONTRATO (para impressão/PDF)
# ═══════════════════════════════════════════════════════════════

def _gerar_html_contrato(contrato: Contrato, loja) -> str:
    """Gera HTML formatado do contrato para impressão."""
    tipo_labels = {
        TipoContrato.COMPRA_VENDA: "CONTRATO DE COMPRA E VENDA DE VEÍCULO",
        TipoContrato.CONSIGNACAO: "TERMO DE CONSIGNAÇÃO DE VEÍCULO",
        TipoContrato.GARANTIA: "TERMO DE GARANTIA DE VEÍCULO",
    }
    titulo = tipo_labels.get(contrato.tipo, "CONTRATO")

    veiculo = contrato.veiculo
    cliente = contrato.cliente
    data_str = contrato.created_at.strftime("%d/%m/%Y") if contrato.created_at else "___/___/______"

    def fmt_brl(v):
        if v is None:
            return "R$ ___________"
        return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    veiculo_desc = ""
    if veiculo:
        veiculo_desc = f"""
        <tr><td><strong>Marca/Modelo:</strong></td><td>{veiculo.marca} {veiculo.modelo} {veiculo.versao or ''}</td></tr>
        <tr><td><strong>Ano:</strong></td><td>{veiculo.ano_fabricacao}/{veiculo.ano_modelo}</td></tr>
        <tr><td><strong>Placa:</strong></td><td>{veiculo.placa or '___________'}</td></tr>
        <tr><td><strong>Cor:</strong></td><td>{veiculo.cor or '___________'}</td></tr>
        <tr><td><strong>KM:</strong></td><td>{veiculo.km:,} km</td></tr>
        <tr><td><strong>Combustível:</strong></td><td>{(veiculo.combustivel or '___________').replace('_', ' ').title()}</td></tr>
        """

    cliente_desc = ""
    if cliente:
        cliente_desc = f"""
        <tr><td><strong>Nome:</strong></td><td>{cliente.nome}</td></tr>
        <tr><td><strong>CPF:</strong></td><td>{cliente.cpf or '___.___.___-__'}</td></tr>
        <tr><td><strong>RG:</strong></td><td>{cliente.rg or '___________'}</td></tr>
        <tr><td><strong>Telefone:</strong></td><td>{cliente.telefone or '___________'}</td></tr>
        <tr><td><strong>Endereço:</strong></td><td>{cliente.endereco or '___________'}, {cliente.cidade or '___________'} - {cliente.estado or '__'}</td></tr>
        """

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>{contrato.numero} — {titulo}</title>
<style>
  @page {{ margin: 2cm; }}
  body {{ font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 40px; }}
  h1 {{ text-align: center; font-size: 18px; margin-bottom: 4px; letter-spacing: 1px; }}
  .numero {{ text-align: center; color: #666; font-size: 12px; margin-bottom: 30px; }}
  h2 {{ font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; color: #333; }}
  table {{ width: 100%; border-collapse: collapse; margin: 8px 0; }}
  td {{ padding: 4px 8px; vertical-align: top; }}
  td:first-child {{ width: 180px; color: #555; }}
  .valor {{ font-size: 16px; font-weight: bold; color: #0053db; }}
  .assinatura {{ margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }}
  .assinatura div {{ flex: 1; text-align: center; border-top: 1px solid #333; padding-top: 8px; }}
  .obs {{ background: #f8f9fa; padding: 12px; border-radius: 6px; border: 1px solid #e0e0e0; margin: 12px 0; }}
  .footer {{ margin-top: 40px; text-align: center; font-size: 11px; color: #999; }}
  @media print {{ body {{ padding: 0; }} }}
</style>
</head>
<body>
<h1>{titulo}</h1>
<p class="numero">Nº {contrato.numero} — {data_str}</p>

<h2>VENDEDOR (LOJA)</h2>
<table>
  <tr><td><strong>Razão Social:</strong></td><td>{loja.nome}</td></tr>
  <tr><td><strong>CNPJ:</strong></td><td>{loja.cnpj or '___.___.___/____-__'}</td></tr>
  <tr><td><strong>Endereço:</strong></td><td>{loja.endereco or '___________'}, {loja.cidade or '___________'} - {loja.estado or '__'}</td></tr>
  <tr><td><strong>Telefone:</strong></td><td>{loja.telefone or loja.whatsapp or '___________'}</td></tr>
</table>

<h2>COMPRADOR</h2>
<table>
  {cliente_desc or '<tr><td colspan="2">___________________________________________</td></tr>'}
</table>

<h2>VEÍCULO</h2>
<table>
  {veiculo_desc or '<tr><td colspan="2">___________________________________________</td></tr>'}
</table>

<h2>CONDIÇÕES</h2>
<table>
  <tr><td><strong>Valor da Venda:</strong></td><td class="valor">{fmt_brl(contrato.valor_venda)}</td></tr>
  <tr><td><strong>Entrada:</strong></td><td>{fmt_brl(contrato.valor_entrada)}</td></tr>
  <tr><td><strong>Parcelas:</strong></td><td>{contrato.parcelas or '___'} x</td></tr>
</table>

{f'<div class="obs"><strong>Observações:</strong> {contrato.observacoes}</div>' if contrato.observacoes else ''}

<h2>CLÁUSULAS</h2>
<p>1. O VENDEDOR declara que o veículo descrito acima é de sua propriedade, livre e desembaraçado de quaisquer ônus.</p>
<p>2. O COMPRADOR declara ter examinado o veículo e estar de acordo com suas condições.</p>
<p>3. A transferência de propriedade junto ao DETRAN é de responsabilidade do COMPRADOR, devendo ser realizada no prazo máximo de 30 dias.</p>
<p>4. O VENDEDOR se responsabiliza por quaisquer multas e infrações anteriores à data deste contrato.</p>
<p>5. Este contrato é firmado em caráter irrevogável e irretratável, obrigando as partes, seus herdeiros e sucessores.</p>

<div class="assinatura">
  <div>
    <p>{loja.nome}</p>
    <small>VENDEDOR</small>
  </div>
  <div>
    <p>{cliente.nome if cliente else '________________________'}</p>
    <small>COMPRADOR</small>
  </div>
</div>

<p class="footer">{loja.cidade or '___________'} - {loja.estado or '__'}, {data_str}<br>Gerado por SocialVeículos</p>
</body>
</html>"""
