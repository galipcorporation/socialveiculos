"""
AURA — passos 2 a 5 da busca: estoque próprio, relaxamento, repasse, proximidade.

Consultas determinísticas, sem IA. O número que a AURA fala tem que ser o mesmo
que a tela de Estoque mostra. Toda consulta nasce filtrada pela loja do contexto
e pelo escopo do papel — a frase do usuário nunca escolhe o escopo.
"""

import json
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from aura.interpretador import CriteriosBusca
from aura.permissoes import EscopoAura
from models import Loja, PublicacaoB2B, StatusVeiculo, Veiculo

# Ordem de relaxamento (passo 3). Nunca se afrouxa preço para cima e nunca se
# troca o segmento do veículo.
RELAXAMENTOS = [
    ("cor", "a cor"),
    ("km_max", "a quilometragem (30% a mais)"),
    ("ano", "o ano (um para cada lado)"),
    ("versao", "a versão dentro do mesmo modelo"),
]

LIMITE_RESULTADOS = 8


@dataclass
class VeiculoEncontrado:
    id: str
    marca: str
    modelo: str
    versao: Optional[str]
    ano_fabricacao: int
    ano_modelo: int
    km: Optional[int]
    cor: Optional[str]
    cambio: Optional[str]
    combustivel: Optional[str]
    preco_venda: Optional[float]
    preco_custo: Optional[float]          # só preenchido se o escopo permite
    dias_em_estoque: Optional[int] = None
    # Repasse
    loja_nome: Optional[str] = None
    loja_cidade: Optional[str] = None
    loja_estado: Optional[str] = None
    valor_repasse: Optional[float] = None
    publicacao_id: Optional[str] = None


@dataclass
class ResultadoBusca:
    proprios: list[VeiculoEncontrado] = field(default_factory=list)
    parceiros: list[VeiculoEncontrado] = field(default_factory=list)
    relaxamentos_aplicados: list[str] = field(default_factory=list)
    criterios_usados: dict = field(default_factory=dict)
    total_proprios_sem_filtro: int = 0

    def para_auditoria(self) -> dict:
        """O que foi consultado — é isso que responde 'por que a AURA disse isso?'."""
        return {
            "criterios": self.criterios_usados,
            "relaxamentos": self.relaxamentos_aplicados,
            "achados_proprios": len(self.proprios),
            "achados_parceiros": len(self.parceiros),
        }


def _enum_valor(campo) -> Optional[str]:
    return campo.value if campo is not None else None


def _dias_em_estoque(veiculo: Veiculo) -> Optional[int]:
    if not veiculo.created_at:
        return None
    from models import utcnow
    return max((utcnow() - veiculo.created_at).days, 0)


def _do_veiculo(v: Veiculo, *, escopo: EscopoAura) -> VeiculoEncontrado:
    return VeiculoEncontrado(
        id=v.id,
        marca=v.marca,
        modelo=v.modelo,
        versao=v.versao,
        ano_fabricacao=v.ano_fabricacao,
        ano_modelo=v.ano_modelo,
        km=v.km,
        cor=v.cor,
        cambio=_enum_valor(v.cambio),
        combustivel=_enum_valor(v.combustivel),
        preco_venda=v.preco_venda,
        # Preço de custo e margem estão fora para quem não tem o módulo — a
        # AURA não alarga o que a tela já esconde (seção 12).
        preco_custo=v.preco_custo if escopo.ve_custo_e_margem else None,
        dias_em_estoque=_dias_em_estoque(v),
    )


