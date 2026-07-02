"""
Social Veículos — Modelos SQLAlchemy
Todas as entidades do domínio (social.md §7).

Organização:
  - Tenancy & Auth: Loja, Usuario, MembroLoja, Sessao
  - Estoque: Veiculo, Midia
  - CRM: ClientePF, Lead, Negociacao
  - Social: Favorito, PublicacaoB2B, Comentario, Curtida
  - Chat: Conversa, Mensagem
  - Financeiro: LancamentoFinanceiro, Comissao
  - Assinaturas: Plano, Assinatura, Pagamento, ModuloHabilitado
  - Auditoria: LogAuditoria
"""

import enum
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from database import Base


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def _uuid() -> str:
    return str(uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════
# ENUMS
# ═══════════════════════════════════════════════════════════════

class PapelUsuario(str, enum.Enum):
    ADMIN_PLATAFORMA = "admin_plataforma"
    GESTOR = "gestor"
    VENDEDOR = "vendedor"
    CLIENTE = "cliente"


class StatusVeiculo(str, enum.Enum):
    RASCUNHO = "rascunho"
    DISPONIVEL = "disponivel"
    RESERVADO = "reservado"
    VENDIDO = "vendido"
    REPASSE = "repasse"
    INATIVO = "inativo"


class OrigemVeiculo(str, enum.Enum):
    """Como o veículo entrou no estoque."""
    COMPRA = "compra"   # aquisição normal
    TROCA = "troca"     # recebido como troca/rolo em um negócio


class TipoMidia(str, enum.Enum):
    FOTO = "foto"
    VIDEO = "video"


class EtapaLead(str, enum.Enum):
    LEAD = "lead"
    PROPOSTA = "proposta"
    NEGOCIACAO = "negociacao"
    FECHAMENTO = "fechamento"
    PERDIDO = "perdido"


class OrigemLead(str, enum.Enum):
    VITRINE = "vitrine"
    MANUAL = "manual"
    SIMULADOR = "simulador"
    WHATSAPP = "whatsapp"
    REPASSE = "repasse"   # venda B2B para outra loja (via PropostaRepasse)


# ── Esteira pós-venda (ESTEIRA-POS-VENDA.md §6.1) ──

class EstagioPosVenda(str, enum.Enum):
    CONTRATO = "contrato"
    PAGAMENTO = "pagamento"
    DOCUMENTOS = "documentos"
    TRANSFERENCIA = "transferencia"
    CONCLUIDO = "concluido"


class StatusItemChecklist(str, enum.Enum):
    PENDENTE = "pendente"
    EM_ANDAMENTO = "em_andamento"
    CONCLUIDO = "concluido"
    NAO_APLICAVEL = "nao_aplicavel"


class CategoriaItem(str, enum.Enum):
    CONTRATO = "contrato"
    FINANCEIRO = "financeiro"
    DOCUMENTO = "documento"
    TRANSFERENCIA = "transferencia"


class ResponsavelItem(str, enum.Enum):
    LOJA = "loja"
    COMPRADOR = "comprador"


class TipoConversa(str, enum.Enum):
    B2C = "b2c"  # cliente ↔ loja
    B2B = "b2b"  # loja ↔ loja


class TipoLancamento(str, enum.Enum):
    RECEITA = "receita"
    DESPESA = "despesa"
    COMISSAO = "comissao"


class StatusAssinatura(str, enum.Enum):
    ATIVA = "ativa"
    CANCELADA = "cancelada"
    SUSPENSA = "suspensa"
    EXPIRADA = "expirada"


class StatusPagamento(str, enum.Enum):
    PENDENTE = "pendente"
    PAGO = "pago"
    FALHOU = "falhou"
    ESTORNADO = "estornado"


class TipoCambio(str, enum.Enum):
    MANUAL = "manual"
    AUTOMATICO = "automatico"
    CVT = "cvt"
    AUTOMATIZADO = "automatizado"


class TipoCombustivel(str, enum.Enum):
    GASOLINA = "gasolina"
    ETANOL = "etanol"
    FLEX = "flex"
    DIESEL = "diesel"
    ELETRICO = "eletrico"
    HIBRIDO = "hibrido"
    GNV = "gnv"


class BancoSimulador(str, enum.Enum):
    BV = "bv"
    C6 = "c6"
    ITAU = "itau"
    SANTANDER = "santander"


class StatusSimulacao(str, enum.Enum):
    PENDENTE = "pendente"
    CONCLUIDA = "concluida"
    ERRO = "erro"


class StatusResultadoBanco(str, enum.Enum):
    APROVADO = "aprovado"
    NEGADO = "negado"
    ERRO = "erro"
    MOCK = "mock"
    BROWSER = "browser"


class TomAssistente(str, enum.Enum):
    FORMAL = "formal"
    AMIGAVEL = "amigavel"
    DIRETO = "direto"
    CONSULTIVO = "consultivo"
    DESCONTRAIDO = "descontraido"


class AutonomiaAssistente(str, enum.Enum):
    COPILOTO = "copiloto"
    AUTOMATICO = "automatico"


class TipoContrato(str, enum.Enum):
    COMPRA_VENDA = "compra_venda"
    CONSIGNACAO = "consignacao"
    GARANTIA = "garantia"


class StatusContrato(str, enum.Enum):
    RASCUNHO = "rascunho"
    AGUARDANDO = "aguardando"
    ASSINADO = "assinado"
    CANCELADO = "cancelado"


class TipoDocumentoVeiculo(str, enum.Enum):
    CONTRATO = "contrato"
    NOTA_FISCAL = "nota_fiscal"
    GARANTIA = "garantia"
    LAUDO = "laudo"
    OUTRO = "outro"


# ═══════════════════════════════════════════════════════════════
# 2.2 — TENANCY & USUÁRIOS
# ═══════════════════════════════════════════════════════════════

class Loja(Base):
    """Tenant principal. Cada loja é um ambiente isolado."""
    __tablename__ = "loja"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False)
    cnpj = Column(String(18), unique=True, nullable=True)
    logo_url = Column(String(500), nullable=True)
    telefone = Column(String(20), nullable=True)
    whatsapp = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    endereco = Column(String(300), nullable=True)
    cidade = Column(String(100), nullable=True)
    estado = Column(String(2), nullable=True)
    cep = Column(String(10), nullable=True)
    # Comissão: % padrão aplicado às vendas da loja (override por membro em MembroLoja)
    percentual_comissao_padrao = Column(Float, nullable=False, default=0.0, server_default="0")
    verificada = Column(Boolean, default=False)
    ativa = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    membros = relationship("MembroLoja", back_populates="loja", cascade="all, delete-orphan")
    veiculos = relationship("Veiculo", back_populates="loja", cascade="all, delete-orphan")
    clientes = relationship("ClientePF", back_populates="loja", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="loja", cascade="all, delete-orphan")
    contratos = relationship("Contrato", back_populates="loja", cascade="all, delete-orphan")


