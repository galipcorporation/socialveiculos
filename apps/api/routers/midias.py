import json
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import Veiculo, Midia, TipoMidia
from storage import storage_provider
from schemas import MidiaResponse

router = APIRouter(prefix="/v1", tags=["Mídias B2B"])

logger = logging.getLogger("midias")


# Limites
MAX_FILE_SIZE_IMAGE = 15 * 1024 * 1024  # 15MB
MAX_FILE_SIZE_VIDEO = 100 * 1024 * 1024  # 100MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/mpeg", "video/quicktime", "video/webm"}


async def process_media_in_background(file_url: str, mime_type: str):
    """
    Background Task para processamento assíncrono.
    Em produção, aqui poderíamos otimizar imagens (Pillow) e extrair o poster de vídeos (ffmpeg).
    Faremos isso de forma segura e resiliente (try/except) para evitar quebras se bibliotecas externas faltarem.
    """
    try:
        # Stub / Placeholder para processamento
        pass
    except Exception as e:
        logger.error("Erro no processamento de mídia em background: %s", e)


@router.post("/midias/upload", status_code=status.HTTP_201_CREATED)
async def upload_midia(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: B2BContext = Depends(get_current_b2b_user)
):
    """
    Upload de mídia unificado (foto ou vídeo).
    Valida tamanho, formato e salva no storage ativo (Local ou S3).
    """
    # 1. Validar Content-Type e tamanho
    content_type = file.content_type or ""
    
    is_image = content_type in ALLOWED_IMAGE_TYPES
    is_video = content_type in ALLOWED_VIDEO_TYPES

    if not is_image and not is_video:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo não suportado. Use imagens (JPEG, PNG, WEBP) ou vídeos (MP4, WEBM, MOV)."
        )

    # Ler conteúdo para verificar tamanho
    content = await file.read()
    file_size = len(content)

    if is_image and file_size > MAX_FILE_SIZE_IMAGE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Imagem muito grande. Limite máximo: {MAX_FILE_SIZE_IMAGE // (1024*1024)}MB."
        )

    if is_video and file_size > MAX_FILE_SIZE_VIDEO:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Vídeo muito grande. Limite máximo: {MAX_FILE_SIZE_VIDEO // (1024*1024)}MB."
        )

    # 2. Upload
    try:
        url = await storage_provider.upload_file(
            content, file.filename or "file", content_type,
            prefixo=f"lojas/{current_user.loja_id}/veiculos",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Falha ao enviar arquivo ao storage: {str(e)}"
        )

    # 3. Adicionar processamento em background
    background_tasks.add_task(process_media_in_background, url, content_type)

    return {
        "url": url,
        "tipo": "foto" if is_image else "video",
        "nome": file.filename
    }


@router.post("/veiculos/{veiculo_id}/midias", response_model=List[MidiaResponse])
async def associar_midia_veiculo(
    veiculo_id: str,
    midia_data: dict,  # Recebe { url: str, tipo: str }
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Associa uma mídia já carregada a um veículo específico no estoque da loja.
    """
    # Validar se o veículo pertence à loja
    v_stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == context.loja_id)
    v_res = await db.execute(v_stmt)
    veiculo = v_res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado nesta loja.")

    # Obter próxima ordem
    ordem_res = await db.execute(select(func.max(Midia.ordem)).where(Midia.veiculo_id == veiculo_id))
    max_ordem = ordem_res.scalar() or 0
    proxima_ordem = max_ordem + 1

    # Criar mídia
    tipo_enum = TipoMidia.FOTO if midia_data.get("tipo") == "foto" else TipoMidia.VIDEO
    nova_midia = Midia(
        veiculo_id=veiculo_id,
        tipo=tipo_enum,
        url=midia_data.get("url"),
        ordem=proxima_ordem
    )
    db.add(nova_midia)
    await db.commit()

    # Recarregar as mídias ordenadas do veículo
    stmt = select(Midia).where(Midia.veiculo_id == veiculo_id).order_by(Midia.ordem.asc())
    res = await db.execute(stmt)
    return res.scalars().all()



@router.patch("/veiculos/{veiculo_id}/midias/ordem")
async def reordenar_midias_veiculo(
    veiculo_id: str,
    ordem_ids: List[str],  # Lista ordenada de ids de mídia
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Reordena as mídias de um veículo no banco de dados.
    Recebe um array ordenado de IDs de mídia.
    """
    # Validar se o veículo pertence à loja
    v_stmt = select(Veiculo).where(Veiculo.id == veiculo_id, Veiculo.loja_id == context.loja_id)
    v_res = await db.execute(v_stmt)
    if not v_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Veículo não encontrado nesta loja.")

    # Atualizar ordem de cada mídia recebida
    for idx, midia_id in enumerate(ordem_ids):
        stmt = select(Midia).where(Midia.id == midia_id, Midia.veiculo_id == veiculo_id)
        res = await db.execute(stmt)
        midia = res.scalar_one_or_none()
        if midia:
            midia.ordem = idx + 1

    await db.commit()
    return {"message": "Ordenação de mídias atualizada com sucesso."}


@router.delete("/midias/{id}")
async def deletar_midia(
    id: str,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user)
):
    """
    Remove uma mídia do banco de dados e apaga o arquivo físico correspondente.
    """
    # Carregar mídia com validação de veículo da loja
    stmt = select(Midia).join(Veiculo).where(Midia.id == id, Veiculo.loja_id == context.loja_id)
    res = await db.execute(stmt)
    midia = res.scalar_one_or_none()
    if not midia:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mídia não encontrada ou não pertence à sua loja.")

    # Apagar arquivo físico
    url = midia.url
    await db.delete(midia)
    await db.commit()

    # Deletar em background ou imediatamente
    try:
        await storage_provider.delete_file(url)
    except Exception as e:
        logger.error("Erro ao deletar arquivo físico: %s", e)

    return {"message": "Mídia removida com sucesso."}
