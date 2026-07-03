"""
Social Veículos — Fiscal / NF-e (M039, Fase 1)

Emissão de NF-e de venda via gateway Focus NFe. Custo absorvido pela
plataforma (conta mestre); cada loja tem sua "empresa" própria no gateway
(isolamento) e seu certificado A1 cifrado. Escopo desta fase: só NF-e de
venda (saída), ambiente homologação. Sem o módulo/config completos, a
emissão fica bloqueada — nunca uma nota fake.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

import fiscal_gateway
from config import settings
from database import get_db
from deps import get_current_b2b_user, B2BContext, registrar_auditoria
from models import (
    ConfiguracaoFiscal,
    NotaFiscal,
    Contrato,
    Loja,
    EsteiraPosVenda,
)
from modulos import Modulo, exige_modulo
from rbac import exige_permissao, Acao, Recurso
from routers.esteira import anexar_documento_interno
from simulador.crypt import encrypt_credentials
from storage import storage_provider

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/fiscal", tags=["Fiscal / NF-e"])


# ═══════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ═══════════════════════════════════════════════════════════════

class ConfiguracaoFiscalRequest(BaseModel):
    inscricao_estadual: Optional[str] = None
    regime_tributario: str = Field(default="simples")
    cnae: Optional[str] = None
    ambiente: str = Field(default="homologacao")
    natureza_operacao: str = Field(default="Venda de veículo usado")
    cfop_venda: str = Field(default="5102")
    ncm_padrao: str = Field(default="87032310")
    csosn: Optional[str] = None
    cst: Optional[str] = None
    origem_mercadoria: str = Field(default="0")


class ConfiguracaoFiscalResponse(BaseModel):
    configurada: bool
    inscricao_estadual: Optional[str] = None
    regime_tributario: Optional[str] = None
    cnae: Optional[str] = None
    ambiente: Optional[str] = None
    natureza_operacao: Optional[str] = None
    cfop_venda: Optional[str] = None
    ncm_padrao: Optional[str] = None
    certificado_configurado: bool = False
    certificado_validade: Optional[datetime] = None
    ativo: bool = False


def _to_config_response(c: Optional[ConfiguracaoFiscal]) -> dict:
    if not c:
        return {"configurada": False}
    return {
        "configurada": True,
        "inscricao_estadual": c.inscricao_estadual,
        "regime_tributario": c.regime_tributario,
        "cnae": c.cnae,
        "ambiente": c.ambiente,
        "natureza_operacao": c.natureza_operacao,
        "cfop_venda": c.cfop_venda,
        "ncm_padrao": c.ncm_padrao,
        "certificado_configurado": bool(c.certificado_a1_cifrado),
        "certificado_validade": c.certificado_validade,
        "ativo": c.ativo,
    }


async def _carregar_config(db: AsyncSession, loja_id: str) -> Optional[ConfiguracaoFiscal]:
    res = await db.execute(select(ConfiguracaoFiscal).where(ConfiguracaoFiscal.loja_id == loja_id))
    return res.scalar_one_or_none()


@router.get("/config", response_model=ConfiguracaoFiscalResponse,
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.CONFIGURACOES))])
async def obter_config(
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    return _to_config_response(await _carregar_config(db, context.loja_id))


@router.put("/config", response_model=ConfiguracaoFiscalResponse,
            dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def salvar_config(
    data: ConfiguracaoFiscalRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    if data.ambiente not in ("homologacao", "producao"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Ambiente deve ser 'homologacao' ou 'producao'.")

    config = await _carregar_config(db, context.loja_id)
    campos = data.model_dump()
    if config:
        for k, v in campos.items():
            setattr(config, k, v)
    else:
        config = ConfiguracaoFiscal(loja_id=context.loja_id, **campos)
        db.add(config)

    await db.commit()
    await db.refresh(config)
    return _to_config_response(config)


@router.post("/certificado", response_model=ConfiguracaoFiscalResponse,
             dependencies=[Depends(exige_permissao(Acao.EDITAR, Recurso.CONFIGURACOES))])
async def enviar_certificado(
    arquivo: UploadFile = File(...),
    senha: str = Form(...),
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    """Sobe o certificado A1 (.pfx), cadastra a loja como empresa no Focus NFe
    (se ainda não tiver token) e envia o certificado para o gateway."""
    config = await _carregar_config(db, context.loja_id)
    if not config:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Configure os dados fiscais antes de enviar o certificado.")

    res = await db.execute(select(Loja).where(Loja.id == context.loja_id))
    loja = res.scalar_one_or_none()
    if not loja or not loja.cnpj:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Loja sem CNPJ cadastrado — obrigatório para o gateway fiscal.")

    pfx_bytes = await arquivo.read()
    if not pfx_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Arquivo de certificado vazio.")

    try:
        if not config.focus_nfe_token_cifrado:
            token = await fiscal_gateway.cadastrar_empresa(config, loja)
            config.focus_nfe_token_cifrado = encrypt_credentials(token)
        await fiscal_gateway.enviar_certificado(config, pfx_bytes, senha)
    except Exception as e:
        logger.error(f"[Fiscal] Falha ao configurar certificado no gateway: {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Falha ao validar certificado no gateway fiscal. Confira o arquivo e a senha.")

    config.certificado_a1_cifrado = encrypt_credentials(pfx_bytes.hex())
    config.certificado_senha_cifrada = encrypt_credentials(senha)
    config.ativo = bool(config.inscricao_estadual and config.focus_nfe_token_cifrado)

    await db.commit()
    await db.refresh(config)
    return _to_config_response(config)


# ═══════════════════════════════════════════════════════════════
# EMISSÃO DE NF-e
# ═══════════════════════════════════════════════════════════════

class EmitirNotaRequest(BaseModel):
    contrato_id: str


class NotaFiscalResponse(BaseModel):
    id: str
    contrato_id: Optional[str]
    tipo: str
    ambiente: str
    status: str
    numero: int
    serie: str
    chave_acesso: Optional[str]
    valor_total: float
    xml_url: Optional[str]
    danfe_pdf_url: Optional[str]
    motivo_rejeicao: Optional[str]
    emitida_em: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


@router.post("/notas", response_model=NotaFiscalResponse,
             dependencies=[Depends(exige_modulo(Modulo.FISCAL)), Depends(exige_permissao(Acao.CRIAR, Recurso.FINANCEIRO))])
async def emitir_nota(
    data: EmitirNotaRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    config = await _carregar_config(db, context.loja_id)
    if not config or not config.ativo:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Configure os dados fiscais e o certificado antes de emitir NF-e.")

    res = await db.execute(
        select(Contrato)
        .where(Contrato.id == data.contrato_id, Contrato.loja_id == context.loja_id)
        .options(selectinload(Contrato.veiculo), selectinload(Contrato.cliente))
    )
    contrato = res.scalar_one_or_none()
    if not contrato:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Contrato não encontrado.")
    if not contrato.valor_venda:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Contrato sem valor de venda definido.")

    existente = await db.execute(select(NotaFiscal).where(NotaFiscal.contrato_id == contrato.id))
    if existente.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Já existe uma NF-e emitida para este contrato.")

    res_loja = await db.execute(select(Loja).where(Loja.id == context.loja_id))
    loja = res_loja.scalar_one_or_none()

    ref = f"sv-{context.loja_id[:8]}-{contrato.id[:8]}"
    payload = fiscal_gateway.montar_payload_venda(config, loja, contrato.cliente, contrato.veiculo, contrato.valor_venda)

    try:
        resposta = await fiscal_gateway.emitir_nfe(config, ref, payload)
    except Exception as e:
        logger.error(f"[Fiscal] Falha ao emitir NF-e (contrato {contrato.id}): {e}")
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail="Falha ao comunicar com o gateway fiscal. Tente novamente.")

    numero = config.proximo_numero
    config.proximo_numero += 1

    nota = NotaFiscal(
        loja_id=context.loja_id,
        contrato_id=contrato.id,
        veiculo_id=contrato.veiculo_id,
        cliente_id=contrato.cliente_id,
        tipo="saida",
        ambiente=config.ambiente,
        serie=config.serie_nfe,
        numero=numero,
        focus_nfe_ref=ref,
        status=resposta.get("status", "processando"),
        valor_total=contrato.valor_venda,
    )
    db.add(nota)
    await db.commit()
    await db.refresh(nota)
    await registrar_auditoria(
        db, context.usuario.id, "nfe_emissao_solicitada",
        f"NF-e solicitada para contrato {contrato.numero} (ref {ref}).",
    )
    return nota


@router.get("/notas", response_model=list[NotaFiscalResponse],
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))])
async def listar_notas(
    status_filtro: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    stmt = select(NotaFiscal).where(NotaFiscal.loja_id == context.loja_id).order_by(NotaFiscal.created_at.desc())
    if status_filtro:
        stmt = stmt.where(NotaFiscal.status == status_filtro)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/notas/{nota_id}", response_model=NotaFiscalResponse,
            dependencies=[Depends(exige_permissao(Acao.VER, Recurso.FINANCEIRO))])
async def detalhe_nota(
    nota_id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    res = await db.execute(select(NotaFiscal).where(NotaFiscal.id == nota_id, NotaFiscal.loja_id == context.loja_id))
    nota = res.scalar_one_or_none()
    if not nota:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota fiscal não encontrada.")
    return nota


# ═══════════════════════════════════════════════════════════════
# WEBHOOK — autorização assíncrona do Focus NFe
# ═══════════════════════════════════════════════════════════════

@router.post("/webhook/focus", include_in_schema=False)
async def webhook_focus(
    payload: dict,
    segredo: Optional[str] = Query(None, alias="secret"),
    db: AsyncSession = Depends(get_db),
):
    """Callback do Focus NFe. Validado por segredo compartilhado configurado
    manualmente no painel do Focus (não é o token da empresa)."""
    if settings.focus_nfe_webhook_secret and segredo != settings.focus_nfe_webhook_secret:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Segredo de webhook inválido.")

    ref = payload.get("ref")
    if not ref:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Payload sem 'ref'.")

    res = await db.execute(select(NotaFiscal).where(NotaFiscal.focus_nfe_ref == ref))
    nota = res.scalar_one_or_none()
    if not nota:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Nota fiscal não encontrada para esta ref.")

    novo_status = payload.get("status")
    nota.status = {
        "autorizado": "autorizada",
        "erro_autorizacao": "rejeitada",
        "cancelado": "cancelada",
    }.get(novo_status, novo_status or nota.status)
    nota.impostos_json = json.dumps(payload.get("impostos") or {})
    nota.motivo_rejeicao = payload.get("mensagem_sefaz")

    if nota.status == "autorizada":
        nota.chave_acesso = payload.get("chave_nfe")
        nota.protocolo = payload.get("numero_protocolo")
        nota.emitida_em = datetime.now(timezone.utc)

        for campo_url, campo_destino in (("caminho_xml_nota_fiscal", "xml_url"), ("caminho_danfe", "danfe_pdf_url")):
            origem_url = payload.get(campo_url)
            if not origem_url:
                continue
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    r = await client.get(origem_url)
                    r.raise_for_status()
                    content_type = "application/xml" if campo_destino == "xml_url" else "application/pdf"
                    url_final = await storage_provider.upload_file(r.content, f"nfe-{nota.id}", content_type)
                    setattr(nota, campo_destino, url_final)
            except Exception as e:
                logger.error(f"[Fiscal] Falha ao baixar/subir {campo_destino} da nota {nota.id}: {e}")

        if nota.veiculo_id and nota.danfe_pdf_url:
            res_e = await db.execute(
                select(EsteiraPosVenda)
                .where(EsteiraPosVenda.contrato_id == nota.contrato_id)
                .options(selectinload(EsteiraPosVenda.itens))
            )
            esteira = res_e.scalar_one_or_none()
            if esteira:
                await anexar_documento_interno(
                    db, esteira, "nota_entregue", f"NF-e {nota.numero}", nota.danfe_pdf_url,
                )

    await db.commit()
    return {"ok": True}