class Usuario(Base):
    """Usuário do sistema — pode ser gestor, vendedor, cliente ou admin."""
    __tablename__ = "usuario"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(200), nullable=False)
    email = Column(String(200), unique=True, nullable=False)
    telefone = Column(String(20), nullable=True)
    senha_hash = Column(String(300), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    papel = Column(Enum(PapelUsuario), nullable=False, default=PapelUsuario.CLIENTE)
    ativo = Column(Boolean, default=True)

    # MFA (estrutura, ativável depois — Tarefa 03 §3.6)
    mfa_secret = Column(String(100), nullable=True)
    mfa_ativo = Column(Boolean, default=False)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    membros = relationship("MembroLoja", back_populates="usuario", cascade="all, delete-orphan")
    sessoes = relationship("Sessao", back_populates="usuario", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_usuario_email", "email"),
    )


class MembroLoja(Base):
    """Vínculo usuario ↔ loja ↔ papel. Multi-tenant."""
    __tablename__ = "membro_loja"

    id = Column(String(36), primary_key=True, default=_uuid)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    papel = Column(Enum(PapelUsuario), nullable=False)
    modulos = Column(Text, nullable=True)  # JSON array de módulos habilitados para vendedor
    # Comissão: % individual do membro; NULL = usa Loja.percentual_comissao_padrao
    percentual_comissao = Column(Float, nullable=True)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    # Relationships
    usuario = relationship("Usuario", back_populates="membros")
    loja = relationship("Loja", back_populates="membros")

    __table_args__ = (
        UniqueConstraint("usuario_id", "loja_id", name="uq_membro_usuario_loja"),
        Index("ix_membro_loja_id", "loja_id"),
    )


class Sessao(Base):
    """Sessão de autenticação — JWT refresh token revogável."""
    __tablename__ = "sessao"

    id = Column(String(36), primary_key=True, default=_uuid)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    refresh_token = Column(String(500), unique=True, nullable=False)
    ip = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    revogada = Column(Boolean, default=False)
    expira_em = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=_now)

    # Relationships
    usuario = relationship("Usuario", back_populates="sessoes")

    __table_args__ = (
        Index("ix_sessao_usuario", "usuario_id"),
        Index("ix_sessao_refresh", "refresh_token"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.4 — ESTOQUE
# ═══════════════════════════════════════════════════════════════

class Veiculo(Base):
    """Veículo no estoque de uma loja."""
    __tablename__ = "veiculo"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)

    # Identificação
    placa = Column(String(10), nullable=True)
    marca = Column(String(100), nullable=False)
    modelo = Column(String(200), nullable=False)
    versao = Column(String(200), nullable=True)
    ano_fabricacao = Column(Integer, nullable=False)
    ano_modelo = Column(Integer, nullable=False)

    # Características
    km = Column(Integer, default=0)
    cor = Column(String(50), nullable=True)
    cambio = Column(Enum(TipoCambio), nullable=True)
    combustivel = Column(Enum(TipoCombustivel), nullable=True)
    tipo = Column(String(50), nullable=True)  # carro, moto, caminhao, etc.
    carroceria = Column(String(50), nullable=True)  # sedan, suv, hatch, pickup, etc.
    portas = Column(Integer, nullable=True)

    # Preços
    preco_venda = Column(Float, nullable=True)
    preco_custo = Column(Float, nullable=True)  # ⚠️ NUNCA expor no B2C!

    # Status e publicação
    status = Column(Enum(StatusVeiculo), default=StatusVeiculo.DISPONIVEL, nullable=False)
    publicado_marketplace = Column(Boolean, default=False)

    # Origem / rastreamento (troca/rolo)
    origem = Column(Enum(OrigemVeiculo), default=OrigemVeiculo.COMPRA, nullable=False)
    negociacao_origem_id = Column(String(36), ForeignKey("negociacao.id", ondelete="SET NULL"), nullable=True)
    contrato_origem_id = Column(String(36), ForeignKey("contrato.id", ondelete="SET NULL"), nullable=True)  # venda que originou a troca

    # Descrição
    descricao = Column(Text, nullable=True)
    opcionais = Column(Text, nullable=True)  # JSON array

    # Rede Social
    publicar_rede_social = Column(Boolean, default=False)
    visivel_publico_em = Column(DateTime, nullable=True)  # None = já público; futuro = exclusivo B2B até lá
    valor_repasse = Column(Float, nullable=True)  # preço B2B — nunca expor no B2C

    # Códigos FIPE (M016) — gravados ao cadastrar via catálogo; usados na precificação automática
    fipe_marca_codigo = Column(String(20), nullable=True)
    fipe_modelo_codigo = Column(String(20), nullable=True)
    fipe_ano_codigo = Column(String(20), nullable=True)  # ex: "2020-1" (gasolina/diesel/flex)

    # Carteira do Proprietário (M018) — preenchido pelo vendedor ao confirmar venda pela plataforma
    comprador_id = Column(String(36), ForeignKey("cliente_pf.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja", back_populates="veiculos")
    midias = relationship("Midia", back_populates="veiculo", cascade="all, delete-orphan", order_by="Midia.ordem")
    favoritos = relationship("Favorito", back_populates="veiculo", cascade="all, delete-orphan")
    comprador = relationship("ClientePF", foreign_keys=[comprador_id])
    documentos = relationship("VeiculoDocumento", back_populates="veiculo", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_veiculo_loja", "loja_id"),
        Index("ix_veiculo_placa", "placa"),
        Index("ix_veiculo_marketplace", "publicado_marketplace"),
        Index("ix_veiculo_status", "status"),
        Index("ix_veiculo_marca_modelo", "marca", "modelo"),
        Index("ix_veiculo_comprador", "comprador_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.5 — MÍDIA (unificada: foto + vídeo)
# ═══════════════════════════════════════════════════════════════

class Midia(Base):
    """Mídia de um veículo — foto ou vídeo, nunca separados."""
    __tablename__ = "midia"

    id = Column(String(36), primary_key=True, default=_uuid)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(Enum(TipoMidia), nullable=False)
    url = Column(String(500), nullable=False)
    ordem = Column(Integer, default=0)
    created_at = Column(DateTime, default=_now)

    veiculo = relationship("Veiculo", back_populates="midias")

    __table_args__ = (
        Index("ix_midia_veiculo", "veiculo_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.6 — CLIENTES E CRM
# ═══════════════════════════════════════════════════════════════

class ClientePF(Base):
    """Cliente pessoa física — cadastrado pela loja ou auto-cadastro na Vitrine."""
    __tablename__ = "cliente_pf"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    nome = Column(String(200), nullable=False)
    cpf = Column(String(14), nullable=True)
    cnpj = Column(String(18), nullable=True)
    rg = Column(String(20), nullable=True)
    data_nascimento = Column(DateTime, nullable=True)
    telefone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    renda_mensal = Column(Float, nullable=True)

    # Endereço
    cep = Column(String(10), nullable=True)
    endereco = Column(String(300), nullable=True)
    numero = Column(String(20), nullable=True)
    bairro = Column(String(100), nullable=True)
    cidade = Column(String(100), nullable=True)
    estado = Column(String(2), nullable=True)

    observacoes = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)  # JSON array

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja", back_populates="clientes")
    leads = relationship("Lead", back_populates="cliente", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_cliente_loja", "loja_id"),
        Index("ix_cliente_cpf", "cpf"),
        Index("ix_cliente_telefone", "telefone"),
    )


class Lead(Base):
    """Lead / potencial comprador no funil do CRM."""
    __tablename__ = "lead"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    cliente_id = Column(String(36), ForeignKey("cliente_pf.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)

    etapa = Column(Enum(EtapaLead), default=EtapaLead.LEAD, nullable=False)
    origem = Column(Enum(OrigemLead), default=OrigemLead.MANUAL, nullable=False)

    valor_proposta = Column(Float, nullable=True)
    observacoes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja", back_populates="leads")
    cliente = relationship("ClientePF", back_populates="leads")
    negociacoes = relationship("Negociacao", back_populates="lead", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_lead_loja", "loja_id"),
        Index("ix_lead_etapa", "etapa"),
        Index("ix_lead_cliente", "cliente_id"),
    )


class Negociacao(Base):
    """Negociação — vincula lead + veículo + proposta."""
    __tablename__ = "negociacao"

    id = Column(String(36), primary_key=True, default=_uuid)
    lead_id = Column(String(36), ForeignKey("lead.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)

    valor_proposta = Column(Float, nullable=True)
    valor_entrada = Column(Float, nullable=True)
    parcelas = Column(Integer, nullable=True)
    observacoes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    lead = relationship("Lead", back_populates="negociacoes")

    __table_args__ = (
        Index("ix_negociacao_lead", "lead_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.7 — VITRINE SOCIAL
# ═══════════════════════════════════════════════════════════════

class Favorito(Base):
    """Favorito do cliente na Vitrine B2C (com contador derivável)."""
    __tablename__ = "favorito"

    id = Column(String(36), primary_key=True, default=_uuid)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=_now)

    veiculo = relationship("Veiculo", back_populates="favoritos")

    __table_args__ = (
        UniqueConstraint("usuario_id", "veiculo_id", name="uq_favorito_usuario_veiculo"),
        Index("ix_favorito_veiculo", "veiculo_id"),
        Index("ix_favorito_usuario", "usuario_id"),
    )


class PublicacaoB2B(Base):
    """Publicação no feed B2B entre lojas (repasses)."""
    __tablename__ = "publicacao_b2b"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    autor_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    conteudo = Column(Text, nullable=True)
    valor_repasse = Column(Float, nullable=True)
    ativa = Column(Boolean, default=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    comentarios = relationship("Comentario", back_populates="publicacao", cascade="all, delete-orphan")
    curtidas = relationship("Curtida", back_populates="publicacao", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_pub_b2b_loja", "loja_id"),
    )


class Comentario(Base):
    """Comentário em publicação B2B."""
    __tablename__ = "comentario"

    id = Column(String(36), primary_key=True, default=_uuid)
    publicacao_id = Column(String(36), ForeignKey("publicacao_b2b.id", ondelete="CASCADE"), nullable=False)
    autor_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)
    conteudo = Column(Text, nullable=False)
    created_at = Column(DateTime, default=_now)

    publicacao = relationship("PublicacaoB2B", back_populates="comentarios")

    __table_args__ = (
        Index("ix_comentario_pub", "publicacao_id"),
    )


class Curtida(Base):
    """Curtida em publicação B2B."""
    __tablename__ = "curtida"

    id = Column(String(36), primary_key=True, default=_uuid)
    publicacao_id = Column(String(36), ForeignKey("publicacao_b2b.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=_now)

    publicacao = relationship("PublicacaoB2B", back_populates="curtidas")

    __table_args__ = (
        UniqueConstraint("publicacao_id", "usuario_id", name="uq_curtida_pub_usuario"),
        Index("ix_curtida_pub", "publicacao_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.8 — CHAT
# ═══════════════════════════════════════════════════════════════

class Conversa(Base):
    """Conversa — B2C (cliente↔loja) ou B2B (loja↔loja)."""
    __tablename__ = "conversa"

    id = Column(String(36), primary_key=True, default=_uuid)
    tipo = Column(Enum(TipoConversa), nullable=False)

    # B2C: loja + cliente + veículo de contexto
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=True)
    cliente_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)

    # B2B: loja_a ↔ loja_b
    loja_a_id = Column(String(36), ForeignKey("loja.id", ondelete="SET NULL"), nullable=True)
    loja_b_id = Column(String(36), ForeignKey("loja.id", ondelete="SET NULL"), nullable=True)

    ativa = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    mensagens = relationship("Mensagem", back_populates="conversa", cascade="all, delete-orphan", order_by="Mensagem.created_at")

    __table_args__ = (
        Index("ix_conversa_loja", "loja_id"),
        Index("ix_conversa_cliente", "cliente_id"),
    )


class Mensagem(Base):
    """Mensagem dentro de uma conversa."""
    __tablename__ = "mensagem"

    id = Column(String(36), primary_key=True, default=_uuid)
    conversa_id = Column(String(36), ForeignKey("conversa.id", ondelete="CASCADE"), nullable=False)
    autor_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    conteudo = Column(Text, nullable=False)
    lida = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    conversa = relationship("Conversa", back_populates="mensagens")

    __table_args__ = (
        Index("ix_mensagem_conversa", "conversa_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.9 — FINANCEIRO
# ═══════════════════════════════════════════════════════════════

class LancamentoFinanceiro(Base):
    """Lançamento financeiro — receita, despesa ou comissão."""
    __tablename__ = "lancamento_financeiro"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    tipo = Column(Enum(TipoLancamento), nullable=False)
    descricao = Column(String(300), nullable=False)
    valor = Column(Float, nullable=False)
    data = Column(DateTime, nullable=False, default=_now)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    categoria = Column(String(50), nullable=True)  # mecanica, pintura, pneus, higienizacao, documentacao, outro
    observacoes = Column(Text, nullable=True)
    status_pagamento = Column(Enum(StatusPagamento), nullable=False, default=StatusPagamento.PAGO)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_lancamento_loja", "loja_id"),
        Index("ix_lancamento_data", "data"),
    )


class ComissaoVenda(Base):
    """Comissão de vendedor sobre uma venda."""
    __tablename__ = "comissao"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    vendedor_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    # Venda formal que originou a comissão (NULL = comissão manual avulsa)
    esteira_id = Column(String(36), ForeignKey("esteira_pos_venda.id", ondelete="SET NULL"), nullable=True)
    valor_venda = Column(Float, nullable=False)
    percentual = Column(Float, nullable=False)
    valor_comissao = Column(Float, nullable=False)
    pago = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_comissao_loja", "loja_id"),
        Index("ix_comissao_vendedor", "vendedor_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.10 — ASSINATURAS
# ═══════════════════════════════════════════════════════════════

class Plano(Base):
    """Plano de assinatura do SaaS."""
    __tablename__ = "plano"

    id = Column(String(36), primary_key=True, default=_uuid)
    nome = Column(String(100), nullable=False)
    descricao = Column(Text, nullable=True)
    preco_mensal = Column(Float, nullable=False)
    modulos_incluidos = Column(Text, nullable=True)  # JSON array
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)


class Assinatura(Base):
    """Assinatura de uma loja em um plano."""
    __tablename__ = "assinatura"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    plano_id = Column(String(36), ForeignKey("plano.id", ondelete="RESTRICT"), nullable=False)
    status = Column(Enum(StatusAssinatura), default=StatusAssinatura.ATIVA, nullable=False)
    inicio = Column(DateTime, nullable=False, default=_now)
    fim = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_assinatura_loja", "loja_id"),
    )


class Pagamento(Base):
    """Registro de pagamento de assinatura."""
    __tablename__ = "pagamento"

    id = Column(String(36), primary_key=True, default=_uuid)
    assinatura_id = Column(String(36), ForeignKey("assinatura.id", ondelete="CASCADE"), nullable=False)
    valor = Column(Float, nullable=False)
    status = Column(Enum(StatusPagamento), default=StatusPagamento.PENDENTE, nullable=False)
    referencia = Column(String(200), nullable=True)  # ID externo do gateway
    data_pagamento = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_pagamento_assinatura", "assinatura_id"),
    )


class ModuloHabilitado(Base):
    """Módulo premium habilitado para uma loja."""
    __tablename__ = "modulo_habilitado"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    nome_modulo = Column(String(50), nullable=False)  # contratos, simulador, marketing
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        UniqueConstraint("loja_id", "nome_modulo", name="uq_modulo_loja"),
        Index("ix_modulo_loja", "loja_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 2.11 — AUDITORIA (append-only)
# ═══════════════════════════════════════════════════════════════

class LogAuditoria(Base):
    """Log de auditoria — append-only, nunca deletar."""
    __tablename__ = "log_auditoria"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), nullable=True)  # Sem FK para não travar deletes
    ator_id = Column(String(36), nullable=True)
    ator_nome = Column(String(200), nullable=True)
    acao = Column(String(100), nullable=False)  # ex: "veiculo.criar", "lead.mover_etapa"
    entidade = Column(String(100), nullable=True)  # ex: "veiculo", "lead"
    entidade_id = Column(String(36), nullable=True)
    detalhes = Column(Text, nullable=True)  # JSON com dados extras
    ip = Column(String(45), nullable=True)
    visivel = Column(Boolean, default=True, nullable=False)
    ajusteia = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_audit_loja", "loja_id"),
        Index("ix_audit_ator", "ator_id"),
        Index("ix_audit_acao", "acao"),
        Index("ix_audit_data", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════
# 4.1 — FILA DE APROVAÇÕES
# ═══════════════════════════════════════════════════════════════

class StatusAprovacao(str, enum.Enum):
    PENDENTE = "pendente"
    APROVADO = "aprovado"
    REJEITADO = "rejeitado"


class TipoAcaoAprovacao(str, enum.Enum):
    EXCLUIR_VEICULO = "excluir_veiculo"
    ALTERAR_PRECO = "alterar_preco"


class SolicitacaoAprovacao(Base):
    """Solicitações de ações restritas (ex: excluir veículo, alterar preço) enviadas para aprovação do gestor."""
    __tablename__ = "solicitacao_aprovacao"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    requisitante_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    
    tipo_acao = Column(Enum(TipoAcaoAprovacao), nullable=False)
    entidade_id = Column(String(36), nullable=False)  # ID do veículo
    
    dados_novos = Column(Text, nullable=True)  # JSON com dados propostos
    status = Column(Enum(StatusAprovacao), default=StatusAprovacao.PENDENTE, nullable=False)
    justificativa_rejeicao = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja")
    requisitante = relationship("Usuario")

    __table_args__ = (
        Index("ix_solicitacao_loja", "loja_id"),
        Index("ix_solicitacao_status", "status"),
    )


class StatusPropostaRepasse(str, enum.Enum):
    PENDENTE = "pendente"
    ACEITA = "aceita"
    REJEITADA = "rejeitada"
    CANCELADA = "cancelada"


class PropostaRepasse(Base):
    """Proposta de repasse direto entre lojas vinculada a um veículo."""
    __tablename__ = "proposta_repasse"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_proponente_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    loja_destino_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="CASCADE"), nullable=False)
    valor_proposta = Column(Float, nullable=False)
    status = Column(Enum(StatusPropostaRepasse), default=StatusPropostaRepasse.PENDENTE, nullable=False)
    observacoes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja_proponente = relationship("Loja", foreign_keys=[loja_proponente_id])
    loja_destino = relationship("Loja", foreign_keys=[loja_destino_id])
    veiculo = relationship("Veiculo")

    __table_args__ = (
        Index("ix_proposta_rep_prop", "loja_proponente_id"),
        Index("ix_proposta_rep_dest", "loja_destino_id"),
        Index("ix_proposta_rep_veiculo", "veiculo_id"),
    )


# ═══════════════════════════════════════════════════════════════
# 4.2 — SIMULADOR DE CRÉDITO (MÓDULO V2)
# ═══════════════════════════════════════════════════════════════

class CredencialBanco(Base):
    """Credenciais cifradas de uma loja (ou vendedor) para um banco específico.

    usuario_id=NULL  → credencial da loja (gestor/admin configura)
    usuario_id=<id>  → credencial pessoal do vendedor (sobrepõe a da loja nas simulações dele)
    """
    __tablename__ = "credencial_banco"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    # NULL = credencial da loja; preenchido = credencial pessoal do vendedor
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=True)
    banco = Column(Enum(BancoSimulador), nullable=False)

    # Payload JSON cifrado (Fernet): {"usuario": "...", "senha": "..."}
    credenciais_cifradas = Column(Text, nullable=False)

    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("loja_id", "banco", "usuario_id", name="uq_credencial_loja_banco_usuario"),
    )


class CredencialIA(Base):
    """Chave de IA (BYOK) de uma loja para um provedor específico (Anthropic, OpenAI, etc.)."""
    __tablename__ = "credencial_ia"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    provedor = Column(String(50), nullable=False)  # "anthropic" | "openai" | "gemini"
    api_key_cifrada = Column(Text, nullable=False)   # Fernet
    modelo_padrao = Column(String(100), nullable=True)
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("loja_id", "provedor", name="uq_credencial_ia_loja_provedor"),
    )


class MarketingUsage(Base):
    """Registro de consumo de IA por chamada de marketing (billing futuro)."""
    __tablename__ = "marketing_usage"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)
    provedor = Column(String(50), nullable=False)
    modelo = Column(String(100), nullable=False)
    tokens_input = Column(Integer, default=0)
    tokens_output = Column(Integer, default=0)
    byok = Column(Boolean, default=False)   # True = usou chave da própria loja
    created_at = Column(DateTime, default=_now)


class Simulacao(Base):
    """Sessão de simulação iniciada por um vendedor ou cliente."""
    __tablename__ = "simulacao"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(String(36), ForeignKey("cliente_pf.id", ondelete="SET NULL"), nullable=True)
    criado_por_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    entrada = Column(Float, nullable=False)
    prazo_desejado = Column(Integer, nullable=True)
    status = Column(Enum(StatusSimulacao), default=StatusSimulacao.PENDENTE, nullable=False)
    
    # Opcional: linkar a um Lead existente
    lead_id = Column(String(36), ForeignKey("lead.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    resultados = relationship("SimulacaoResultado", back_populates="simulacao", cascade="all, delete-orphan")


class SimulacaoResultado(Base):
    """Resultado individual de um banco para uma simulação."""
    __tablename__ = "simulacao_resultado"

    id = Column(String(36), primary_key=True, default=_uuid)
    simulacao_id = Column(String(36), ForeignKey("simulacao.id", ondelete="CASCADE"), nullable=False)
    banco = Column(Enum(BancoSimulador), nullable=False)
    
    status = Column(Enum(StatusResultadoBanco), nullable=False)
    parcela = Column(Float, nullable=True)
    taxa = Column(Float, nullable=True)
    total = Column(Float, nullable=True)
    prazo = Column(Integer, nullable=True)
    
    erro = Column(Text, nullable=True)
    tempo_ms = Column(Integer, default=0)
    raw_response = Column(Text, nullable=True)  # JSON

    created_at = Column(DateTime, default=_now)

    # Relationships
    simulacao = relationship("Simulacao", back_populates="resultados")


# ═══════════════════════════════════════════════════════════════
# 4.3 — ASSISTENTE DE IA DO VENDEDOR (WHATSAPP)
# ═══════════════════════════════════════════════════════════════

class AssistentePermissao(Base):
    """Permissão individual de uso do Assistente de IA por vendedor."""
    __tablename__ = "assistente_permissao"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    pode_usar = Column(Boolean, default=False, nullable=False)
    autonomia_default = Column(Enum(AutonomiaAssistente), default=AutonomiaAssistente.COPILOTO, nullable=False)
    
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja")
    usuario = relationship("Usuario")

    __table_args__ = (
        UniqueConstraint("loja_id", "usuario_id", name="uq_assistente_permissao_loja_usuario"),
    )


class AssistenteConfig(Base):
    """Configurações de IA e Clonagem de voz do vendedor."""
    __tablename__ = "assistente_config"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    
    tom = Column(Enum(TomAssistente), default=TomAssistente.AMIGAVEL, nullable=False)
    audio_url = Column(String(500), nullable=True)
    estilo_resumo = Column(Text, nullable=True)
    
    voz_id = Column(String(100), nullable=True)
    consentimento_voz = Column(Boolean, default=False, nullable=False)
    consentimento_timestamp = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja")
    usuario = relationship("Usuario")

    __table_args__ = (
        UniqueConstraint("loja_id", "usuario_id", name="uq_assistente_config_loja_usuario"),
    )


class ConversaWhatsapp(Base):
    """Conversa ativa do WhatsApp do vendedor com um lead."""
    __tablename__ = "conversa_whatsapp"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    
    conversa_whatsapp_id = Column(String(100), nullable=False)  # jid ex: 5511999999999@c.us
    contato_nome = Column(String(200), nullable=False)
    contato_numero = Column(String(50), nullable=False)
    
    autonomia = Column(Enum(AutonomiaAssistente), default=AutonomiaAssistente.COPILOTO, nullable=False)
    
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja")
    usuario = relationship("Usuario")
    mensagens = relationship("MensagemWhatsapp", back_populates="conversa", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("loja_id", "usuario_id", "conversa_whatsapp_id", name="uq_conversa_whatsapp_loja_user_jid"),
    )


class MensagemWhatsapp(Base):
    """Mensagens enviadas/recebidas via WhatsApp no Assistente de IA."""
    __tablename__ = "mensagem_whatsapp"

    id = Column(String(36), primary_key=True, default=_uuid)
    conversa_id = Column(String(36), ForeignKey("conversa_whatsapp.id", ondelete="CASCADE"), nullable=False)
    
    mensagem_whatsapp_id = Column(String(200), nullable=True) # id da mensagem no whatsapp
    autor_tipo = Column(String(50), nullable=False)  # lead, vendedor, ia
    conteudo = Column(Text, nullable=False)
    
    midia_url = Column(String(500), nullable=True)
    midia_tipo = Column(String(50), nullable=True)
    
    sugestao_ia = Column(Text, nullable=True) # Se no modo copiloto, guarda a resposta sugerida
    enviada_ia = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=_now)

    # Relationships
    conversa = relationship("ConversaWhatsapp", back_populates="mensagens")


# ═══════════════════════════════════════════════════════════════
# 2.12 — CONTRATOS
# ═══════════════════════════════════════════════════════════════

class Contrato(Base):
    """Contrato de compra/venda, consignação ou garantia vinculado a veículo e cliente."""
    __tablename__ = "contrato"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(String(36), ForeignKey("cliente_pf.id", ondelete="SET NULL"), nullable=True)

    tipo = Column(Enum(TipoContrato), default=TipoContrato.COMPRA_VENDA, nullable=False)
    status = Column(Enum(StatusContrato), default=StatusContrato.RASCUNHO, nullable=False)
    numero = Column(String(20), unique=True, nullable=False)  # CV-2026-0001

    valor_venda = Column(Float, nullable=True)
    valor_entrada = Column(Float, nullable=True)
    parcelas = Column(Integer, nullable=True)
    observacoes = Column(Text, nullable=True)

    # Dados OCR extraídos (JSON) — preenchidos se veio de escaneamento
    dados_ocr = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    # Relationships
    loja = relationship("Loja", back_populates="contratos")
    # foreign_keys explícito: veiculo.contrato_origem_id criou um 2º caminho contrato↔veiculo
    veiculo = relationship("Veiculo", foreign_keys=[veiculo_id])
    cliente = relationship("ClientePF")

    __table_args__ = (
        Index("ix_contrato_loja", "loja_id"),
        Index("ix_contrato_veiculo", "veiculo_id"),
        Index("ix_contrato_cliente", "cliente_id"),
        Index("ix_contrato_status", "status"),
    )


# ═══════════════════════════════════════════════════════════════
# CARTEIRA DO PROPRIETÁRIO (M018)
# ═══════════════════════════════════════════════════════════════

class VeiculoDocumento(Base):
    """Documento vinculado a um veículo vendido pela plataforma (contrato, NF, garantia etc.)."""
    __tablename__ = "veiculo_documento"

    id = Column(String(36), primary_key=True, default=_uuid)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="CASCADE"), nullable=False)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)

    tipo = Column(Enum(TipoDocumentoVeiculo), nullable=False, default=TipoDocumentoVeiculo.OUTRO)
    nome = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    visivel_comprador = Column(Boolean, default=True)

    created_at = Column(DateTime, default=_now)

    veiculo = relationship("Veiculo", back_populates="documentos")

    __table_args__ = (
        Index("ix_veiculo_doc_veiculo", "veiculo_id"),
        Index("ix_veiculo_doc_loja", "loja_id"),
    )


# ═══════════════════════════════════════════════════════════════
# MARKETING — REDES SOCIAIS + AGENDAMENTO (M024)
# ═══════════════════════════════════════════════════════════════

class CredencialRedeSocial(Base):
    """Token OAuth de uma rede social (Instagram/Facebook) de uma loja."""
    __tablename__ = "credencial_rede_social"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    rede = Column(String(20), nullable=False)          # instagram | facebook | whatsapp | tiktok
    access_token_cifrado = Column(Text, nullable=False)
    refresh_token_cifrado = Column(Text, nullable=True)
    token_expira_em = Column(DateTime, nullable=True)
    page_id = Column(String(100), nullable=True)
    instagram_account_id = Column(String(100), nullable=True)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=_now)
    atualizado_em = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        UniqueConstraint("loja_id", "rede", name="uq_credencial_rede_loja"),
        Index("ix_cred_rede_loja", "loja_id"),
    )


class PostAgendado(Base):
    """Post de marketing gerado e agendado para publicação em redes sociais."""
    __tablename__ = "post_agendado"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    redes = Column(Text, nullable=False)           # JSON array: ["instagram", "facebook"]
    texto = Column(Text, nullable=False)
    hashtags = Column(Text, nullable=False, default="[]")  # JSON array
    midia_urls = Column(Text, nullable=True)       # JSON array de URLs públicas das fotos
    status = Column(String(20), default="agendado", nullable=False)  # agendado | publicado | falhou | cancelado
    publicar_em = Column(DateTime, nullable=False)
    publicado_em = Column(DateTime, nullable=True)
    erro = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=_now)
    atualizado_em = Column(DateTime, default=_now, onupdate=_now)

    __table_args__ = (
        Index("ix_post_agendado_loja", "loja_id"),
        Index("ix_post_agendado_status", "status"),
        Index("ix_post_agendado_publicar_em", "publicar_em"),
    )


