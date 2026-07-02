"""
Social Veículos — Rotas de Marketing (B009)
Geração de posts/criativos a partir de um veículo do estoque, via Claude.
Protegido por paywall do Módulo MARKETING.
"""

import json
from typing import Optional, List

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext
from models import Veiculo, MarketingUsage
from modulos import exige_modulo, Modulo
from routers.credenciais_ia import resolver_api_key_ia

router = APIRouter(prefix="/v1/marketing", tags=["Marketing"])

# Tom/rede definem o estilo do texto gerado.
REDES = {"instagram", "facebook", "whatsapp", "olx"}
TONS = {"vendedor", "descontraido", "sofisticado", "objetivo"}

_TOM_GUIA = {
    "vendedor": "persuasivo e caloroso, com chamada para ação clara",
    "descontraido": "leve, jovem e bem-humorado, com emojis moderados",
    "sofisticado": "elegante e sóbrio, destacando exclusividade e procedência",
    "objetivo": "direto e enxuto, só os fatos que vendem",
}

_REDE_GUIA = {
    "instagram": "post de Instagram: gancho forte na 1ª linha, quebras de linha, 5-8 hashtags relevantes no fim",
    "facebook": "post de Facebook: parágrafo único envolvente, link/CTA no fim, poucas hashtags",
    "whatsapp": "mensagem de WhatsApp/Status: curta, pessoal, com emojis e CTA para chamar no chat",
    "olx": "anúncio de classificados: título objetivo + descrição com ficha técnica e diferenciais",
}


class GerarPostRequest(BaseModel):
    veiculo_id: str
    rede: str = Field("instagram")
    tom: str = Field("vendedor")
    destaques: Optional[str] = Field(None, description="Pontos que o lojista quer ressaltar")


class GerarPostResponse(BaseModel):
    texto: str
    hashtags: List[str]
    rede: str
    tom: str


def _ficha_veiculo(v: Veiculo) -> str:
    partes = [
        f"{v.marca} {v.modelo}".strip(),
        (v.versao or "").strip(),
        f"{v.ano_fabricacao}/{v.ano_modelo}" if v.ano_modelo else "",
        f"{v.km:,} km".replace(",", ".") if v.km else "",
        v.cor or "",
        v.cambio or "",
        v.combustivel or "",
    ]
    ficha = " · ".join(p for p in partes if p)
    if v.preco_venda:
        ficha += f"\nPreço: R$ {v.preco_venda:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    opcionais = []
    try:
        opcionais = json.loads(v.opcionais) if v.opcionais else []
    except Exception:
        opcionais = []
    if opcionais:
        ficha += "\nOpcionais: " + ", ".join(opcionais)
    return ficha


async def _chamar_claude(
    prompt_system: str,
    conteudo: str,
    loja_id: str,
    usuario_id: str,
    db: AsyncSession,
) -> str:
    api_key, provedor = await resolver_api_key_ia(loja_id, db)
    modelo = "claude-opus-4-8"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": modelo,
                "max_tokens": 700,
                "system": prompt_system,
                "messages": [{"role": "user", "content": conteudo}],
            },
            timeout=40.0,
        )
        resp.raise_for_status()
        data = resp.json()
        blocos = data.get("content", [])
        texto = blocos[0].get("text", "") if blocos else ""

        # Registrar consumo para billing futuro
        usage = data.get("usage", {})
        from models import CredencialIA
        from sqlalchemy.future import select as sa_select
        cred_byok = await db.scalar(
            sa_select(CredencialIA).where(
                CredencialIA.loja_id == loja_id,
                CredencialIA.provedor == provedor,
                CredencialIA.ativo == True,
            )
        )
        db.add(MarketingUsage(
            loja_id=loja_id,
            usuario_id=usuario_id,
            provedor=provedor,
            modelo=modelo,
            tokens_input=usage.get("input_tokens", 0),
            tokens_output=usage.get("output_tokens", 0),
            byok=cred_byok is not None,
        ))
        await db.commit()

        return texto


@router.post(
    "/gerar-post",
    response_model=GerarPostResponse,
    dependencies=[Depends(exige_modulo(Modulo.MARKETING))],
)
async def gerar_post(
    data: GerarPostRequest,
    db: AsyncSession = Depends(get_db),
    context: B2BContext = Depends(get_current_b2b_user),
):
    rede = data.rede if data.rede in REDES else "instagram"
    tom = data.tom if data.tom in TONS else "vendedor"

    stmt = (
        select(Veiculo)
        .options(selectinload(Veiculo.midias))
        .where(Veiculo.id == data.veiculo_id, Veiculo.loja_id == context.loja_id)
    )
    veiculo = (await db.execute(stmt)).scalar_one_or_none()
    if not veiculo:
        raise HTTPException(status_code=404, detail="Veículo não encontrado no estoque desta loja.")

    ficha = _ficha_veiculo(veiculo)
    loja_nome = context.loja.nome if context.loja else "nossa loja"

    prompt_system = (
        "Você é um redator de marketing automotivo brasileiro. Escreve anúncios que vendem carros usados, "
        "em pt-BR, sem inventar dados que não foram informados (nunca chute preço, km, ano ou opcional). "
        f"Estilo: {_TOM_GUIA[tom]}. Formato: {_REDE_GUIA[rede]}. "
        "Responda ESTRITAMENTE em JSON com as chaves: \"texto\" (string, o post pronto sem as hashtags) "
        "e \"hashtags\" (array de strings sem o caractere #). Não escreva nada fora do JSON."
    )
    conteudo = (
        f"Loja: {loja_nome}\n"
        f"Veículo:\n{ficha}\n"
    )
    if data.destaques:
        conteudo += f"\nDestaques a ressaltar: {data.destaques}\n"

    bruto = await _chamar_claude(prompt_system, conteudo, context.loja_id, context.usuario.id, db)

    # Tolerância a JSON com cercas de código.
    limpo = bruto.strip()
    if limpo.startswith("```"):
        limpo = limpo.strip("`")
        if limpo.lower().startswith("json"):
            limpo = limpo[4:]
    try:
        parsed = json.loads(limpo)
        texto = str(parsed.get("texto", "")).strip()
        hashtags = [str(h).lstrip("#").strip() for h in parsed.get("hashtags", []) if str(h).strip()]
    except Exception:
        # Fallback: usa o texto cru e extrai hashtags soltas, se houver.
        texto = bruto.strip()
        hashtags = []

    if not texto:
        raise HTTPException(status_code=502, detail="A IA não retornou conteúdo utilizável. Tente novamente.")

    return GerarPostResponse(texto=texto, hashtags=hashtags, rede=rede, tom=tom)