def _aplicar_filtros(stmt, c: CriteriosBusca, *, tabela=Veiculo):
    """Filtros de veículo comuns ao estoque próprio e ao feed de repasse."""
    if c.marca:
        stmt = stmt.where(tabela.marca.ilike(f"%{c.marca}%"))
    if c.modelo:
        stmt = stmt.where(tabela.modelo.ilike(f"%{c.modelo}%"))
    if c.versao:
        stmt = stmt.where(tabela.versao.ilike(f"%{c.versao}%"))
    if c.ano_min:
        stmt = stmt.where(tabela.ano_modelo >= c.ano_min)
    if c.ano_max:
        stmt = stmt.where(tabela.ano_modelo <= c.ano_max)
    if c.km_max:
        stmt = stmt.where(tabela.km <= c.km_max)
    if c.cor:
        stmt = stmt.where(tabela.cor.ilike(f"%{c.cor}%"))
    if c.cambio:
        stmt = stmt.where(tabela.cambio == c.cambio)
    if c.combustivel:
        stmt = stmt.where(tabela.combustivel == c.combustivel)
    if c.carroceria:
        stmt = stmt.where(tabela.carroceria.ilike(f"%{c.carroceria}%"))
    if c.tipo:
        stmt = stmt.where(tabela.tipo.ilike(f"%{c.tipo}%"))
    return stmt


def _copiar_relaxado(c: CriteriosBusca, passo: str) -> CriteriosBusca:
    novo = CriteriosBusca(**{**c.__dict__, "opcionais": list(c.opcionais)})
    if passo == "cor":
        novo.cor = None
    elif passo == "km_max" and novo.km_max:
        novo.km_max = int(novo.km_max * 1.3)
    elif passo == "ano":
        if novo.ano_min:
            novo.ano_min -= 1
        if novo.ano_max:
            novo.ano_max += 1
    elif passo == "versao":
        novo.versao = None
    return novo


def _casa_opcionais(v: Veiculo, desejados: list[str]) -> bool:
    """Opcional é texto livre em JSON — comparação por conteúdo, não por igualdade."""
    if not desejados:
        return True
    try:
        lista = json.loads(v.opcionais) if v.opcionais else []
    except (ValueError, TypeError):
        lista = []
    disponiveis = " ".join(str(o).lower() for o in lista)
    return all(d.lower() in disponiveis for d in desejados)


async def _buscar_estoque(
    db: AsyncSession, loja_id: str, c: CriteriosBusca, escopo: EscopoAura,
) -> list[VeiculoEncontrado]:
    stmt = select(Veiculo).where(
        Veiculo.loja_id == loja_id,
        Veiculo.status.in_([StatusVeiculo.DISPONIVEL, StatusVeiculo.RESERVADO, StatusVeiculo.REPASSE]),
    )
    stmt = _aplicar_filtros(stmt, c)
    if c.preco_max:
        stmt = stmt.where(Veiculo.preco_venda <= c.preco_max)
    if c.preco_min:
        stmt = stmt.where(Veiculo.preco_venda >= c.preco_min)

    res = await db.execute(stmt.order_by(Veiculo.preco_venda.asc()).limit(LIMITE_RESULTADOS * 3))
    achados = [v for v in res.scalars().all() if _casa_opcionais(v, c.opcionais)]
    return [_do_veiculo(v, escopo=escopo) for v in achados[:LIMITE_RESULTADOS]]


