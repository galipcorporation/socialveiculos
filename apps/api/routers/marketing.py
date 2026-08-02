"""
Social Veículos — Rotas de Marketing (B009)
Geração de posts/criativos a partir de um veículo do estoque, via IA da plataforma.
Protegido por paywall do Módulo MARKETING.
"""

import json
import os
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from database import get_db
from deps import get_current_b2b_user, B2BContext
from ia_client import chamar_ia
from lib_formatacao import formatar_moeda
from models import Veiculo
from modulos import exige_modulo, Modulo

router = APIRouter(prefix="/v1/marketing", tags=["Marketing"])

# IA da plataforma: Groq (Llama), API compatível com OpenAI. Mesma stack do
# Assistente do Vendedor — texto curto de anúncio não justifica modelo premium.
GROQ_MARKETING_MODEL = os.getenv("GROQ_MARKETING_MODEL", "llama-3.3-70b-versatile")

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
        ficha += f"\nPreço: {formatar_moeda(v.preco_venda)}"
    opcionais = []
    try:
        opcionais = json.loads(v.opcionais) if v.opcionais else []
    except Exception:
        opcionais = []
    if opcionais:
        ficha += "\nOpcionais: " + ", ".join(opcionais)
    return ficha


async def _chamar_ia(
    prompt_system: str,
    conteudo: str,
    loja_id: str,
    usuario_id: str,
    db: AsyncSession,
) -> str:
    """Fachada fina sobre `ia_client.chamar_ia` — a cadeia de provedores, o BYOK
    e a contagem de tokens vivem lá, compartilhados com a AURA (M124)."""
    resposta = await chamar_ia(
        db=db,
        loja_id=loja_id,
        usuario_id=usuario_id,
        funcionalidade="marketing",
        prompt_system=prompt_system,
        conteudo=conteudo,
        max_tokens=700,
        temperatura=0.7,
        json_mode=True,
        modelo_groq=GROQ_MARKETING_MODEL,
    )
    return resposta.texto


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

    # Sem loja no contexto (admin sem X-Loja-Id) o filtro por loja_id viraria
    # `IS NULL` e deixaria de isolar o tenant — corta antes de consultar.
    if not context.loja_id:
        raise HTTPException(status_code=409, detail="Selecione uma loja para gerar anúncios.")

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

    bruto = await _chamar_ia(prompt_system, conteudo, context.loja_id, context.usuario.id, db)

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
