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

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from jinja2 import Environment, Undefined
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, desc

from conversas_service import MOTIVO_VENDIDO, arquivar_conversas_do_veiculo, emitir_avisos
from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from lib_formatacao import formatar_moeda, valor_por_extenso, data_por_extenso
from models import (
    utcnow,
    Contrato, Veiculo, ClientePF, StatusContrato, TipoContrato,
    StatusVeiculo, LancamentoFinanceiro, TipoLancamento,
    EsteiraPosVenda, EstagioPosVenda, OrigemLead, OrigemVeiculo, ComissaoVenda, MembroLoja,
    TemplateContrato, PublicacaoB2B, PropostaRepasse, StatusPropostaRepasse,
    EtapaLead, Lead, Usuario, ConfiguracaoFiscal,
)
from pos_venda_template import montar_checklist
from rbac import Acao, Recurso, can
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

    dados_extras_dict = json.loads(c.dados_extras) if c.dados_extras else None

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
        template_id=c.template_id,
        dados_extras=dados_extras_dict,
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

    status_anterior = contrato.status
    update_data = body.model_dump(exclude_unset=True)
    if "dados_extras" in update_data:
        val_extras = update_data.pop("dados_extras")
        contrato.dados_extras = json.dumps(val_extras) if val_extras is not None else None

    for key, value in update_data.items():
        setattr(contrato, key, value)

    contrato.updated_at = utcnow()

    # Cancelar um contrato de compra e venda desfaz a venda: o veículo volta ao
    # estoque como disponível, a esteira pós-venda é encerrada e fica o registro
    # na auditoria de que houve essa venda que acabou cancelada.
    cancelando = (
        contrato.status == StatusContrato.CANCELADO
        and status_anterior != StatusContrato.CANCELADO
    )
    if cancelando and contrato.tipo == TipoContrato.COMPRA_VENDA and contrato.veiculo_id:
        veic_res = await db.execute(
            select(Veiculo).where(
                Veiculo.id == contrato.veiculo_id,
                Veiculo.loja_id == ctx.loja.id,
            )
        )
        veiculo_rev = veic_res.scalar_one_or_none()
        if veiculo_rev and veiculo_rev.status == StatusVeiculo.VENDIDO:
            veiculo_rev.status = StatusVeiculo.DISPONIVEL
            veiculo_rev.comprador_id = None
            veiculo_rev.updated_at = utcnow()

            # Venda cancelada: republica onde a venda tinha derrubado (M079).
            from anuncios_service import enfileirar_sync_veiculo
            await enfileirar_sync_veiculo(db, veiculo_rev, "publicar")

            # Encerrar a esteira pós-venda desta venda (sem apagar histórico)
            est_res = await db.execute(
                select(EsteiraPosVenda).where(
                    EsteiraPosVenda.contrato_id == contrato.id,
                    EsteiraPosVenda.concluida_em.is_(None),
                )
            )
            for esteira_rev in est_res.scalars().all():
                esteira_rev.estagio = EstagioPosVenda.CONCLUIDO
                esteira_rev.concluida_em = utcnow()
                esteira_rev.updated_at = utcnow()

            await registrar_auditoria(
                db=db,
                loja_id=ctx.loja.id,
                ator_id=ctx.usuario.id,
                ator_nome=ctx.usuario.nome,
                acao="veiculo.venda_cancelada",
                entidade="veiculo",
                entidade_id=veiculo_rev.id,
                detalhes=(
                    f"Venda cancelada (contrato {contrato.numero}). "
                    f"{veiculo_rev.marca} {veiculo_rev.modelo} voltou para o estoque "
                    f"como disponível."
                ),
            )

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
        ie_fiscal = (await db.execute(
            select(ConfiguracaoFiscal.inscricao_estadual).where(
                ConfiguracaoFiscal.loja_id == ctx.loja.id
            )
        )).scalar_one_or_none()
        corpo = _render_template_contrato(contrato.template, contrato, ctx.loja, ie_fiscal)
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

    # 0. Vendedor responsável (B088) — resolvido ANTES de qualquer escrita.
    #    Ausente = quem está registrando (comportamento histórico).
    #    Só gestor/admin atribui a terceiros; vendedor só a si mesmo (403).
    #    O vínculo é validado na loja do contexto (isolamento multi-tenant).
    vendedor_id = ctx.usuario.id
    vendedor_nome_atribuido: Optional[str] = None
    if body.vendedor_id and body.vendedor_id != ctx.usuario.id:
        # Atribuir a venda a terceiro é escrita financeira (cria a ComissaoVenda
        # de outra pessoa): Acao.CRIAR em Recurso.FINANCEIRO = gestor/admin.
        # O bypass de módulo em can() só concede VER, nunca CRIAR — vendedor com
        # o módulo "financeiro" liberado continua sem poder atribuir.
        if not can(ctx.usuario, Acao.CRIAR, Recurso.FINANCEIRO):
            raise HTTPException(
                status_code=403,
                detail="Somente gestor ou admin pode atribuir a venda a outro vendedor.",
            )
        vinculo_res = await db.execute(
            select(Usuario.nome)
            .join(MembroLoja, MembroLoja.usuario_id == Usuario.id)
            .where(
                MembroLoja.usuario_id == body.vendedor_id,
                MembroLoja.loja_id == ctx.loja.id,
            )
        )
        vendedor_nome_atribuido = vinculo_res.scalar_one_or_none()
        if vendedor_nome_atribuido is None:
            raise HTTPException(
                status_code=404,
                detail="Vendedor não encontrado nesta loja.",
            )
        vendedor_id = body.vendedor_id

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
    total_outros = round(sum(o.valor for o in body.outros), 2)
    composto = round(total_trocas + dinheiro + fin_valor + total_outros, 2)
    excedente = round(composto - valor_venda, 2) if valor_venda and composto > valor_venda else 0.0
    entrada_total = round(dinheiro + total_trocas + total_outros, 2)

    # 2. Marcar veículo como vendido
    veiculo.status = StatusVeiculo.VENDIDO
    veiculo.publicado_marketplace = False
    veiculo.updated_at = utcnow()

    # 2a. Tirar do ar os anúncios nos portais (M079). Onde o portal não tem API,
    #     vira baixa_pendente para alguém remover manualmente.
    from anuncios_service import enfileirar_sync_veiculo
    await enfileirar_sync_veiculo(db, veiculo, "despublicar")

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

    # 2c. Fechar leads em aberto e garantir registro no CRM (etapa FECHAMENTO)
    lead_fechado: Optional[Lead] = None
    leads_res = await db.execute(
        select(Lead).where(
            Lead.veiculo_id == veiculo.id,
            Lead.etapa.notin_([EtapaLead.FECHAMENTO, EtapaLead.PERDIDO]),
        )
    )
    # Só o lead de QUEM COMPROU vira FECHAMENTO. Os leads das outras pessoas que
    # falavam deste carro não são do comprador — fechá-los (e reescrever o
    # `cliente_id` para o comprador, como acontecia antes) apagava o interesse
    # dessas pessoas do funil. Eles são desvinculados do veículo mais abaixo, no
    # arquivamento das conversas, e continuam no funil como "sem veículo definido".
    leads_abertos = [
        lead for lead in leads_res.scalars().all() if lead.cliente_id == cliente.id
    ]
    if leads_abertos:
        for lead_aberto in leads_abertos:
            lead_aberto.etapa = EtapaLead.FECHAMENTO
            lead_aberto.valor_proposta = valor_venda
            lead_aberto.updated_at = utcnow()
            lead_fechado = lead_aberto
    elif body.lead_id:
        lead_by_id_res = await db.execute(
            select(Lead).where(
                Lead.id == body.lead_id,
                Lead.loja_id == ctx.loja.id,
            )
        )
        lead_by_id = lead_by_id_res.scalar_one_or_none()
        if lead_by_id:
            lead_by_id.etapa = EtapaLead.FECHAMENTO
            lead_by_id.cliente_id = cliente.id
            lead_by_id.veiculo_id = veiculo.id
            lead_by_id.valor_proposta = valor_venda
            lead_by_id.updated_at = utcnow()
            lead_fechado = lead_by_id

    # Se nenhum Lead prévio foi atualizado, garante a criação/vínculo de um Lead
    # na etapa FECHAMENTO para que o comprador e a venda apareçam no CRM.
    if not lead_fechado:
        lead_existente_res = await db.execute(
            select(Lead).where(
                Lead.loja_id == ctx.loja.id,
                Lead.cliente_id == cliente.id,
                Lead.veiculo_id == veiculo.id,
            )
        )
        lead_existente = lead_existente_res.scalar_one_or_none()
        if lead_existente:
            lead_existente.etapa = EtapaLead.FECHAMENTO
            lead_existente.valor_proposta = valor_venda
            lead_existente.updated_at = utcnow()
            lead_fechado = lead_existente
        else:
            try:
                origem_lead = OrigemLead(body.origem) if body.origem else OrigemLead.MANUAL
            except ValueError:
                origem_lead = OrigemLead.MANUAL

            lead_fechado = Lead(
                loja_id=ctx.loja.id,
                cliente_id=cliente.id,
                veiculo_id=veiculo.id,
                etapa=EtapaLead.FECHAMENTO,
                origem=origem_lead,
                responsavel_id=vendedor_id,
                valor_proposta=valor_venda,
                observacoes=f"Venda de {veiculo.marca} {veiculo.modelo} concluída",
            )
            db.add(lead_fechado)
            await db.flush()  # garante lead_fechado.id

    # 2d. Arquivar as conversas B2C deste veículo — o carro saiu, o chat dele vira
    #     somente-leitura com aviso, e os leads de quem não comprou seguem no funil
    #     sem veículo. Roda DEPOIS do 2c (que já fechou o lead do comprador).
    avisos_conversas = await arquivar_conversas_do_veiculo(
        db, veiculo, MOTIVO_VENDIDO, comprador_cliente_id=cliente.id
    )

    # 3. Criar contrato de compra e venda (trocas = dação em pagamento)
    observacoes = body.observacoes or ""
    if body.outros:
        outros_txt = "\n".join(
            f"{o.descricao}: {formatar_moeda(o.valor)}" for o in body.outros
        )
        observacoes = f"{observacoes}\n{outros_txt}".strip() if observacoes else outros_txt
    if body.trocas:
        dacao = "\n".join(
            f"Dação em pagamento: {t.marca} {t.modelo}"
            + (f" {t.ano_fabricacao}/{t.ano_modelo}" if t.ano_fabricacao and t.ano_modelo else "")
            + (f", placa {t.placa}" if t.placa else ", sem placa")
            + f" — avaliado em {formatar_moeda(t.valor_avaliacao)}"
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
        template_id=body.template_id,
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
    receita = round(dinheiro + fin_valor + total_outros, 2)
    if receita > 0:
        composicao = []
        if dinheiro:
            composicao.append(f"dinheiro/PIX {formatar_moeda(dinheiro)}")
        for o in body.outros:
            composicao.append(f"{o.descricao} {formatar_moeda(o.valor)}")
        if fin_valor:
            composicao.append(f"financiado {formatar_moeda(fin_valor)}" + (f" em {parcelas}x" if parcelas else ""))
        if total_trocas:
            composicao.append(f"troca(s) {formatar_moeda(total_trocas)} (entraram no estoque)")
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
        vendedor_id=vendedor_id,
        origem=origem,
        lead_id=lead_fechado.id if lead_fechado else body.lead_id,
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
    #    O % é o do vendedor ATRIBUÍDO (vendedor_id), não o de quem registra
    #    a venda (B088).
    membro_res = await db.execute(
        select(MembroLoja.percentual_comissao).where(
            MembroLoja.usuario_id == vendedor_id,
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
        vendedor_id=vendedor_id,
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

    # Broadcast só após o commit — o WS nunca anuncia o que pode sofrer rollback.
    await emitir_avisos(db, avisos_conversas)

    detalhe_trocas = f" {len(trocas_criadas)} veículo(s) recebidos em troca." if trocas_criadas else ""
    detalhe_excedente = f" Excedente de {formatar_moeda(excedente)} somado à comissão do vendedor." if excedente > 0 else ""
    detalhe_vendedor = (
        f" Venda atribuída a {vendedor_nome_atribuido} (comissão de {percentual}%)."
        if vendedor_nome_atribuido
        else ""
    )
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
            f"{detalhe_trocas}{detalhe_excedente}{detalhe_vendedor}"
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

class _LacunaUndefined(Undefined):
    """Variável não preenchida vira linha para preencher à mão, não string vazia.

    Os modelos padrão referenciam `campos_extras` (forma de pagamento, dados
    bancários, datas de entrega) que o gestor pode deixar em branco. Sem isso o
    contrato sairia com a frase truncada, sem sinal de que falta um dado.
    """

    def __str__(self) -> str:
        return "___________"

    def __html__(self) -> str:
        return "___________"


_jinja_env = Environment(autoescape=True, undefined=_LacunaUndefined)


def _fmt_brl(v):
    if v is None:
        return "R$ ___________"
    return formatar_moeda(v)


def _fmt_extenso(v):
    """Valor por extenso para as cláusulas de preço; lacuna se não informado."""
    if v is None:
        return "_______________________"
    return valor_por_extenso(v)


def _render_template_contrato(
    template: TemplateContrato,
    contrato: Contrato,
    loja,
    inscricao_estadual: Optional[str] = None,
) -> str:
    """Renderiza um TemplateContrato com Jinja2 usando os dados do contrato.

    `inscricao_estadual` vem da configuração fiscal quando a loja não tem a IE
    própria preenchida — evita pedir o mesmo número duas vezes ao gestor.
    """
    veiculo = contrato.veiculo
    cliente = contrato.cliente

    # Campo extra não informado no contrato cai no `padrao` do modelo — assim o
    # contrato sai redigido (garantia de 90 dias, multa de 10%) em vez de vazio.
    dados_extras = {}
    if template.campos_extras:
        for campo in json.loads(template.campos_extras):
            if campo.get("padrao"):
                dados_extras[campo["chave"]] = campo["padrao"]
    if contrato.dados_extras:
        dados_extras.update({
            k: v for k, v in json.loads(contrato.dados_extras).items()
            if v not in (None, "")
        })

    contexto = {
        "cliente": {
            "nome": cliente.nome if cliente else "___________",
            "cpf": (cliente.cpf if cliente else None) or "___.___.___-__",
            "rg": (cliente.rg if cliente else None) or "___________",
            "telefone": (cliente.telefone if cliente else None) or "___________",
            "email": (cliente.email if cliente else None) or "___________",
            "endereco": (cliente.endereco if cliente else None) or "___________",
            "cidade": (cliente.cidade if cliente else None) or "___________",
            "estado": (cliente.estado if cliente else None) or "__",
            "nacionalidade": (cliente.nacionalidade if cliente else None) or "brasileiro(a)",
            "estado_civil": (cliente.estado_civil if cliente else None) or "___________",
            "profissao": (cliente.profissao if cliente else None) or "___________",
            "cnh": (cliente.cnh if cliente else None) or "___________",
            "cnh_categoria": (cliente.cnh_categoria if cliente else None) or "__",
        },
        "veiculo": {
            "marca": (veiculo.marca if veiculo else None) or "___________",
            "modelo": (veiculo.modelo if veiculo else None) or "___________",
            "versao": (veiculo.versao if veiculo else None) or "",
            "ano_fabricacao": veiculo.ano_fabricacao if veiculo else "____",
            "ano_modelo": veiculo.ano_modelo if veiculo else "____",
            "placa": (veiculo.placa if veiculo else None) or "___________",
            "chassi": (veiculo.chassi if veiculo else None) or "_________________",
            "renavam": (veiculo.renavam if veiculo else None) or "___________",
            "cor": (veiculo.cor if veiculo else None) or "___________",
            "km": veiculo.km if veiculo else 0,
            "combustivel": (veiculo.combustivel if veiculo else None) or "___________",
        },
        "loja": {
            "nome": loja.nome,
            "cnpj": loja.cnpj or "___.___.___/____-__",
            "inscricao_estadual": loja.inscricao_estadual or inscricao_estadual or "___________",
            "endereco": loja.endereco or "___________",
            "cidade": loja.cidade or "___________",
            "estado": loja.estado or "__",
            "cep": loja.cep or "_____-___",
            "telefone": loja.telefone or loja.whatsapp or "___________",
            "email": loja.email or "___________",
            "representante_nome": loja.representante_nome or "___________",
            "representante_cpf": loja.representante_cpf or "___.___.___-__",
            "representante_rg": loja.representante_rg or "___________",
        },
        "contrato": {
            "numero": contrato.numero,
            "valor_venda": _fmt_brl(contrato.valor_venda),
            "valor_venda_extenso": _fmt_extenso(contrato.valor_venda),
            "valor_entrada": _fmt_brl(contrato.valor_entrada),
            "valor_entrada_extenso": _fmt_extenso(contrato.valor_entrada),
            "parcelas": contrato.parcelas or "___",
            "observacoes": contrato.observacoes or "",
            "data": contrato.created_at.strftime("%d/%m/%Y") if contrato.created_at else "___/___/______",
            "data_extenso": data_por_extenso(contrato.created_at) if contrato.created_at else "___ de _________ de ____",
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
        return formatar_moeda(v)

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
