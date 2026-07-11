"""
Template do checklist invisível da esteira pós-venda (ESTEIRA-POS-VENDA.md §6.3).

`montar_checklist` recebe a esteira recém-criada + veículo + contrato + dados da
venda e devolve a lista de ItemChecklist a semear. Itens não aplicáveis
(ex.: financiamento numa venda à vista) nascem NAO_APLICAVEL — nunca somem,
só ficam marcados. Prazos legais (comunicação 60d, transferência 30d) já
saem calculados a partir da data da venda (Fase 2, mas barato fazer agora).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from models import (
    CategoriaItem,
    EsteiraPosVenda,
    ItemChecklist,
    OrigemLead,
    ResponsavelItem,
    StatusItemChecklist,
)

# Prazos legais brasileiros (verificados em ESTEIRA-POS-VENDA.md §12)
PRAZO_COMUNICACAO_DIAS = 60   # loja avisa "vendi" → protege a loja (responsável solidária)
PRAZO_TRANSFERENCIA_DIAS = 30  # comprador passa para o nome dele

_LOJA = ResponsavelItem.LOJA
_COMPRADOR = ResponsavelItem.COMPRADOR


def montar_checklist(
    esteira: EsteiraPosVenda,
    veiculo,
    contrato,
    *,
    valor_entrada: float | None = None,
    parcelas: int | None = None,
    financiado: bool = False,
    data_venda: datetime | None = None,
) -> list[ItemChecklist]:
    """Gera os itens do checklist conforme a forma de pagamento e a origem.

    - `financiado`: há financiamento bancário no negócio.
    - `valor_entrada`/`parcelas`: definem se entrada/carnê se aplicam.
    - venda B2B (repasse): dispensa "chave/manual ao consumidor" (§8).
    """
    base = data_venda or datetime.now(timezone.utc)
    tem_entrada = bool(valor_entrada and valor_entrada > 0)
    repasse_b2b = esteira.origem == OrigemLead.REPASSE

    def st(aplica: bool) -> StatusItemChecklist:
        return StatusItemChecklist.PENDENTE if aplica else StatusItemChecklist.NAO_APLICAVEL

    # (chave, titulo, categoria, responsavel, obrigatorio, status, prazo_em)
    specs = [
        # ── Contrato e assinatura (§4.1) ──
        ("contrato_assinado", "Contrato de compra e venda assinado",
         CategoriaItem.CONTRATO, _LOJA, True, StatusItemChecklist.PENDENTE, None),
        ("garantia_entregue", "Termo de garantia entregue",
         CategoriaItem.CONTRATO, _LOJA, False, StatusItemChecklist.PENDENTE, None),

        # ── Pendências financeiras (§4.4) ──
        ("entrada_recebida", "Entrada recebida",
         CategoriaItem.FINANCEIRO, _LOJA, tem_entrada, st(tem_entrada), None),
        ("financiamento_liberado", "Financiamento aprovado e liberado",
         CategoriaItem.FINANCEIRO, _LOJA, financiado, st(financiado), None),
        ("debitos_quitados", "Débitos do veículo quitados (IPVA, licenciamento, multas)",
         CategoriaItem.FINANCEIRO, _LOJA, True, StatusItemChecklist.PENDENTE, None),
        ("taxa_transferencia_paga", "Taxa de transferência paga",
         CategoriaItem.FINANCEIRO, _LOJA, True, StatusItemChecklist.PENDENTE, None),
        ("comissao_paga", "Comissão do vendedor lançada/paga",
         CategoriaItem.FINANCEIRO, _LOJA, False, StatusItemChecklist.PENDENTE, None),

        # ── Documentos ao novo dono (§4.2) ──
        ("atpve_emitida", "ATPV-e emitida (recibo digital) ou CRV assinado",
         CategoriaItem.DOCUMENTO, _LOJA, True, StatusItemChecklist.PENDENTE, None),
        ("recibo_entregue", "ATPV-e / recibo entregue ao comprador",
         CategoriaItem.DOCUMENTO, _LOJA, True, StatusItemChecklist.PENDENTE, None),
        ("nota_entregue", "Nota fiscal / recibo de venda entregue",
         CategoriaItem.DOCUMENTO, _LOJA, False, StatusItemChecklist.PENDENTE, None),
        ("chave_manual_entregues", "Chave reserva + manual entregues",
         CategoriaItem.DOCUMENTO, _LOJA, False, st(not repasse_b2b), None),

        # ── Transferência no DETRAN (§4.3) ──
        ("comunicacao_venda", "Comunicação de venda ao DETRAN",
         CategoriaItem.TRANSFERENCIA, _LOJA, True, StatusItemChecklist.PENDENTE,
         base + timedelta(days=PRAZO_COMUNICACAO_DIAS)),
        ("vistoria", "Vistoria agendada/realizada",
         CategoriaItem.TRANSFERENCIA, _COMPRADOR, False, StatusItemChecklist.PENDENTE, None),
        ("transferencia_concluida", "Transferência concluída no DETRAN",
         CategoriaItem.TRANSFERENCIA, _COMPRADOR, True, StatusItemChecklist.PENDENTE,
         base + timedelta(days=PRAZO_TRANSFERENCIA_DIAS)),
    ]

    itens: list[ItemChecklist] = []
    for chave, titulo, categoria, responsavel, obrigatorio, status, prazo_em in specs:
        # item não aplicável nunca é obrigatório para conclusão
        obrig = obrigatorio and status != StatusItemChecklist.NAO_APLICAVEL
        itens.append(ItemChecklist(
            esteira_id=esteira.id,
            chave=chave,
            titulo=titulo,
            categoria=categoria,
            responsavel=responsavel,
            status=status,
            obrigatorio=obrig,
            prazo_em=prazo_em,
        ))
    return itens
