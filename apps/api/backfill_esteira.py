"""
Backfill: abre a esteira pós-venda para vendas que já existiam antes da feature
(ESTEIRA-POS-VENDA.md §6.6). Percorre contratos de compra/venda que ainda não
têm esteira e semeia o checklist usando a data do contrato como data da venda.

Uso: python backfill_esteira.py [--dry-run]
"""
import asyncio
import sys

from sqlalchemy import select

from database import async_session
from models import (
    Contrato,
    EsteiraPosVenda,
    OrigemLead,
    StatusContrato,
    TipoContrato,
    Veiculo,
)
from pos_venda_template import montar_checklist


async def _run(dry_run: bool) -> None:
    async with async_session() as db:
        # contratos de compra/venda sem esteira
        subq = select(EsteiraPosVenda.contrato_id).where(EsteiraPosVenda.contrato_id.is_not(None))
        stmt = (
            select(Contrato)
            .where(
                Contrato.tipo == TipoContrato.COMPRA_VENDA,
                Contrato.status != StatusContrato.CANCELADO,
                Contrato.id.not_in(subq),
            )
        )
        contratos = (await db.execute(stmt)).scalars().all()
        print(f"Contratos sem esteira: {len(contratos)}")

        criadas = 0
        for c in contratos:
            veiculo = None
            if c.veiculo_id:
                veiculo = (await db.execute(
                    select(Veiculo).where(Veiculo.id == c.veiculo_id)
                )).scalar_one_or_none()

            esteira = EsteiraPosVenda(
                loja_id=c.loja_id,
                veiculo_id=c.veiculo_id,
                contrato_id=c.id,
                comprador_id=c.cliente_id,
                origem=OrigemLead.MANUAL,
                aberta_em=c.created_at,
            )
            if dry_run:
                criadas += 1
                continue
            db.add(esteira)
            await db.flush()
            for item in montar_checklist(
                esteira, veiculo, c,
                valor_entrada=c.valor_entrada,
                parcelas=c.parcelas,
                financiado=bool(c.parcelas and c.parcelas > 0),
                data_venda=c.created_at,
            ):
                db.add(item)
            criadas += 1

        if not dry_run:
            await db.commit()
        print(f"{'[dry-run] ' if dry_run else ''}Esteiras {'a criar' if dry_run else 'criadas'}: {criadas}")


if __name__ == "__main__":
    asyncio.run(_run("--dry-run" in sys.argv))