# ═══════════════════════════════════════════════════════════════
# STORIES B2C/B2B
# ═══════════════════════════════════════════════════════════════

class Story(Base):
    """Story de veículo — expira em 24h; respeita delay de exclusividade B2B."""
    __tablename__ = "story"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    legenda = Column(Text, nullable=True)
    expira_em = Column(DateTime, nullable=False)          # created_at + 24h
    visivel_publico_em = Column(DateTime, nullable=False) # created_at + delay da loja (0 = imediato)
    created_at = Column(DateTime, default=_now)

    loja = relationship("Loja")
    veiculo = relationship("Veiculo")

    __table_args__ = (
        Index("ix_story_loja", "loja_id"),
        Index("ix_story_expira", "expira_em"),
    )


class LojaSeguidora(Base):
    """Usuário B2C segue uma loja para ver seus stories."""
    __tablename__ = "loja_seguida"

    id = Column(String(36), primary_key=True, default=_uuid)
    usuario_id = Column(String(36), ForeignKey("usuario.id", ondelete="CASCADE"), nullable=False)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        UniqueConstraint("usuario_id", "loja_id", name="uq_loja_seguida"),
        Index("ix_loja_seguida_usuario", "usuario_id"),
    )


class LojaConfig(Base):
    """Configurações por loja — uma linha por loja."""
    __tablename__ = "loja_config"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False, unique=True)
    delay_exclusividade_horas = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    loja = relationship("Loja")


