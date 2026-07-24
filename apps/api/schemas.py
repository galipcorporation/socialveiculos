"""
Social Veículos — Schemas Pydantic (Validação e Serialização)
Garante o não-vazamento de dados confidenciais para o feed B2C da Vitrine.
"""

import re
from datetime import datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict

from models import StatusVeiculo, OrigemVeiculo, TipoCambio, TipoCombustivel, TipoMidia, StatusAprovacao, TipoAcaoAprovacao, PapelUsuario, TipoLancamento, EtapaLead, OrigemLead, StatusAssinatura, StatusPagamento, StatusPropostaRepasse, TipoConversa, StatusNegociacaoConversa, BancoSimulador, StatusSimulacao, StatusResultadoBanco, TipoContrato, StatusContrato


# ── Validação e sanitização (CRM Clientes) ─────────────────────

UFS_VALIDAS = {
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SE", "SP", "TO",
}

# Caracteres de controle + zero-width (anti "prompt vírus" na 1ª barreira).
_RE_CONTROLE = re.compile(r"[\x00-\x1F\x7F-\x9F​-‍﻿]")
_RE_ESPACOS = re.compile(r"\s+")


def sanitizar_texto(val: Optional[str], max_len: int = 255) -> Optional[str]:
    """Remove controle/zero-width, colapsa espaços, trim e corta em max_len."""
    if val is None:
        return None
    limpo = _RE_CONTROLE.sub("", val)
    limpo = _RE_ESPACOS.sub(" ", limpo).strip()
    return limpo[:max_len] if limpo else None


def cpf_valido(val: str) -> bool:
    cpf = re.sub(r"\D", "", val or "")
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    for pos, peso in ((9, 10), (10, 11)):
        soma = sum(int(cpf[i]) * (peso - i) for i in range(pos))
        resto = (soma * 10) % 11
        dv = 0 if resto == 10 else resto
        if dv != int(cpf[pos]):
            return False
    return True


def cnpj_valido(val: str) -> bool:
    cnpj = re.sub(r"\D", "", val or "")
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    pesos_12 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos_13 = [6] + pesos_12
    for base_len, pesos in ((12, pesos_12), (13, pesos_13)):
        soma = sum(int(cnpj[i]) * pesos[i] for i in range(base_len))
        resto = soma % 11
        dv = 0 if resto < 2 else 11 - resto
        if dv != int(cnpj[base_len]):
            return False
    return True

# ── Midia ──────────────────────────────────────────────────────

class MidiaResponse(BaseModel):
    id: str
    tipo: TipoMidia
    url: str
    thumb_url: Optional[str] = None
    ordem: int

    model_config = ConfigDict(from_attributes=True)


# ── Veículo B2C (Vitrine Pública) ──────────────────────────────

class VeiculoB2CResponse(BaseModel):
    """Schema público da Vitrine. Exclui placa, preço de custo e margem."""
    id: str
    loja_id: str
    loja_slug: Optional[str] = None
    loja_nome: Optional[str] = None
    loja_logo: Optional[str] = None
    loja_cidade: Optional[str] = None
    loja_estado: Optional[str] = None
    loja_whatsapp: Optional[str] = None
    loja_verificada: bool = False
    loja_destaque: bool = False
    seguindo_loja: bool = False
    marca: str
    modelo: str
    versao: Optional[str] = None
    ano_fabricacao: int
    ano_modelo: int
    km: int
    cor: Optional[str] = None
    cambio: Optional[TipoCambio] = None
    combustivel: Optional[TipoCombustivel] = None
    tipo: Optional[str] = None
    carroceria: Optional[str] = None
    portas: Optional[int] = None
    preco_venda: Optional[float] = None
    descricao: Optional[str] = None
    opcionais: Optional[str] = None # JSON string
    midias: List[MidiaResponse] = []
    status: StatusVeiculo
    total_favoritos: int = 0
    favoritado_por_mim: bool = False

    model_config = ConfigDict(from_attributes=True)


class VeiculoResumo(BaseModel):
    id: str
    marca: Optional[str] = None
    modelo: Optional[str] = None
    ano_modelo: Optional[int] = None
    placa: Optional[str] = None
    foto: Optional[str] = None


# ── Veículo B2B (Gestor Privado) ──────────────────────────────

