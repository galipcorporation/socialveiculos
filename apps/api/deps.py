"""
Social Veículos — Dependências de Autenticação e Autorização (FastAPI)
"""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional

from database import get_db
from models import Usuario, MembroLoja, PapelUsuario, Loja
from auth import decode_access_token

# Esquema de token padrão para extração do header Authorization: Bearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login", auto_error=False)

credentials_exception = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Credenciais inválidas ou token expirado",
    headers={"WWW-Authenticate": "Bearer"},
)

forbidden_exception = HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Você não tem permissão para acessar este recurso",
)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Usuario:
    """Valida o token JWT e retorna o Usuário autenticado."""
    if not token:
        raise credentials_exception
        
    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception
        
    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise credentials_exception
        
    # Buscar usuário no banco
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise credentials_exception
        
    if not user.ativo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuário inativo",
        )
        
    return user


async def get_current_active_user(
    current_user: Usuario = Depends(get_current_user)
) -> Usuario:
    """Garante que o usuário está ativo (já validado em get_current_user, mas mantido por semântica)."""
    return current_user


class B2BContext:
    """Contexto contendo as informações do usuário B2B e sua respectiva loja."""
    def __init__(self, usuario: Usuario, membro: Optional[MembroLoja], loja: Optional[Loja]):
        self.usuario = usuario
        self.membro = membro
        self.loja = loja

    @property
    def loja_id(self) -> Optional[str]:
        return self.loja.id if self.loja else None


loja_nao_selecionada_exception = HTTPException(
    status_code=status.HTTP_409_CONFLICT,
    detail="Selecione uma loja para operar.",
)


async def get_current_b2b_user(
    current_user: Usuario = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    x_loja_id: Optional[str] = Header(default=None, alias="X-Loja-Id"),
) -> B2BContext:
    """
    Garante que o usuário pertence ao ecossistema B2B (Gestor, Vendedor ou Admin).

    - Admin de plataforma (suporte): opera qualquer loja ativa, escolhida via
      header ``X-Loja-Id``. Sem o header, nenhuma loja é assumida — o front deve
      exibir o seletor de loja (respondemos 409 nas rotas que exigem loja).
    - Gestor/Vendedor: fica preso ao vínculo ativo de sua própria loja.
    """
    # Clientes finais B2C não podem acessar rotas do Gestor/B2B
    if current_user.papel == PapelUsuario.CLIENTE:
        raise forbidden_exception

    # Admin de plataforma: acessa qualquer loja ativa via header X-Loja-Id.
    if current_user.papel == PapelUsuario.ADMIN_PLATAFORMA:
        if not x_loja_id:
            # Sem loja escolhida: bloqueia toda rota B2B com 409 para o front
            # abrir o seletor de loja. Rotas admin-globais (/v1/admin/*) usam
            # exige_admin_plataforma e não passam por aqui.
            raise loja_nao_selecionada_exception

        loja_res = await db.execute(
            select(Loja).where(Loja.id == x_loja_id, Loja.ativa == True)
        )
        loja = loja_res.scalar_one_or_none()
        if not loja:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Loja informada não existe ou está inativa.",
            )
        # Admin não precisa de vínculo membro_loja — opera como suporte.
        return B2BContext(usuario=current_user, membro=None, loja=loja)

    # Para gestores e vendedores, buscar o vínculo de membro ativo da loja
    stmt = (
        select(MembroLoja, Loja)
        .join(Loja, MembroLoja.loja_id == Loja.id)
        .where(
            MembroLoja.usuario_id == current_user.id,
            MembroLoja.ativo == True,
            Loja.ativa == True
        )
    )
    res = await db.execute(stmt)
    row = res.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuário B2B sem loja ativa associada.",
        )

    membro, loja = row
    return B2BContext(usuario=current_user, membro=membro, loja=loja)


def require_loja(context: B2BContext) -> Loja:
    """
    Garante que há uma loja no contexto (admin já escolheu, ou usuário B2B tem
    vínculo). Rotas que operam sobre dados de uma loja devem chamar isto para
    obter 409 (em vez de 500/None) quando o admin ainda não selecionou loja.
    """
    if context.loja is None:
        raise loja_nao_selecionada_exception
    return context.loja


async def registrar_auditoria(
    db: AsyncSession,
    loja_id: Optional[str],
    ator_id: Optional[str],
    ator_nome: Optional[str],
    acao: str,
    entidade: Optional[str],
    entidade_id: Optional[str],
    detalhes: Optional[str] = None,
    ip: Optional[str] = None
):
    """
    Registra uma ação no log de auditoria do sistema.
    """
    from models import LogAuditoria
    log = LogAuditoria(
        loja_id=loja_id,
        ator_id=ator_id,
        ator_nome=ator_nome,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        detalhes=detalhes,
        ip=ip
    )
    db.add(log)
    await db.flush()


async def get_optional_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> Optional[Usuario]:
    """Retorna o usuário se autenticado, caso contrário None (sem levantar exceção)."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        result = await db.execute(select(Usuario).where(Usuario.id == user_id))
        user = result.scalar_one_or_none()
        if user and user.ativo:
            return user
    except Exception:
        pass
    return None