class LeadTriagem(Base):
    """Score IA de triagem de leads B2C — só para conversas de clientes finais."""
    __tablename__ = "lead_triagem"

    id = Column(String(36), primary_key=True, default=_uuid)
    conversa_id = Column(String(36), ForeignKey("conversa.id", ondelete="CASCADE"), nullable=False, unique=True)
    score = Column(Integer, nullable=False)               # 0-100
    classificacao = Column(String(20), nullable=False)   # quente | ruido
    justificativa = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    conversa = relationship("Conversa")

    __table_args__ = (
        Index("ix_lead_triagem_conversa", "conversa_id"),
        Index("ix_lead_triagem_class", "classificacao"),
    )


# ═══════════════════════════════════════════════════════════════
# NOTIFICAÇÕES (M025)
# ═══════════════════════════════════════════════════════════════

class Notificacao(Base):
    """Notificações para o usuário sobre mensagens de chat ou propostas recebidas."""
    __tablename__ = "notificacao"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), nullable=False)
    usuario_id = Column(String(36), nullable=True) # Opcional: usuário específico
    titulo = Column(String(150), nullable=False)
    conteudo = Column(Text, nullable=False)
    tipo = Column(String(50), nullable=False) # "chat_b2b" | "chat_b2c" | "proposta"
    lida = Column(Boolean, default=False, nullable=False)
    link = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_notif_loja", "loja_id"),
        Index("ix_notif_usuario", "usuario_id"),
        Index("ix_notif_lida", "lida"),
        Index("ix_notif_created", "created_at"),
    )


