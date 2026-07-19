"""
Backfill de thumbnails — gera o WebP das fotos que ainda não têm thumb_url.

Uso:
  python backfill_thumbs.py               # processa todas
  python backfill_thumbs.py --limit 50    # lote de teste

Produção (Fly): fly ssh console -C "python backfill_thumbs.py"

Baixa cada original do storage ativo (R2 ou disco local), gera o thumbnail
(storage.gerar_thumbnail) e grava thumb_url na linha. Falha individual não
interrompe o lote; commit a cada 20 itens. Reexecutável: só pega thumb_url nulo.
"""
import argparse
import asyncio
import os

from sqlalchemy.future import select

from database import async_session
from models import Midia, TipoMidia
from storage import storage_provider, gerar_thumbnail


def _key_do_original(url: str) -> str:
    if storage_provider.use_s3:
        return storage_provider._key_from_url(url)
    return url.split("/static/uploads/", 1)[-1]


async def _baixar(url: str) -> bytes | None:
    if storage_provider.use_s3:
        key = _key_do_original(url)
        try:
            resp = storage_provider.s3_client.get_object(
                Bucket=storage_provider.bucket_name, Key=key
            )
            return resp["Body"].read()
        except Exception as e:
            print(f"  ! download falhou ({key}): {e}")
            return None
    path = os.path.join(storage_provider.local_dir, *_key_do_original(url).split("/"))
    if not os.path.exists(path):
        print(f"  ! arquivo local nao existe: {path}")
        return None
    with open(path, "rb") as f:
        return f.read()


async def main(limit: int | None) -> None:
    async with async_session() as db:
        stmt = select(Midia).where(Midia.tipo == TipoMidia.FOTO, Midia.thumb_url.is_(None))
        if limit:
            stmt = stmt.limit(limit)
        midias = (await db.execute(stmt)).scalars().all()
        print(f"{len(midias)} fotos sem thumbnail")

        ok = falha = 0
        for i, m in enumerate(midias, 1):
            conteudo = await _baixar(m.url)
            thumb = await asyncio.to_thread(gerar_thumbnail, conteudo) if conteudo else None
            if not thumb:
                falha += 1
                continue

            # Mesma "pasta" do original, subpasta thumbs/, mesmo nome em .webp
            pasta, arquivo = os.path.split(_key_do_original(m.url))
            base = os.path.splitext(arquivo)[0]
            thumb_key = f"{pasta}/thumbs/{base}.webp" if pasta else f"thumbs/{base}.webp"
            try:
                m.thumb_url = await storage_provider._put(thumb_key, thumb, "image/webp")
                ok += 1
            except Exception as e:
                print(f"  ! upload do thumb falhou ({thumb_key}): {e}")
                falha += 1

            if i % 20 == 0:
                await db.commit()
                print(f"  {i}/{len(midias)}…")

        await db.commit()
        print(f"Concluido: {ok} thumbs gerados, {falha} falhas")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Gera thumbnails das fotos existentes")
    ap.add_argument("--limit", type=int, default=None, help="processa no maximo N fotos")
    asyncio.run(main(ap.parse_args().limit))
