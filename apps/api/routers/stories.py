"""
Social Veículos — Stories de Veículos
- B2B: vendedores veem stories de todas as lojas imediatamente
- B2C: clientes veem só após delay configurado pela loja; só de lojas que seguem
"""
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_user, get_current_b2b_user, B2BContext
from models import (
    Story, LojaSeguidora, LojaConfig, Loja, Veiculo, Usuario,
)

router = APIRouter(prefix="/v1", tags=["Stories"])


# ── Schemas ────────────────────────────────────────────────────

class StoryMidiaOut(BaseModel):
    url: str
    tipo: str

class StoryOut(BaseModel):
    id: str
    loja_id: str
    loja_nome: str
    loja_logo: Optional[str] = None
    veiculo_id: Optional[str] = None
    veiculo_marca: Optional[str] = None
    veiculo_modelo: Optional[str] = None
    veiculo_preco: Optional[float] = None
    midia_url: Optional[str] = None
    legenda: Optional[str] = None
    expira_em: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SeguirLojaOut(BaseModel):
    seguindo: bool
    loja_id: str


class LojaConfigOut(BaseModel):
    delay_exclusividade_horas: int

class LojaConfigIn(BaseModel):
    delay_exclusividade_horas: int


# ── Helpers ────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)



async def _get_delay(db: AsyncSession, loja_id: str) -> int:
    res = await db.execute(select(LojaConfig).where(LojaConfig.loja_id == loja_id))
    cfg = res.scalar_one_or_none()
    return cfg.delay_exclusividade_horas if cfg else 0


def _story_to_out(s: Story) -> StoryOut:
    midia_url = None
    if s.veiculo and s.veiculo.midias:
        midia_url = s.veiculo.midias[0].url
    return StoryOut(
        id=s.id,
        loja_id=s.loja_id,
        loja_nome=s.loja.nome if s.loja else "",
        loja_logo=s.loja.logo_url if s.loja else None,
        veiculo_id=s.veiculo_id,
        veiculo_marca=s.veiculo.marca if s.veiculo else None,
        veiculo_modelo=s.veiculo.modelo if s.veiculo else None,
        veiculo_preco=s.veiculo.preco_venda if s.veiculo else None,
        midia_url=midia_url,
        legenda=s.legenda,
        expira_em=s.expira_em,
        created_at=s.created_at,
    )


# ── Stories B2C — lojas que o usuário segue ───────────────────

