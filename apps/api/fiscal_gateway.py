"""
Gateway fiscal (Focus NFe) para emissão de NF-e de venda (M039, Fase 1).

A plataforma mantém uma conta mestre no Focus NFe; cada loja é cadastrada
como uma "empresa" própria (endpoint /v2/empresas), recebendo um token
individual — isolamento por loja mesmo com custo centralizado na plataforma
(decisão de produto: custo absorvido pela plataforma).

Emissão é assíncrona: a chamada de emissão só confirma recebimento; a
autorização real chega depois via webhook (`routers/fiscal.py`).
"""
from __future__ import annotations

import logging

import httpx

from config import settings
from models import ConfiguracaoFiscal
from simulador.crypt import decrypt_credentials

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(30.0)

_BASE_URLS = {
    "homologacao": "https://homologacao.focusnfe.com.br",
    "producao": "https://api.focusnfe.com.br",
}


def _base_url(ambiente: str) -> str:
    return _BASE_URLS.get(ambiente, _BASE_URLS["homologacao"])


async def cadastrar_empresa(config: ConfiguracaoFiscal, loja) -> str:
    """Cadastra (ou atualiza) a loja como empresa no Focus NFe e retorna o token dela.
    Usa o token da conta mestre (FOCUS_NFE_MASTER_TOKEN) apenas para esta chamada."""
    if not settings.focus_nfe_master_token:
        raise RuntimeError("FOCUS_NFE_MASTER_TOKEN não configurado na plataforma.")

    payload = {
        "nome": loja.nome,
        "nome_fantasia": loja.nome,
        "cnpj": loja.cnpj,
        "inscricao_estadual": config.inscricao_estadual,
        "regime_tributario": config.regime_tributario,
        "habilita_nfe": True,
    }
    url = f"{_base_url(config.ambiente)}/v2/empresas"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(url, auth=(settings.focus_nfe_master_token, ""), json=payload)
        r.raise_for_status()
        data = r.json()
        return data["token_producao"] if config.ambiente == "producao" else data["token_homologacao"]


async def enviar_certificado(config: ConfiguracaoFiscal, pfx_bytes: bytes, senha: str) -> None:
    """Envia o certificado A1 (.pfx) para a empresa já cadastrada no Focus NFe
    (identificada pelo próprio token da empresa, já decifrado)."""
    token = decrypt_credentials(config.focus_nfe_token_cifrado)
    url = f"{_base_url(config.ambiente)}/v2/empresas"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.put(
            url,
            auth=(token, ""),
            data={"senha_certificado": senha},
            files={"arquivo_certificado": ("certificado.pfx", pfx_bytes)},
        )
        r.raise_for_status()


async def emitir_nfe(config: ConfiguracaoFiscal, ref: str, payload: dict) -> dict:
    """Envia a NF-e para emissão. Retorna o dict de resposta imediata do Focus
    (status inicial `processando_autorizacao`); a autorização real chega via webhook."""
    token = decrypt_credentials(config.focus_nfe_token_cifrado)
    url = f"{_base_url(config.ambiente)}/v2/nfe?ref={ref}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(url, auth=(token, ""), json=payload)
        r.raise_for_status()
        return r.json()


async def consultar_nfe(config: ConfiguracaoFiscal, ref: str) -> dict:
    token = decrypt_credentials(config.focus_nfe_token_cifrado)
    url = f"{_base_url(config.ambiente)}/v2/nfe/{ref}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.get(url, auth=(token, ""))
        r.raise_for_status()
        return r.json()


async def cancelar_nfe(config: ConfiguracaoFiscal, ref: str, justificativa: str) -> dict:
    """Solicita o cancelamento da NF-e (prazo SEFAZ típico: 24h após autorização).
    Assíncrono como a emissão — o status final chega pelo mesmo webhook."""
    token = decrypt_credentials(config.focus_nfe_token_cifrado)
    url = f"{_base_url(config.ambiente)}/v2/nfe/{ref}"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.request("DELETE", url, auth=(token, ""), json={"justificativa": justificativa})
        r.raise_for_status()
        return r.json()


async def emitir_carta_correcao(config: ConfiguracaoFiscal, ref: str, correcao: str) -> dict:
    """Emite Carta de Correção (CC-e) para corrigir dado não-essencial de uma
    NF-e já autorizada (não pode alterar valores, impostos, partes ou datas)."""
    token = decrypt_credentials(config.focus_nfe_token_cifrado)
    url = f"{_base_url(config.ambiente)}/v2/nfe/{ref}/carta_correcao"
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        r = await client.post(url, auth=(token, ""), json={"correcao": correcao})
        r.raise_for_status()
        return r.json()


def montar_payload_venda(config: ConfiguracaoFiscal, loja, cliente, veiculo, valor_total: float) -> dict:
    """Monta o payload mínimo de uma NF-e de venda de veículo usado a partir
    da configuração fiscal da loja + dados da venda."""
    return {
        "natureza_operacao": config.natureza_operacao,
        "data_emissao": None,  # Focus usa now() se omitido
        "tipo_documento": 1,   # saída
        "finalidade_emissao": 1,  # normal
        "cnpj_emitente": loja.cnpj,
        "nome_destinatario": getattr(cliente, "nome", None),
        "cpf_destinatario": getattr(cliente, "cpf", None),
        "items": [
            {
                "numero_item": 1,
                "codigo_produto": getattr(veiculo, "id", "veiculo"),
                "descricao": f"{getattr(veiculo, 'marca', '')} {getattr(veiculo, 'modelo', '')} {getattr(veiculo, 'ano_modelo', '')}".strip(),
                "cfop": config.cfop_venda,
                "ncm": config.ncm_padrao,
                "unidade_comercial": "UN",
                "quantidade_comercial": 1,
                "valor_unitario_comercial": valor_total,
                "valor_bruto": valor_total,
                "icms_origem": config.origem_mercadoria,
                "icms_situacao_tributaria": config.csosn or config.cst,
            }
        ],
    }