# ═══════════════════════════════════════════════════════════════
# ESTEIRA PÓS-VENDA (ESTEIRA-POS-VENDA.md §6.2)
# ═══════════════════════════════════════════════════════════════

class EsteiraPosVenda(Base):
    """A espinha do pós-venda: 1 por venda registrada. Carrega o negócio
    do clique em 'Vender' até documento na mão do dono + transferência feita."""
    __tablename__ = "esteira_pos_venda"

    id = Column(String(36), primary_key=True, default=_uuid)
    loja_id = Column(String(36), ForeignKey("loja.id", ondelete="CASCADE"), nullable=False)
    veiculo_id = Column(String(36), ForeignKey("veiculo.id", ondelete="SET NULL"), nullable=True)
    contrato_id = Column(String(36), ForeignKey("contrato.id", ondelete="SET NULL"), nullable=True)
    comprador_id = Column(String(36), ForeignKey("cliente_pf.id", ondelete="SET NULL"), nullable=True)
    vendedor_id = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    estagio = Column(Enum(EstagioPosVenda), default=EstagioPosVenda.CONTRATO, nullable=False)
    origem = Column(Enum(OrigemLead), nullable=True)   # manual, vitrine, whatsapp, simulador, repasse

    # datas-chave da transferência (evita tabela extra)
    comunicacao_venda_em = Column(DateTime, nullable=True)   # loja comunicou → protege a loja
    transferencia_em = Column(DateTime, nullable=True)       # saiu no DETRAN

    aberta_em = Column(DateTime, default=_now)
    concluida_em = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    itens = relationship(
        "ItemChecklist", back_populates="esteira",
        cascade="all, delete-orphan", order_by="ItemChecklist.categoria",
    )

    __table_args__ = (
        Index("ix_esteira_loja", "loja_id"),
        Index("ix_esteira_estagio", "estagio"),
        Index("ix_esteira_veiculo", "veiculo_id"),
    )