@router.get("/vitrine/stories", response_model=List[StoryOut])
async def listar_stories_vitrine(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Stories das lojas que o usuário B2C segue, ainda não expirados e já visíveis ao público."""
    agora = _now()

    seguidas_stmt = select(LojaSeguidora.loja_id).where(LojaSeguidora.usuario_id == current_user.id)
    seguidas_res = await db.execute(seguidas_stmt)
    loja_ids = [r[0] for r in seguidas_res.all()]

    if not loja_ids:
        return []

    stmt = (
        select(Story)
        .options(selectinload(Story.loja), selectinload(Story.veiculo).selectinload(Veiculo.midias))
        .where(
            Story.loja_id.in_(loja_ids),
            Story.expira_em > agora,
            Story.visivel_publico_em <= agora,
        )
        .order_by(Story.created_at.desc())
    )
    res = await db.execute(stmt)
    return [_story_to_out(s) for s in res.scalars().all()]


# ── Stories B2B — todas as lojas, sem delay ───────────────────

@router.get("/gestor/stories", response_model=List[StoryOut])
async def listar_stories_gestor(
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    """Stories de todas as lojas visíveis para usuários B2B (sem restrição de delay)."""
    agora = _now()
    stmt = (
        select(Story)
        .options(selectinload(Story.loja), selectinload(Story.veiculo).selectinload(Veiculo.midias))
        .where(Story.expira_em > agora)
        .order_by(Story.created_at.desc())
    )
    res = await db.execute(stmt)
    return [_story_to_out(s) for s in res.scalars().all()]


# ── Publicar story (chamado pelo gestor ao cadastrar veículo) ──

class StoryCreateIn(BaseModel):
    veiculo_id: str
    legenda: Optional[str] = None


@router.post("/gestor/stories", response_model=StoryOut, status_code=status.HTTP_201_CREATED)
async def criar_story(
    data: StoryCreateIn,
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    loja_id = ctx.loja_id

    # Valida veículo com foto
    v_res = await db.execute(
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == data.veiculo_id, Veiculo.loja_id == loja_id)
    )
    veiculo = v_res.scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado.")
    if not veiculo.midias:
        raise HTTPException(status_code=400, detail="Veículo precisa de pelo menos uma foto para publicar story.")

    delay = await _get_delay(db, loja_id)
    agora = _now()

    story = Story(
        loja_id=loja_id,
        veiculo_id=data.veiculo_id,
        legenda=data.legenda,
        expira_em=agora + timedelta(hours=24),
        visivel_publico_em=agora + timedelta(hours=delay),
        created_at=agora,
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)

    # Carrega relacionamentos para o response
    res = await db.execute(
        select(Story)
        .options(selectinload(Story.loja), selectinload(Story.veiculo).selectinload(Veiculo.midias))
        .where(Story.id == story.id)
    )
    return _story_to_out(res.scalar_one())


# ── Seguir / Desseguir loja ────────────────────────────────────

@router.post("/vitrine/lojas/{loja_id}/seguir", response_model=SeguirLojaOut)
async def seguir_loja(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    loja = await db.get(Loja, loja_id)
    if not loja:
        raise HTTPException(status_code=404, detail="Loja não encontrada.")

    existe = await db.execute(
        select(LojaSeguidora).where(
            LojaSeguidora.usuario_id == current_user.id,
            LojaSeguidora.loja_id == loja_id,
        )
    )
    if existe.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Já segue esta loja.")

    db.add(LojaSeguidora(usuario_id=current_user.id, loja_id=loja_id, created_at=_now()))
    await db.commit()
    return SeguirLojaOut(seguindo=True, loja_id=loja_id)


@router.delete("/vitrine/lojas/{loja_id}/seguir", response_model=SeguirLojaOut)
async def desseguir_loja(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    res = await db.execute(
        select(LojaSeguidora).where(
            LojaSeguidora.usuario_id == current_user.id,
            LojaSeguidora.loja_id == loja_id,
        )
    )
    seg = res.scalar_one_or_none()
    if not seg:
        raise HTTPException(status_code=404, detail="Não segue esta loja.")
    await db.delete(seg)
    await db.commit()
    return SeguirLojaOut(seguindo=False, loja_id=loja_id)


@router.get("/vitrine/lojas/{loja_id}/seguindo", response_model=SeguirLojaOut)
async def checar_seguindo(
    loja_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    res = await db.execute(
        select(LojaSeguidora).where(
            LojaSeguidora.usuario_id == current_user.id,
            LojaSeguidora.loja_id == loja_id,
        )
    )
    seguindo = res.scalar_one_or_none() is not None
    return SeguirLojaOut(seguindo=seguindo, loja_id=loja_id)


# ── Config da loja — delay de exclusividade ───────────────────

@router.get("/gestor/lojas/config", response_model=LojaConfigOut)
async def get_config_loja(
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    delay = await _get_delay(db, ctx.loja_id)
    return LojaConfigOut(delay_exclusividade_horas=delay)


@router.put("/gestor/lojas/config", response_model=LojaConfigOut)
async def set_config_loja(
    data: LojaConfigIn,
    db: AsyncSession = Depends(get_db),
    ctx: B2BContext = Depends(get_current_b2b_user),
):
    loja_id = ctx.loja_id

    res = await db.execute(select(LojaConfig).where(LojaConfig.loja_id == loja_id))
    cfg = res.scalar_one_or_none()
    if cfg:
        cfg.delay_exclusividade_horas = data.delay_exclusividade_horas
        cfg.updated_at = _now()
    else:
        db.add(LojaConfig(loja_id=loja_id, delay_exclusividade_horas=data.delay_exclusividade_horas, updated_at=_now()))
    await db.commit()
    return LojaConfigOut(delay_exclusividade_horas=data.delay_exclusividade_horas)