class VeiculoB2BResponse(BaseModel):
    """Schema privado do Gestor. Contém placa, preço de custo e margem."""
    id: str
    loja_id: str
    placa: Optional[str] = None
    marca: str
    modelo: str
    versao: Optional[str] = None
    ano_fabricacao: int
    ano_modelo: int
    km: int
    cor: Optional[str] = None
    cambio: Optional[TipoCambio] = None
    combustivel: Optional[TipoCombustivel] = None
    tipo: Optional[str] = None
    carroceria: Optional[str] = None
    portas: Optional[int] = None
    preco_venda: Optional[float] = None
    preco_custo: Optional[float] = None # 🔒 DADO EXCLUSIVO B2B
    status: StatusVeiculo
    publicado_marketplace: bool
    origem: OrigemVeiculo = OrigemVeiculo.COMPRA
    negociacao_origem_id: Optional[str] = None
    descricao: Optional[str] = None
    opcionais: Optional[str] = None
    fipe_marca_codigo: Optional[str] = None
    fipe_modelo_codigo: Optional[str] = None
    fipe_ano_codigo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    midias: List[MidiaResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ── Criação e Edição de Veículo ────────────────────────────────

class VeiculoCreateRequest(BaseModel):
    placa: Optional[str] = Field(None, max_length=10)
    marca: str = Field(..., min_length=1, max_length=100)
    modelo: str = Field(..., min_length=1, max_length=200)
    versao: Optional[str] = Field(None, max_length=200)
    ano_fabricacao: int
    ano_modelo: int
    km: int = Field(default=0, ge=0)
    cor: Optional[str] = Field(None, max_length=50)
    cambio: Optional[TipoCambio] = None
    combustivel: Optional[TipoCombustivel] = None
    tipo: Optional[str] = Field(None, max_length=50)
    carroceria: Optional[str] = Field(None, max_length=50)
    portas: Optional[int] = Field(None, ge=1, le=10)
    preco_venda: Optional[float] = Field(None, ge=0)
    preco_custo: Optional[float] = Field(None, ge=0)
    status: StatusVeiculo = StatusVeiculo.DISPONIVEL
    publicado_marketplace: bool = False
    descricao: Optional[str] = None
    opcionais: Optional[str] = None # JSON array string
    fipe_marca_codigo: Optional[str] = Field(None, max_length=20)
    fipe_modelo_codigo: Optional[str] = Field(None, max_length=20)
    fipe_ano_codigo: Optional[str] = Field(None, max_length=20)

    @model_validator(mode='before')
    @classmethod
    def fallback_ano(cls, data: dict) -> dict:
        if isinstance(data, dict):
            if "ano" in data:
                val = data["ano"]
                if "ano_fabricacao" not in data or data["ano_fabricacao"] is None:
                    data["ano_fabricacao"] = val
                if "ano_modelo" not in data or data["ano_modelo"] is None:
                    data["ano_modelo"] = val
        return data

    @field_validator("cambio", mode="before")
    @classmethod
    def validate_cambio(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v

    @field_validator("combustivel", mode="before")
    @classmethod
    def validate_combustivel(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


class VeiculoUpdateRequest(BaseModel):
    placa: Optional[str] = Field(None, max_length=10)
    marca: Optional[str] = Field(None, max_length=100)
    modelo: Optional[str] = Field(None, max_length=200)
    versao: Optional[str] = Field(None, max_length=200)
    ano_fabricacao: Optional[int] = None
    ano_modelo: Optional[int] = None
    km: Optional[int] = Field(None, ge=0)
    cor: Optional[str] = Field(None, max_length=50)
    cambio: Optional[TipoCambio] = None
    combustivel: Optional[TipoCombustivel] = None
    tipo: Optional[str] = Field(None, max_length=50)
    carroceria: Optional[str] = Field(None, max_length=50)
    portas: Optional[int] = Field(None, ge=1, le=10)
    preco_venda: Optional[float] = Field(None, ge=0)
    preco_custo: Optional[float] = Field(None, ge=0)
    status: Optional[StatusVeiculo] = None
    publicado_marketplace: Optional[bool] = None
    descricao: Optional[str] = None
    opcionais: Optional[str] = None
    fipe_marca_codigo: Optional[str] = Field(None, max_length=20)
    fipe_modelo_codigo: Optional[str] = Field(None, max_length=20)
    fipe_ano_codigo: Optional[str] = Field(None, max_length=20)
    motivo: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def fallback_ano(cls, data: dict) -> dict:
        if isinstance(data, dict):
            if "ano" in data:
                val = data["ano"]
                if "ano_fabricacao" not in data or data["ano_fabricacao"] is None:
                    data["ano_fabricacao"] = val
                if "ano_modelo" not in data or data["ano_modelo"] is None:
                    data["ano_modelo"] = val
        return data

    @field_validator("cambio", mode="before")
    @classmethod
    def validate_cambio(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v

    @field_validator("combustivel", mode="before")
    @classmethod
    def validate_combustivel(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v


# ── Troca / Rolo: veículo recebido como parte de pagamento ─────

class TrocaEntradaRequest(BaseModel):
    """
    Registra um veículo recebido em troca: cria o veículo no estoque com
    custo = valor de avaliação e origem=troca, vinculado à negociação de origem.
    """
    marca: str = Field(..., min_length=1, max_length=100)
    modelo: str = Field(..., min_length=1, max_length=200)
    versao: Optional[str] = Field(None, max_length=200)
    ano_fabricacao: int
    ano_modelo: int
    placa: Optional[str] = Field(None, max_length=10)
    km: int = Field(default=0, ge=0)
    cor: Optional[str] = Field(None, max_length=50)
    valor_avaliacao: float = Field(..., gt=0)  # vira preco_custo e abate no negócio
    negociacao_origem_id: Optional[str] = Field(None, max_length=36)


# ── Troca Rápida de Status ─────────────────────────────────────

class StatusChangeRequest(BaseModel):
    status: StatusVeiculo


# ── Toggle Publicar na Vitrine ─────────────────────────────────

class PublicarToggleRequest(BaseModel):
    publicado: bool


# ── Resposta Paginada de Veículos ──────────────────────────────

class VeiculoListResponse(BaseModel):
    items: List[VeiculoB2BResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ── Consulta de Placa ──────────────────────────────────────────

class ConsultaPlacaResponse(BaseModel):
    placa: str
    encontrado: bool = False
    marca: Optional[str] = None
    modelo: Optional[str] = None
    ano_fabricacao: Optional[int] = None
    ano_modelo: Optional[int] = None
    cor: Optional[str] = None
    combustivel: Optional[str] = None
    mensagem: Optional[str] = None


# ── Fila de Aprovações ─────────────────────────────────────────

class UsuarioSimples(BaseModel):
    id: str
    nome: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class SolicitacaoAprovacaoResponse(BaseModel):
    id: str
    loja_id: str
    requisitante_id: str
    requisitante: UsuarioSimples
    tipo_acao: TipoAcaoAprovacao
    entidade_id: str
    dados_novos: Optional[str] = None
    status: StatusAprovacao
    justificativa_rejeicao: Optional[str] = None
    motivo: Optional[str] = None
    veiculo_marca: Optional[str] = None
    veiculo_modelo: Optional[str] = None
    veiculo_placa: Optional[str] = None
    veiculo_ano: Optional[int] = None
    veiculo_cor: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProcessaSolicitacaoRequest(BaseModel):
    status: StatusAprovacao # APROVADO ou REJEITADO
    justificativa_rejeicao: Optional[str] = Field(None, max_length=500)


# ── Lojas (B2B Tenants) ────────────────────────────────────────

class LojaResponse(BaseModel):
    id: str
    nome: str
    slug: str
    cnpj: Optional[str] = None
    telefone: Optional[str] = None
    whatsapp: Optional[str] = None
    whatsapp_pareado: Optional[str] = None
    whatsapp_divergente: Optional[bool] = False
    email: Optional[str] = None
    endereco: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    cep: Optional[str] = None
    logo_url: Optional[str] = None
    contrato_cabecalho: Optional[str] = None
    contrato_rodape: Optional[str] = None
    contrato_marca_dagua_url: Optional[str] = None
    contrato_marca_dagua_ativa: bool = False
    percentual_comissao_padrao: float = 0.0
    verificada: bool
    ativa: bool
    destaque: bool = False
    destaque_ate: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Auditoria ──────────────────────────────────────────────────

class LogAuditoriaResponse(BaseModel):
    id: str
    loja_id: Optional[str] = None
    ator_id: Optional[str] = None
    ator_nome: Optional[str] = None
    acao: str
    entidade: Optional[str] = None
    entidade_id: Optional[str] = None
    detalhes: Optional[str] = None
    ip: Optional[str] = None
    visivel: bool = True
    ajusteia: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Clientes (CRM) ─────────────────────────────────────────────

class ClienteResponse(BaseModel):
    """Schema de cliente pessoa física do CRM (escopado por loja)."""
    id: str
    loja_id: str
    usuario_id: Optional[str] = None
    nome: str
    cpf: Optional[str] = None
    cnpj: Optional[str] = None
    rg: Optional[str] = None
    data_nascimento: Optional[datetime] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    renda_mensal: Optional[float] = None
    cep: Optional[str] = None
    endereco: Optional[str] = None
    numero: Optional[str] = None
    bairro: Optional[str] = None
    cidade: Optional[str] = None
    estado: Optional[str] = None
    observacoes: Optional[str] = None
    tags: Optional[str] = None  # JSON array string
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class _ClienteValidatorsMixin(BaseModel):
    """Validação/sanitização compartilhada (server-side) de clientes do CRM."""

    @field_validator("cpf", check_fields=False)
    @classmethod
    def _v_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v and not cpf_valido(v):
            raise ValueError("CPF inválido (dígito verificador).")
        return v

    @field_validator("cnpj", check_fields=False)
    @classmethod
    def _v_cnpj(cls, v: Optional[str]) -> Optional[str]:
        if v and not cnpj_valido(v):
            raise ValueError("CNPJ inválido (dígito verificador).")
        return v

    @field_validator("estado", check_fields=False)
    @classmethod
    def _v_estado(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        uf = v.strip().upper()
        if uf not in UFS_VALIDAS:
            raise ValueError("UF do estado inválida.")
        return uf

    @field_validator("endereco", "numero", "bairro", "cidade", "observacoes", check_fields=False)
    @classmethod
    def _v_texto(cls, v: Optional[str]) -> Optional[str]:
        return sanitizar_texto(v, 255)

    @field_validator("nome", check_fields=False)
    @classmethod
    def _v_nome(cls, v: Optional[str]) -> Optional[str]:
        # Mantém obrigatoriedade: nome em branco após sanitizar é rejeitado.
        if v is None:
            return v
        limpo = sanitizar_texto(v, 255)
        if not limpo:
            raise ValueError("O nome é obrigatório.")
        return limpo


class ClienteCreateRequest(_ClienteValidatorsMixin):
    nome: str = Field(..., min_length=1, max_length=255)
    cpf: Optional[str] = Field(None, min_length=11, max_length=11, pattern=r"^\d{11}$")
    cnpj: Optional[str] = Field(None, min_length=14, max_length=14, pattern=r"^\d{14}$")
    rg: Optional[str] = Field(None, max_length=14, pattern=r"^[A-Za-z0-9]+$")
    data_nascimento: Optional[datetime] = None
    telefone: Optional[str] = Field(None, min_length=10, max_length=11, pattern=r"^\d{10,11}$")
    email: Optional[str] = Field(None, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    renda_mensal: Optional[float] = Field(None, ge=0)
    cep: Optional[str] = Field(None, min_length=8, max_length=8, pattern=r"^\d{8}$")
    endereco: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=10)
    bairro: Optional[str] = Field(None, max_length=255)
    cidade: Optional[str] = Field(None, max_length=255)
    estado: Optional[str] = Field(None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    observacoes: Optional[str] = Field(None, max_length=255)
    tags: Optional[str] = None


class ClienteUpdateRequest(_ClienteValidatorsMixin):
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    cpf: Optional[str] = Field(None, min_length=11, max_length=11, pattern=r"^\d{11}$")
    cnpj: Optional[str] = Field(None, min_length=14, max_length=14, pattern=r"^\d{14}$")
    rg: Optional[str] = Field(None, max_length=14, pattern=r"^[A-Za-z0-9]+$")
    data_nascimento: Optional[datetime] = None
    telefone: Optional[str] = Field(None, min_length=10, max_length=11, pattern=r"^\d{10,11}$")
    email: Optional[str] = Field(None, max_length=255, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    renda_mensal: Optional[float] = Field(None, ge=0)
    cep: Optional[str] = Field(None, min_length=8, max_length=8, pattern=r"^\d{8}$")
    endereco: Optional[str] = Field(None, max_length=255)
    numero: Optional[str] = Field(None, max_length=10)
    bairro: Optional[str] = Field(None, max_length=255)
    cidade: Optional[str] = Field(None, max_length=255)
    estado: Optional[str] = Field(None, min_length=2, max_length=2, pattern=r"^[A-Za-z]{2}$")
    observacoes: Optional[str] = Field(None, max_length=255)
    tags: Optional[str] = None


# ── CRM Leads & Negociações ────────────────────────────────────

class ClienteSimples(BaseModel):
    """Resumo do cliente embutido no card de lead (Kanban)."""
    id: str
    nome: str
    telefone: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class NegociacaoResponse(BaseModel):
    id: str
    lead_id: str
    veiculo_id: Optional[str] = None
    valor_proposta: Optional[float] = None
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NegociacaoCreateRequest(BaseModel):
    veiculo_id: Optional[str] = Field(None, max_length=36)
    valor_proposta: Optional[float] = Field(None, ge=0)
    valor_entrada: Optional[float] = Field(None, ge=0)
    parcelas: Optional[int] = Field(None, ge=1, le=120)
    observacoes: Optional[str] = None


class LeadResponse(BaseModel):
    id: str
    loja_id: str
    cliente_id: str
    veiculo_id: Optional[str] = None
    etapa: EtapaLead
    origem: OrigemLead
    valor_proposta: Optional[float] = None
    observacoes: Optional[str] = None
    cliente: Optional[ClienteSimples] = None
    negociacoes: List[NegociacaoResponse] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LeadCreateRequest(BaseModel):
    cliente_id: str = Field(..., max_length=36)
    veiculo_id: Optional[str] = Field(None, max_length=36)
    etapa: EtapaLead = EtapaLead.LEAD
    origem: OrigemLead = OrigemLead.MANUAL
    valor_proposta: Optional[float] = Field(None, ge=0)
    observacoes: Optional[str] = None


class LeadUpdateRequest(BaseModel):
    veiculo_id: Optional[str] = Field(None, max_length=36)
    origem: Optional[OrigemLead] = None
    valor_proposta: Optional[float] = Field(None, ge=0)
    observacoes: Optional[str] = None


class LeadMoverEtapaRequest(BaseModel):
    etapa: EtapaLead


class KanbanColunaResponse(BaseModel):
    """Uma coluna do quadro Kanban: a etapa e os leads nela."""
    etapa: EtapaLead
    total: int
    leads: List[LeadResponse] = []


class KanbanBoardResponse(BaseModel):
    colunas: List[KanbanColunaResponse] = []


# ── Assinaturas, Planos e Módulos Premium ──────────────────────

class PlanoResponse(BaseModel):
    id: str
    nome: str
    descricao: Optional[str] = None
    preco_mensal: float
    modulos_incluidos: Optional[str] = None  # JSON array string
    ativo: bool

    model_config = ConfigDict(from_attributes=True)


class AssinaturaResponse(BaseModel):
    id: str
    loja_id: str
    plano_id: str
    status: StatusAssinatura
    inicio: datetime
    fim: Optional[datetime] = None
    valor_mensal: Optional[float] = None
    proximo_vencimento: Optional[datetime] = None
    contrato_aceito_em: Optional[datetime] = None
    contrato_versao: Optional[str] = None
    observacoes: Optional[str] = None
    criado_por_admin: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PagamentoResponse(BaseModel):
    id: str
    assinatura_id: str
    valor: float
    status: StatusPagamento
    referencia: Optional[str] = None
    metodo: Optional[str] = None
    data_pagamento: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ModuloHabilitadoResponse(BaseModel):
    id: str
    loja_id: str
    nome_modulo: str
    ativo: bool

    model_config = ConfigDict(from_attributes=True)


class AssinarPlanoRequest(BaseModel):
    plano_id: str = Field(..., max_length=36)


class MinhaAssinaturaResponse(BaseModel):
    """Visão consolidada da loja: assinatura atual + módulos disponíveis."""
    assinatura: Optional[AssinaturaResponse] = None
    plano: Optional[PlanoResponse] = None
    em_dia: bool
    modulos_ativos: List[str] = []  # módulos liberados agora (contratado + em dia)


# ── Financeiro (Lançamentos & Comissões) ───────────────────────

class LancamentoResponse(BaseModel):
    id: str
    loja_id: str
    tipo: TipoLancamento
    descricao: str
    valor: float
    data: datetime
    veiculo_id: Optional[str] = None
    veiculo_nome: Optional[str] = None
    categoria: Optional[str] = None
    observacoes: Optional[str] = None
    status_pagamento: str
    created_at: datetime
    deletado_em: Optional[datetime] = None
    deletado_por_nome: Optional[str] = None
    motivo_exclusao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class LancamentoExcluirRequest(BaseModel):
    motivo: str = Field(..., min_length=3, max_length=500)


class LancamentoCreateRequest(BaseModel):
    tipo: TipoLancamento
    descricao: str = Field(..., min_length=1, max_length=300)
    valor: float = Field(..., gt=0)
    data: Optional[datetime] = None
    veiculo_id: Optional[str] = Field(None, max_length=36)
    observacoes: Optional[str] = None
    status_pagamento: Optional[str] = Field("pago")


class LancamentoUpdateRequest(BaseModel):
    tipo: Optional[TipoLancamento] = None
    descricao: Optional[str] = Field(None, min_length=1, max_length=300)
    valor: Optional[float] = Field(None, gt=0)
    data: Optional[datetime] = None
    veiculo_id: Optional[str] = Field(None, max_length=36)
    observacoes: Optional[str] = None
    status_pagamento: Optional[str] = None


class CustoVeiculoCreateRequest(BaseModel):
    """Custo de preparação de um veículo: vira despesa no financeiro e soma ao preço de custo."""
    descricao: str = Field(..., min_length=1, max_length=300)
    valor: float = Field(..., gt=0)
    categoria: Optional[str] = Field(None, max_length=50)
    observacoes: Optional[str] = None


class CustosVeiculoResponse(BaseModel):
    """Custos (despesas) de preparação atrelados a um veículo + totais consolidados."""
    veiculo_id: str
    preco_compra: float          # preço de custo base = custo total − preparação
    total_preparacao: float      # soma das despesas de preparação lançadas
    custo_total: float           # preco_custo atual do veículo (compra + preparação)
    custos: List[LancamentoResponse] = []


class ComissaoResponse(BaseModel):
    id: str
    loja_id: str
    vendedor_id: Optional[str] = None
    veiculo_id: Optional[str] = None
    esteira_id: Optional[str] = None
    valor_venda: float
    percentual: float
    valor_comissao: float
    pago: bool
    created_at: datetime

    # Dados expandidos (preenchidos na rota) — "o que é de quem"
    vendedor_nome: Optional[str] = None
    veiculo_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MinhaVendaResponse(BaseModel):
    """Venda do próprio vendedor (rota /me/vendas — escopo de linha, TDD 2026-07-02)."""
    esteira_id: str
    veiculo_id: Optional[str] = None
    veiculo_nome: Optional[str] = None
    valor_venda: Optional[float] = None
    comissao_valor: Optional[float] = None
    comissao_percentual: Optional[float] = None
    comissao_paga: Optional[bool] = None
    estagio: str
    aberta_em: datetime

    model_config = ConfigDict(from_attributes=True)


class ComissaoCreateRequest(BaseModel):
    vendedor_id: Optional[str] = Field(None, max_length=36)
    veiculo_id: Optional[str] = Field(None, max_length=36)
    valor_venda: float = Field(..., gt=0)
    percentual: float = Field(..., ge=0, le=100)


class FinanceiroResumoResponse(BaseModel):
    """Resumo financeiro do período: receitas − despesas = saldo."""
    receitas: float
    despesas: float
    comissoes: float
    saldo: float  # receitas − despesas (comissões já entram como despesa quando lançadas)
    custo_estoque: float  # soma do preco_custo dos veículos em estoque ativo
    comissoes_pendentes: float  # comissões ainda não pagas


# ── Dashboard & Métricas ───────────────────────────────────────

class DashboardKpisResponse(BaseModel):
    """KPIs reais da loja. Zeros quando a loja ainda não tem dados (estado vazio).

    Escopo por papel (TDD 2026-07-02): para VENDEDOR, `receita_mes` vem None
    (dado global sensível) e os campos `minhas_*` vêm preenchidos com os números
    pessoais. Para gestor/admin, comportamento original inalterado.
    """
    escopo: str = "loja"                 # "loja" (gestor/admin) | "vendedor"
    estoque_ativo: int                   # veículos disponíveis
    leads_ativos: int                    # leads fora de fechamento/perdido
    vendas_mes: int                      # vendedor: SÓ as vendas dele no mês
    receita_mes: Optional[float] = None  # None para vendedor (não vaza receita global)
    veiculos_publicados: int             # publicados na vitrine
    # Campos pessoais (só quando escopo == "vendedor")
    minhas_comissoes_pendentes: Optional[float] = None
    minhas_comissoes_pagas_mes: Optional[float] = None


class RankingVeiculoResponse(BaseModel):
    veiculo_id: str
    marca: str
    modelo: str
    leads: int


class MetricasResponse(BaseModel):
    """Métricas agregadas para gráficos do Gestor."""
    estoque_por_status: dict[str, int]
    leads_por_etapa: dict[str, int]
    ranking_veiculos: List[RankingVeiculoResponse] = []
    resumo_financeiro: FinanceiroResumoResponse


class ModuloStatusResponse(BaseModel):
    """Status de um módulo para montar paywall na UI."""
    modulo: str
    contratado: bool
    liberado: bool  # contratado E assinatura em dia
    cta_upgrade: Optional[str] = None  # link/ação de upgrade quando bloqueado


class SSOExchangeResponse(BaseModel):
    """Token de troca curto + URL do módulo de destino."""
    exchange_token: str
    modulo: str
    expira_em_segundos: int = 60


# ── Webhook de Pagamento (Gateway) ─────────────────────────────

class WebhookPagamentoRequest(BaseModel):
    """Payload normalizado do gateway (ex: Stripe/Pagar.me)."""
    referencia: str = Field(..., max_length=200)  # ID do evento/cobrança no gateway (idempotência)
    assinatura_id: str = Field(..., max_length=36)
    status: StatusPagamento
    valor: float = Field(..., ge=0)


# ── Admin — ativação manual de assinatura (Pix) ─────────────────

class AdminAtivarAssinaturaRequest(BaseModel):
    plano_id: str = Field(..., max_length=36)
    valor_mensal: float = Field(..., ge=0)
    meses: int = Field(default=1, ge=1, le=12)
    forma_pagamento: str = Field(default="pix_manual", max_length=30)
    referencia_pagamento: Optional[str] = Field(default=None, max_length=200)
    contrato_aceito: bool
    contrato_versao: str = Field(..., max_length=20)
    observacoes: Optional[str] = None


class AdminRenovarAssinaturaRequest(BaseModel):
    plano_id: Optional[str] = Field(default=None, max_length=36)
    valor_mensal: Optional[float] = Field(default=None, ge=0)
    meses: int = Field(default=1, ge=1, le=12)
    forma_pagamento: str = Field(default="pix_manual", max_length=30)
    referencia_pagamento: Optional[str] = Field(default=None, max_length=200)
    observacoes: Optional[str] = None


class AdminSuspenderAssinaturaRequest(BaseModel):
    motivo: Optional[str] = None


# ── Admin — catálogo de planos (CRUD) ────────────────────────────

class AdminCriarPlanoRequest(BaseModel):
    nome: str = Field(..., max_length=100)
    descricao: Optional[str] = None
    preco_mensal: float = Field(..., ge=0)
    modulos_incluidos: List[str] = []
    ativo: bool = True


class AdminEditarPlanoRequest(BaseModel):
    nome: Optional[str] = Field(default=None, max_length=100)
    descricao: Optional[str] = None
    preco_mensal: Optional[float] = Field(default=None, ge=0)
    modulos_incluidos: Optional[List[str]] = None
    ativo: Optional[bool] = None


class AdminAssinaturaDetalheResponse(BaseModel):
    assinatura: Optional[AssinaturaResponse] = None
    plano: Optional[PlanoResponse] = None
    pagamentos: List[PagamentoResponse] = []
    dias_para_vencer: Optional[int] = None


# ── Admin — destaque pago (patrocínio na vitrine) ────────────────

class DestaquePagamentoResponse(BaseModel):
    id: str
    loja_id: str
    valor: float
    meses: int
    status: StatusPagamento
    referencia: Optional[str] = None
    metodo: Optional[str] = None
    data_pagamento: Optional[datetime] = None
    destaque_ate_resultante: Optional[datetime] = None
    observacoes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminAtivarDestaqueRequest(BaseModel):
    valor: float = Field(..., ge=0)
    meses: int = Field(default=1, ge=1, le=12)
    forma_pagamento: str = Field(default="pix_manual", max_length=30)
    referencia_pagamento: Optional[str] = Field(default=None, max_length=200)
    observacoes: Optional[str] = None


class AdminDesativarDestaqueRequest(BaseModel):
    motivo: Optional[str] = None


class AdminDestaqueDetalheResponse(BaseModel):
    destaque: bool
    destaque_ate: Optional[datetime] = None
    dias_para_vencer: Optional[int] = None
    pagamentos: List[DestaquePagamentoResponse] = []


class ContratoVersaoResponse(BaseModel):
    id: str
    versao: str
    conteudo_html: str
    vigente: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ContratoVersaoCreateRequest(BaseModel):
    versao: str = Field(..., max_length=20)
    conteudo_html: str = Field(..., min_length=1)
    tornar_vigente: bool = True


class AdminVencimentoItem(BaseModel):
    loja_id: str
    loja_nome: str
    assinatura_id: str
    plano_nome: str
    status: StatusAssinatura
    valor_mensal: Optional[float] = None
    proximo_vencimento: Optional[datetime] = None
    dias_para_vencer: Optional[int] = None


# ── Admin — usuários e reset de senha ────────────────────────────

class AdminUsuarioItem(BaseModel):
    id: str
    nome: str
    email: str
    papel: str
    ativo: bool
    lojas: List[str] = []


class AdminResetSenhaRequest(BaseModel):
    nova_senha: str = Field(..., min_length=6, max_length=128)


# ── B2B Social & Feed ──────────────────────────────────────────

class ComentarioB2BResponse(BaseModel):
    id: str
    publicacao_id: str
    autor_id: Optional[str] = None
    autor_nome: Optional[str] = None
    conteudo: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CurtidaB2BResponse(BaseModel):
    id: str
    publicacao_id: str
    usuario_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublicacaoB2BResponse(BaseModel):
    id: str
    loja_id: str
    loja_nome: Optional[str] = None
    veiculo_id: Optional[str] = None
    veiculo: Optional[VeiculoB2BResponse] = None
    autor_id: Optional[str] = None
    autor_nome: Optional[str] = None
    conteudo: Optional[str] = None
    valor_repasse: Optional[float] = None
    ativa: bool
    created_at: datetime
    updated_at: datetime
    comentarios: List[ComentarioB2BResponse] = []
    curtidas: List[CurtidaB2BResponse] = []
    curtido_por_mim: bool = False

    model_config = ConfigDict(from_attributes=True)


class ComentarioB2BCreateRequest(BaseModel):
    conteudo: str = Field(..., min_length=1)


# ── Proposta de Repasse B2B ────────────────────────────────────

class PropostaRepasseResponse(BaseModel):
    id: str
    loja_proponente_id: str
    loja_proponente_nome: Optional[str] = None
    loja_destino_id: str
    loja_destino_nome: Optional[str] = None
    veiculo_id: str
    veiculo: Optional[VeiculoB2BResponse] = None
    valor_proposta: float
    status: StatusPropostaRepasse
    observacoes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PropostaRepasseCreateRequest(BaseModel):
    veiculo_id: str = Field(..., max_length=36)
    valor_proposta: float = Field(..., gt=0)
    observacoes: Optional[str] = None


class PropostaRepasseStatusRequest(BaseModel):
    status: StatusPropostaRepasse


# ── Chat B2B ───────────────────────────────────────────────────

class ConversaB2BResponse(BaseModel):
    id: str
    tipo: TipoConversa
    loja_a_id: Optional[str] = None
    loja_a_nome: Optional[str] = None
    loja_b_id: Optional[str] = None
    loja_b_nome: Optional[str] = None
    ativa: bool
    created_at: datetime
    updated_at: datetime
    ultima_mensagem: Optional[str] = None
    ultima_mensagem_data: Optional[datetime] = None
    mensagens_nao_lidas: int = 0

    # Contexto de negociação (M081): veículo/status vêm da proposta vinculada
    # quando existir; senão, status_negociacao reflete o status_manual da conversa.
    proposta_id: Optional[str] = None
    veiculo: Optional[VeiculoResumo] = None
    # String livre (não enum único): carrega o value de StatusPropostaRepasse
    # quando há proposta_id, ou de StatusNegociacaoConversa quando é manual.
    status_negociacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ConversaStatusManualRequest(BaseModel):
    status_manual: Optional[StatusNegociacaoConversa] = None


class MensagemB2BResponse(BaseModel):
    id: str
    conversa_id: str
    autor_id: Optional[str] = None
    autor_nome: Optional[str] = None
    minha: bool
    conteudo: str
    lida: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MensagemB2BCreateRequest(BaseModel):
    conteudo: str = Field(..., min_length=1)


# ── Equipe (Membros da Loja) ───────────────────────────────────

class MembroEquipeResponse(BaseModel):
    """Membro da equipe da loja: vínculo MembroLoja + dados do usuário."""
    id: str                     # id do vínculo MembroLoja
    usuario_id: str
    nome: str
    email: str
    telefone: Optional[str] = None
    avatar_url: Optional[str] = None
    papel: PapelUsuario         # papel dentro da loja
    modulos: Optional[str] = None  # JSON array de módulos liberados ao vendedor
    percentual_comissao: Optional[float] = None  # override; None = usa o padrão da loja
    ativo: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConvidarMembroRequest(BaseModel):
    """Convida/cria um membro na equipe. Se o e-mail já existir, reaproveita o usuário."""
    nome: str = Field(..., min_length=1, max_length=200)
    email: str = Field(..., min_length=3, max_length=200)
    telefone: Optional[str] = Field(None, max_length=20)
    papel: PapelUsuario = PapelUsuario.VENDEDOR
    senha: str = Field(..., min_length=6, max_length=100)
    modulos: Optional[str] = None  # JSON array string


class AtualizarMembroRequest(BaseModel):
    papel: Optional[PapelUsuario] = None
    modulos: Optional[str] = None
    ativo: Optional[bool] = None
    percentual_comissao: Optional[float] = Field(None, ge=0, le=100)  # override do % da loja


# ── Configurações da Loja (Perfil) ─────────────────────────────

class LojaUpdateRequest(BaseModel):
    """Edição do perfil/configurações da própria loja (Gestor)."""
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    cnpj: Optional[str] = Field(None, max_length=18)
    logo_url: Optional[str] = Field(None, max_length=500)
    telefone: Optional[str] = Field(None, max_length=20)
    whatsapp: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    endereco: Optional[str] = Field(None, max_length=300)
    cidade: Optional[str] = Field(None, max_length=100)
    estado: Optional[str] = Field(None, max_length=2)
    cep: Optional[str] = Field(None, max_length=10)
    # Identidade nos contratos (HTML rico do editor); marca-d'água opcional
    contrato_cabecalho: Optional[str] = None
    contrato_rodape: Optional[str] = None
    contrato_marca_dagua_url: Optional[str] = Field(None, max_length=500)
    contrato_marca_dagua_ativa: Optional[bool] = None
    # % de comissão padrão da loja (0-100); override individual em MembroLoja
    percentual_comissao_padrao: Optional[float] = Field(None, ge=0, le=100)


# ── Chat B2C & Favoritos ────────────────────────────────────────

class FavoritoRequest(BaseModel):
    veiculo_id: str


class FavoritoResponse(BaseModel):
    id: str
    usuario_id: str
    veiculo_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversaB2CResponse(BaseModel):
    id: str
    tipo: TipoConversa
    loja_id: Optional[str] = None
    loja_nome: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_nome: Optional[str] = None
    veiculo_id: Optional[str] = None
    veiculo_modelo: Optional[str] = None
    veiculo_marca: Optional[str] = None
    ativa: bool
    created_at: datetime
    updated_at: datetime
    ultima_mensagem: Optional[str] = None
    ultima_mensagem_data: Optional[datetime] = None
    mensagens_nao_lidas: int = 0

    model_config = ConfigDict(from_attributes=True)


class MensagemB2CResponse(BaseModel):
    id: str
    conversa_id: str
    autor_id: Optional[str] = None
    autor_nome: Optional[str] = None
    autor_tipo: Literal["loja", "cliente"]
    conteudo: str
    lida: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConversaB2CCreateRequest(BaseModel):
    veiculo_id: str
    loja_id: str
    mensagem: str = Field(..., min_length=1)


# ── Simulador de Crédito ───────────────────────────────────────

class SimuladorBancoCredencialRequest(BaseModel):
    """Credenciais de um banco enviadas pelo gestor ou vendedor (cifradas no servidor)."""
    banco: BancoSimulador
    usuario: str = Field(..., min_length=1, description="Usuário/login no banco")
    senha: str = Field(..., min_length=1, description="Senha no banco")
    escopo: str = Field("loja", description='"loja" (gestor, grava usuario_id=NULL) ou "vendedor" (pessoal)')


class SimuladorBancoCredencialResponse(BaseModel):
    """Banco configurado. Nunca devolve credenciais em texto puro."""
    id: str
    loja_id: str
    usuario_id: Optional[str]
    banco: BancoSimulador
    escopo: str  # "loja" | "vendedor"
    usuario_configurado: Optional[str]  # usuário mascarado (ex: "ab***yz")
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SimuladorTestarConexaoRequest(BaseModel):
    """Testa login real no site do banco antes de salvar a credencial."""
    banco: BancoSimulador
    usuario: str = Field(..., min_length=1)
    senha: str = Field(..., min_length=1)


class SimuladorTestarConexaoResponse(BaseModel):
    valido: bool
    mensagem: str


class SimulacaoRequest(BaseModel):
    """Disparo de simulação. Veículo/cliente vêm do estoque/CRM ou inline."""
    bancos: List[str] = Field(..., min_length=1)
    entrada: float = 0.0
    prazo_desejado: Optional[int] = None
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    lead_id: Optional[str] = None
    veiculo_dados: Optional[dict] = None
    cliente_dados: Optional[dict] = None


class SimulacaoResultadoResponse(BaseModel):
    id: str
    banco: BancoSimulador
    status: StatusResultadoBanco
    parcela: Optional[float] = None
    taxa: Optional[float] = None
    total: Optional[float] = None
    prazo: Optional[int] = None
    erro: Optional[str] = None
    tempo_ms: int = 0

    model_config = ConfigDict(from_attributes=True)


class SimulacaoResponse(BaseModel):
    id: str
    loja_id: str
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    entrada: float
    prazo_desejado: Optional[int] = None
    status: StatusSimulacao
    created_at: datetime
    resultados: List[SimulacaoResultadoResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════
# CONTRATOS
# ═══════════════════════════════════════════════════════════════

class CampoExtraTemplate(BaseModel):
    chave: str = Field(..., min_length=1, max_length=60)
    label: str = Field(..., min_length=1, max_length=120)


class TemplateContratoCreateRequest(BaseModel):
    nome: str = Field(..., min_length=1, max_length=200)
    conteudo_html: str = Field(..., min_length=1)
    campos_extras: Optional[List[CampoExtraTemplate]] = None
    usar_identidade_loja: bool = True


class TemplateContratoUpdateRequest(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    conteudo_html: Optional[str] = None
    campos_extras: Optional[List[CampoExtraTemplate]] = None
    usar_identidade_loja: Optional[bool] = None
    ativo: Optional[bool] = None


class TemplateContratoResponse(BaseModel):
    id: str
    loja_id: str
    nome: str
    conteudo_html: str
    campos_extras: List[CampoExtraTemplate] = []
    usar_identidade_loja: bool = True
    ativo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateContratoListResponse(BaseModel):
    items: List[TemplateContratoResponse]


class ContratoCreateRequest(BaseModel):
    tipo: TipoContrato = TipoContrato.COMPRA_VENDA
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    valor_venda: Optional[float] = None
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    dados_ocr: Optional[str] = None
    template_id: Optional[str] = None
    dados_extras: Optional[dict] = None


class ContratoUpdateRequest(BaseModel):
    tipo: Optional[TipoContrato] = None
    status: Optional[StatusContrato] = None
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    valor_venda: Optional[float] = None
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    dados_ocr: Optional[str] = None


class ContratoResponse(BaseModel):
    id: str
    loja_id: str
    veiculo_id: Optional[str] = None
    cliente_id: Optional[str] = None
    tipo: TipoContrato
    status: StatusContrato
    numero: str
    valor_venda: Optional[float] = None
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    dados_ocr: Optional[str] = None
    template_id: Optional[str] = None
    dados_extras: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    # Dados expandidos (preenchidos na rota)
    veiculo_nome: Optional[str] = None
    cliente_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ContratoListResponse(BaseModel):
    items: List[ContratoResponse]
    total: int
    page: int
    per_page: int
    pages: int


class ClienteNovoInline(BaseModel):
    """Cadastro rápido de cliente no ato da venda — a ficha completa fica pra depois."""
    nome: str = Field(..., min_length=1, max_length=200)
    cpf: Optional[str] = Field(None, max_length=14)
    telefone: Optional[str] = Field(None, max_length=20)


class TrocaVendaInline(BaseModel):
    """Veículo recebido como parte do pagamento — entra no estoque como rascunho."""
    marca: str = Field(..., min_length=1, max_length=100)
    modelo: str = Field(..., min_length=1, max_length=200)
    versao: Optional[str] = Field(None, max_length=200)
    ano_fabricacao: Optional[int] = None
    ano_modelo: Optional[int] = None
    placa: Optional[str] = Field(None, max_length=10)
    km: int = Field(default=0, ge=0)
    cor: Optional[str] = Field(None, max_length=50)
    valor_avaliacao: float = Field(..., gt=0)  # vira preco_custo e compõe o pagamento


class FinanciamentoInline(BaseModel):
    valor: float = Field(..., gt=0)
    parcelas: Optional[int] = Field(None, ge=1, le=120)


class OutroPagamentoInline(BaseModel):
    """Forma de pagamento livre (carta de crédito, consórcio, cheque, etc.)."""
    descricao: str = Field(..., min_length=1, max_length=120)
    valor: float = Field(..., gt=0)


class VenderVeiculoRequest(BaseModel):
    # Cliente: existente (cliente_id) OU cadastrado na hora (cliente_novo)
    cliente_id: Optional[str] = None
    cliente_novo: Optional[ClienteNovoInline] = None
    valor_venda: Optional[float] = None
    # Pagamento composto
    pagamento_dinheiro: Optional[float] = None
    financiamento: Optional[FinanciamentoInline] = None
    outros: List[OutroPagamentoInline] = []
    trocas: List[TrocaVendaInline] = []
    # Campos legados (mantidos por compatibilidade)
    valor_entrada: Optional[float] = None
    parcelas: Optional[int] = None
    observacoes: Optional[str] = None
    origem: Optional[str] = None       # manual | vitrine | whatsapp | simulador | repasse
    financiado: Optional[bool] = False
    lead_id: Optional[str] = None
    template_id: Optional[str] = None


class VenderVeiculoResponse(BaseModel):
    message: str
    contrato_id: str
    veiculo_id: str
    esteira_id: Optional[str] = None
    trocas_veiculo_ids: List[str] = []
    comissao_excedente: Optional[float] = None
    lead_id: Optional[str] = None


# ═══════════════════════════════════════════════════════════════
# PRECIFICAÇÃO FIPE
# ═══════════════════════════════════════════════════════════════

class PrecificacaoResponse(BaseModel):
    fipe: Optional[float] = None
    preco_venda: Optional[float] = None
    margem_sobre_fipe: Optional[float] = None
    dias_no_estoque: int = 0
    alerta_encalhe: bool = False
    fipe_disponivel: bool = False


# CONSULTA FIPE AVULSA (M016)
# ═══════════════════════════════════════════════════════════════

class FipeConsultaRequest(BaseModel):
    marca_codigo: str
    modelo_codigo: str
    ano_codigo: str
    tipo: str = "carro"


class FipeConsultaResponse(BaseModel):
    fipe: Optional[float] = None
    fipe_disponivel: bool = False


# CARTEIRA DO PROPRIETÁRIO — DOCUMENTOS (M018)
# ═══════════════════════════════════════════════════════════════

class VeiculoDocumentoCreate(BaseModel):
    tipo: str
    nome: str
    url: str
    visivel_comprador: bool = True


class VeiculoDocumentoResponse(BaseModel):
    id: str
    tipo: str
    nome: str
    url: str
    visivel_comprador: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VincularCompradorRequest(BaseModel):
    comprador_id: str


class VeiculoCompradorResponse(BaseModel):
    veiculo_id: str
    comprador_id: Optional[str] = None
    comprador_nome: Optional[str] = None
    comprador_telefone: Optional[str] = None
    documentos: list[VeiculoDocumentoResponse] = []


# VITRINE — MEUS VEÍCULOS (M018)
# ═══════════════════════════════════════════════════════════════

class MeuVeiculoResponse(BaseModel):
    veiculo_id: str
    marca: str
    modelo: str
    ano_fabricacao: int
    ano_modelo: int
    placa: Optional[str] = None
    cor: Optional[str] = None
    km: Optional[int] = None
    foto_url: Optional[str] = None
    loja_nome: str
    documentos: list[VeiculoDocumentoResponse] = []
    valor_fipe_atual: Optional[float] = None


# ── Notificações (M025) ──────────────────────────────────────────

class NotificacaoResponse(BaseModel):
    id: str
    loja_id: str
    usuario_id: Optional[str] = None
    titulo: str
    conteudo: str
    tipo: str
    lida: bool
    link: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════
# ESTEIRA PÓS-VENDA (ESTEIRA-POS-VENDA.md §6.5)
# ═══════════════════════════════════════════════════════════════

from models import (  # noqa: E402
    EstagioPosVenda,
    StatusItemChecklist,
    CategoriaItem,
    ResponsavelItem,
)


class ItemChecklistResponse(BaseModel):
    id: str
    chave: str
    titulo: str
    categoria: CategoriaItem
    responsavel: ResponsavelItem
    status: StatusItemChecklist
    obrigatorio: bool
    prazo_em: Optional[datetime] = None
    doc_id: Optional[str] = None
    observacao: Optional[str] = None
    concluido_em: Optional[datetime] = None
    vencido: bool = False   # calculado no router

    model_config = ConfigDict(from_attributes=True)



class CompradorResumo(BaseModel):
    id: str
    nome: Optional[str] = None
    telefone: Optional[str] = None


class EsteiraResumoResponse(BaseModel):
    """Card do board (§7 Tela 1)."""
    id: str
    estagio: EstagioPosVenda
    origem: Optional[OrigemLead] = None
    veiculo: Optional[VeiculoResumo] = None
    comprador: Optional[CompradorResumo] = None
    proximo_item: Optional[str] = None       # título do próximo pendente
    prazo_mais_proximo: Optional[datetime] = None
    tem_vencido: bool = False
    total_itens: int = 0
    concluidos: int = 0
    aberta_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EsteiraDetalheResponse(BaseModel):
    """Detalhe do negócio (§7 Tela 2)."""
    id: str
    estagio: EstagioPosVenda
    origem: Optional[OrigemLead] = None
    veiculo: Optional[VeiculoResumo] = None
    comprador: Optional[CompradorResumo] = None
    contrato_id: Optional[str] = None
    vendedor_id: Optional[str] = None
    vendedor_nome: Optional[str] = None
    valor_venda: Optional[float] = None
    comissao_valor: Optional[float] = None
    comissao_percentual: Optional[float] = None
    comissao_id: Optional[str] = None
    comissao_paga: Optional[bool] = None
    comunicacao_venda_em: Optional[datetime] = None
    transferencia_em: Optional[datetime] = None
    aberta_em: Optional[datetime] = None
    concluida_em: Optional[datetime] = None
    itens: List[ItemChecklistResponse] = []
    total_itens: int = 0
    concluidos: int = 0
    vencidos: int = 0

    model_config = ConfigDict(from_attributes=True)


class ItemChecklistUpdate(BaseModel):
    status: Optional[StatusItemChecklist] = None
    observacao: Optional[str] = None
    prazo_em: Optional[datetime] = None
    doc_id: Optional[str] = None
    # Valor do lançamento financeiro gerado ao concluir um item financeiro
    # (débitos, taxa de transferência, entrada). Sem ele o lançamento fica R$ 0.
    valor: Optional[float] = None


class TransferenciaUpdate(BaseModel):
    comunicacao_venda_em: Optional[datetime] = None
    transferencia_em: Optional[datetime] = None


class ItemChecklistCreate(BaseModel):
    titulo: str
    categoria: CategoriaItem
    responsavel: Optional[ResponsavelItem] = ResponsavelItem.LOJA
    obrigatorio: Optional[bool] = False
    prazo_em: Optional[datetime] = None


class EsteiraDashboardResponse(BaseModel):
    """Resumo p/ os nudges do Dashboard e indicadores (§7, §10)."""
    total_ativas: int = 0
    por_estagio: dict = {}                    # {"contrato": 2, "pagamento": 1, ...}
    transferencias_vencendo_7d: int = 0
    comunicacao_venda_vencida: int = 0
    itens_vencidos: int = 0
    vendidos_travados_30d: int = 0            # esteiras abertas há +30d ainda não concluídas