class ItemChecklist(Base):
    """Um passo do checklist invisível (N por esteira, criados de um template)."""
    __tablename__ = "item_checklist"

    id = Column(String(36), primary_key=True, default=_uuid)
    esteira_id = Column(String(36), ForeignKey("esteira_pos_venda.id", ondelete="CASCADE"), nullable=False)

    chave = Column(String(50), nullable=False)   # slug estável: "recibo_entregue", "comunicacao_venda"...
    titulo = Column(String(200), nullable=False)
    categoria = Column(Enum(CategoriaItem), nullable=False)
    responsavel = Column(Enum(ResponsavelItem), default=ResponsavelItem.LOJA)
    status = Column(Enum(StatusItemChecklist), default=StatusItemChecklist.PENDENTE, nullable=False)
    obrigatorio = Column(Boolean, default=True)
    prazo_em = Column(DateTime, nullable=True)      # calculado (ex: comunicação = venda + 60d)
    doc_id = Column(String(36), ForeignKey("veiculo_documento.id", ondelete="SET NULL"), nullable=True)
    observacao = Column(Text, nullable=True)
    concluido_em = Column(DateTime, nullable=True)
    concluido_por = Column(String(36), ForeignKey("usuario.id", ondelete="SET NULL"), nullable=True)

    esteira = relationship("EsteiraPosVenda", back_populates="itens")

    __table_args__ = (
        Index("ix_item_esteira", "esteira_id"),
        Index("ix_item_status", "status"),
    )

