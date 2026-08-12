"""
Ciclo de vida das conversas B2C atreladas a um veículo.

Regra de negócio: o chat da vitrine é sempre **um por veículo** (a conversa nasce
com `veiculo_id` e é única por cliente+veículo). Quando o veículo sai do estoque —
vendido, reservado ou despublicado — a conversa correspondente perde o objeto e
vira somente-leitura: o cliente recebe um aviso de sistema no próprio chat e o
vendedor deixa de ver a thread misturada com as negociações vivas.

Os leads de quem **não** comprou não morrem junto: eles são desvinculados do
veículo e continuam no funil como "buscando outro veículo", que é o que preserva a
gestão do vendedor (falei do Celta, vendeu, agora falo do Corso).

Uso nos routers:

    avisos = await arquivar_conversas_do_veiculo(db, veiculo, "vendido",
                                                 comprador_cliente_id=cliente.id)
    ...
    await db.commit()
    await emitir_avisos(db, avisos)   # broadcast só depois do commit
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from models import (
    Conversa,
    EtapaLead,
    Lead,
    Mensagem,
    TipoConversa,
    Veiculo,
    utcnow,
)

# Valores gravados em `Conversa.motivo_arquivo` (VARCHAR, não enum nativo).
MOTIVO_VENDIDO = "vendido"
MOTIVO_RESERVADO = "reservado"
MOTIVO_INDISPONIVEL = "indisponivel"

_TEXTOS = {
    MOTIVO_VENDIDO: (
        "Este veículo foi vendido, então esta conversa foi arquivada. "
        "Para falar sobre outro veículo da loja, é só abrir o anúncio dele e iniciar um novo contato."
    ),
    MOTIVO_RESERVADO: (
        "Este veículo foi reservado, então esta conversa foi arquivada. "
        "Para falar sobre outro veículo da loja, é só abrir o anúncio dele e iniciar um novo contato."
    ),
    MOTIVO_INDISPONIVEL: (
        "Este veículo saiu do anúncio, então esta conversa foi arquivada. "
        "Para falar sobre outro veículo da loja, é só abrir o anúncio dele e iniciar um novo contato."
    ),
}


def _hoje() -> str:
    return utcnow().strftime("%d/%m/%Y")


def texto_do_motivo(motivo: Optional[str], veiculo_descricao: str = "") -> str:
    """Aviso exibido no chat. Motivo desconhecido cai no texto neutro."""
    base = _TEXTOS.get(motivo or "", _TEXTOS[MOTIVO_INDISPONIVEL])
    if veiculo_descricao:
        return f"{veiculo_descricao}: {base}"
    return base


async def arquivar_conversas_do_veiculo(
    db: AsyncSession,
    veiculo: Veiculo,
    motivo: str,
    *,
    comprador_cliente_id: Optional[str] = None,
    migrar_leads: bool = True,
) -> list[dict]:
    """
    Arquiva as conversas B2C ativas do veículo e devolve os avisos a transmitir.

    NÃO faz commit — a chamada acontece dentro da transação do router (venda,
    troca de status, repasse aceito). O broadcast fica para `emitir_avisos`,
    depois do commit, para o WebSocket nunca anunciar algo que sofreu rollback.

    `comprador_cliente_id` é o `ClientePF.id` de quem comprou: o lead dele já foi
    tratado como FECHAMENTO pelo fluxo de venda e não deve ser desvinculado aqui.
    """
    stmt = select(Conversa).where(
        Conversa.veiculo_id == veiculo.id,
        Conversa.tipo == TipoConversa.B2C,
        Conversa.ativa == True,  # noqa: E712 — SQLAlchemy
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()

    agora = utcnow()
    descricao = " ".join(p for p in [veiculo.marca, veiculo.modelo] if p)
    conteudo = texto_do_motivo(motivo, descricao)

    avisos: list[dict] = []
    for conversa in conversas:
        conversa.ativa = False
        conversa.arquivada_em = agora
        conversa.motivo_arquivo = motivo
        conversa.updated_at = agora

        aviso = Mensagem(
            conversa_id=conversa.id,
            autor_id=None,
            conteudo=conteudo,
            sistema=True,
            lida=False,
        )
        db.add(aviso)
        avisos.append({"conversa_id": conversa.id, "mensagem": aviso})

    if migrar_leads:
        await _migrar_leads_do_veiculo(
            db, veiculo, descricao, motivo, comprador_cliente_id=comprador_cliente_id
        )

    if conversas:
        await db.flush()

    return [
        {
            "conversa_id": a["conversa_id"],
            "payload": {
                "id": a["mensagem"].id,
                "conversa_id": a["conversa_id"],
                "autor_id": None,
                "autor_nome": "Sistema",
                "conteudo": conteudo,
                "sistema": True,
                "lida": False,
                "created_at": a["mensagem"].created_at.isoformat() if a["mensagem"].created_at else agora.isoformat(),
            },
        }
        for a in avisos
    ]


async def _migrar_leads_do_veiculo(
    db: AsyncSession,
    veiculo: Veiculo,
    descricao: str,
    motivo: str,
    *,
    comprador_cliente_id: Optional[str] = None,
) -> None:
    """
    Tira do veículo os leads de quem não comprou, mantendo-os no funil.

    O lead continua na etapa em que estava (é o mesmo interesse de compra, só que
    sem carro definido) — quem fecha lead é o vendedor, não o sistema.
    """
    stmt = select(Lead).where(
        Lead.veiculo_id == veiculo.id,
        Lead.etapa.notin_([EtapaLead.FECHAMENTO, EtapaLead.PERDIDO]),
    )
    res = await db.execute(stmt)
    leads = res.scalars().all()

    rotulo = {
        MOTIVO_VENDIDO: "foi vendido",
        MOTIVO_RESERVADO: "foi reservado",
    }.get(motivo, "saiu do anúncio")
    nota = (
        f"[sistema {_hoje()}] {descricao or 'O veículo'} {rotulo}. "
        "Lead mantido no funil, agora sem veículo definido — retomar oferecendo outra opção."
    )

    for lead in leads:
        if comprador_cliente_id and lead.cliente_id == comprador_cliente_id:
            continue
        lead.veiculo_id = None
        lead.observacoes = f"{lead.observacoes}\n{nota}" if lead.observacoes else nota
        lead.updated_at = utcnow()


async def emitir_avisos(db: AsyncSession, avisos: list[dict]) -> None:
    """Transmite os avisos de arquivamento pelo WebSocket. Chamar após o commit."""
    if not avisos:
        return
    from routers.b2b import manager  # import tardio: routers importam este módulo

    for aviso in avisos:
        try:
            await manager.broadcast_to_conversation(aviso["conversa_id"], aviso["payload"], db)
        except Exception:
            # Aviso é conveniência de tempo real; a conversa já está arquivada no banco
            # e o próximo fetch mostra a mensagem de qualquer jeito.
            continue


def reabrir_conversa(conversa: Conversa) -> None:
    """Desfaz o arquivamento quando o cliente volta a falar sobre um veículo disponível."""
    conversa.ativa = True
    conversa.arquivada_em = None
    conversa.motivo_arquivo = None
    conversa.updated_at = utcnow()


async def reabrir_conversas_do_veiculo(db: AsyncSession, veiculo: Veiculo) -> list[dict]:
    """
    Volta atrás quando o veículo fica disponível de novo (reserva desfeita,
    republicação). Estado em que se entra e não se sai é bug — ver o padrão nº 16
    em BUGS.md. Só reabre o que o **sistema** arquivou (`motivo_arquivo` presente).

    NÃO faz commit; o broadcast fica para `emitir_avisos`, como no arquivamento.
    """
    stmt = select(Conversa).where(
        Conversa.veiculo_id == veiculo.id,
        Conversa.tipo == TipoConversa.B2C,
        Conversa.motivo_arquivo.isnot(None),
    )
    res = await db.execute(stmt)
    conversas = res.scalars().all()
    if not conversas:
        return []

    agora = utcnow()
    descricao = " ".join(p for p in [veiculo.marca, veiculo.modelo] if p)
    conteudo = (
        f"{descricao} voltou a ficar disponível. Esta conversa foi reaberta — pode falar com a loja por aqui."
        if descricao
        else "O veículo voltou a ficar disponível. Esta conversa foi reaberta."
    )

    avisos: list[dict] = []
    for conversa in conversas:
        reabrir_conversa(conversa)
        aviso = Mensagem(
            conversa_id=conversa.id,
            autor_id=None,
            conteudo=conteudo,
            sistema=True,
            lida=False,
        )
        db.add(aviso)
        avisos.append((conversa.id, aviso))

    await db.flush()

    return [
        {
            "conversa_id": cid,
            "payload": {
                "id": msg.id,
                "conversa_id": cid,
                "autor_id": None,
                "autor_nome": "Sistema",
                "conteudo": conteudo,
                "sistema": True,
                "lida": False,
                "created_at": msg.created_at.isoformat() if msg.created_at else agora.isoformat(),
            },
        }
        for cid, msg in avisos
    ]