async def _buscar_repasse(
    db: AsyncSession, loja_id: str, loja: Optional[Loja], c: CriteriosBusca, escopo: EscopoAura,
) -> list[VeiculoEncontrado]:
    """
    Feed de repasse dos parceiros, com os critérios ORIGINAIS (não os relaxados).

    Mesma regra do `GET /v1/b2b/repasses`: publicação ativa, veículo em REPASSE e
    a própria loja fora do resultado. Custo e margem do parceiro nunca entram —
    só o valor que ele mesmo publicou.
    """
    stmt = (
        select(PublicacaoB2B, Veiculo, Loja)
        .join(Veiculo, PublicacaoB2B.veiculo_id == Veiculo.id)
        .join(Loja, PublicacaoB2B.loja_id == Loja.id)
        .where(
            PublicacaoB2B.ativa == True,  # noqa: E712 — SQLAlchemy
            Veiculo.status == StatusVeiculo.REPASSE,
            PublicacaoB2B.loja_id != loja_id,
        )
    )
    stmt = _aplicar_filtros(stmt, c)
    if c.preco_max:
        stmt = stmt.where(or_(
            PublicacaoB2B.valor_repasse <= c.preco_max,
            and_(PublicacaoB2B.valor_repasse.is_(None), Veiculo.preco_venda <= c.preco_max),
        ))

    res = await db.execute(stmt.order_by(PublicacaoB2B.created_at.desc()).limit(LIMITE_RESULTADOS * 3))
    linhas = res.all()

    cidade_minha = (loja.cidade or "").strip().lower() if loja else ""
    estado_meu = (loja.estado or "").strip().upper() if loja else ""

    encontrados: list[tuple[int, VeiculoEncontrado]] = []
    for pub, veiculo, loja_parceira in linhas:
        if not _casa_opcionais(veiculo, c.opcionais):
            continue
        item = _do_veiculo(veiculo, escopo=escopo)
        # Margem de terceiro está fora, sempre — mesmo para o gestor.
        item.preco_custo = None
        item.loja_nome = loja_parceira.nome
        item.loja_cidade = loja_parceira.cidade
        item.loja_estado = loja_parceira.estado
        item.valor_repasse = pub.valor_repasse if pub.valor_repasse is not None else veiculo.preco_venda
        item.publicacao_id = pub.id

        # Passo 5, v1: proximidade por cidade → estado → resto do país. A loja não
        # tem coordenada no banco; distância real depende de geocodificar o CEP
        # (decisão registrada na seção 14 da spec, prevista para a v2).
        cidade_dele = (loja_parceira.cidade or "").strip().lower()
        estado_dele = (loja_parceira.estado or "").strip().upper()
        if cidade_minha and cidade_dele == cidade_minha:
            proximidade = 0
        elif estado_meu and estado_dele == estado_meu:
            proximidade = 1
        else:
            proximidade = 2
        encontrados.append((proximidade, item))

    encontrados.sort(key=lambda par: (par[0], par[1].valor_repasse or 0))
    return [item for _, item in encontrados[:LIMITE_RESULTADOS]]


async def buscar_veiculos(
    *,
    db: AsyncSession,
    loja_id: str,
    loja: Optional[Loja],
    criterios: CriteriosBusca,
    escopo: EscopoAura,
) -> ResultadoBusca:
    """Passos 2 a 5: estoque próprio, relaxamento se preciso, e repasse de parceiros."""
    resultado = ResultadoBusca(criterios_usados=criterios.para_dict())

    total_res = await db.execute(
        select(Veiculo.id).where(
            Veiculo.loja_id == loja_id,
            Veiculo.status.in_([StatusVeiculo.DISPONIVEL, StatusVeiculo.RESERVADO, StatusVeiculo.REPASSE]),
        )
    )
    resultado.total_proprios_sem_filtro = len(total_res.scalars().all())

    resultado.proprios = await _buscar_estoque(db, loja_id, criterios, escopo)

    # Passo 3 — relaxar, acumulando, e sempre dizendo o que foi afrouxado.
    if not resultado.proprios:
        relaxado = criterios
        for passo, rotulo in RELAXAMENTOS:
            if passo == "cor" and not relaxado.cor:
                continue
            if passo == "km_max" and not relaxado.km_max:
                continue
            if passo == "ano" and not (relaxado.ano_min or relaxado.ano_max):
                continue
            if passo == "versao" and not relaxado.versao:
                continue
            relaxado = _copiar_relaxado(relaxado, passo)
            resultado.relaxamentos_aplicados.append(rotulo)
            resultado.proprios = await _buscar_estoque(db, loja_id, relaxado, escopo)
            if resultado.proprios:
                resultado.criterios_usados = relaxado.para_dict()
                break

    # Passo 4 — parceiros, com os critérios ORIGINAIS. É o contraste que produz a
    # resposta boa: "o seu não bate, mas o do parceiro bate".
    resultado.parceiros = await _buscar_repasse(db, loja_id, loja, criterios, escopo)

    return resultado
