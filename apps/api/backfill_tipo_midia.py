"""
Backfill do tipo de mídia — corrige linhas cujo `tipo` não bate com a extensão da URL.

Uso:
  python backfill_tipo_midia.py            # dry-run: só relata o que mudaria
  python backfill_tipo_midia.py --apply    # grava

Produção (Fly): fly ssh console -C "python backfill_tipo_midia.py --apply"

Mídias gravadas antes da guarda de extensão em routers/midias.py entraram com o
`tipo` que o app mandava, e builds antigas mandavam "video" para foto. Uma foto
marcada como vídeo faz a vitrine renderizar <video src="...jpg">, que fica preto
em 0:00 e falha em silêncio (o erro sai no evento `error` do elemento, não no
console). Aqui a extensão da URL é a verdade, igual à regra do router.

Reexecutável: só toca nas linhas divergentes.
"""
import argparse
import asyncio

from sqlalchemy.future import select

from database import async_session
from models import Midia, TipoMidia

EXT_FOTO = (".jpg", ".jpeg", ".png", ".webp")
EXT_VIDEO = (".mp4", ".mov", ".webm")


def _tipo_pela_url(url: str) -> TipoMidia | None:
    """Tipo conforme a extensão; None quando a URL não permite decidir."""
    u = (url or "").lower()
    if u.endswith(EXT_FOTO):
        return TipoMidia.FOTO
    if u.endswith(EXT_VIDEO):
        return TipoMidia.VIDEO
    return None


async def main(apply: bool) -> None:
    async with async_session() as db:
        res = await db.execute(select(Midia))
        midias = res.scalars().all()

        corrigidas = 0
        indecisas = 0

        for m in midias:
            esperado = _tipo_pela_url(m.url)
            if esperado is None:
                indecisas += 1
                print(f"  ? extensao desconhecida, mantida como {m.tipo.value}: {m.url}")
                continue
            if m.tipo == esperado:
                continue
            print(f"  ~ {m.tipo.value} -> {esperado.value}: {m.url}")
            corrigidas += 1
            if apply:
                m.tipo = esperado

        if apply and corrigidas:
            await db.commit()

        total = len(midias)
        acao = "corrigidas" if apply else "seriam corrigidas (dry-run)"
        print(f"\n{total} midias analisadas | {corrigidas} {acao} | {indecisas} sem extensao reconhecida")
        if not apply and corrigidas:
            print("Rode de novo com --apply para gravar.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="grava as correcoes (sem isso, apenas relata)")
    args = parser.parse_args()
    asyncio.run(main(args.apply))
