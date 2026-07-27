"""
Adapter Meta (Facebook/Instagram) — M079.

Não reimplementa nada: delega para `marketing_social._publicar_na_rede`, que já
está em produção pelo M024. A credencial também é a de lá (CredencialRedeSocial),
não CredencialPortal.

Limitação da Graph API: publicação em feed/IG não tem "despublicar" equivalente
ao de um portal de classificados. Ao vender, o post vira baixa manual — o
worker trata `sucesso=False` com `manual=True` como `baixa_pendente`.
"""

from typing import Optional

from .base import PayloadAnuncio, PortalResultado


class _MetaBase:
    disponivel = True
    requer_parceria = False
    tipo_auth = "oauth"
    rede: str = ""

    async def testar_conexao(self, cred) -> PortalResultado:
        if not cred:
            return PortalResultado(sucesso=False, erro="Conta não conectada.")
        if self.rede == "facebook" and not getattr(cred, "page_id", None):
            return PortalResultado(sucesso=False, erro="Nenhuma página do Facebook selecionada.")
        if self.rede == "instagram" and not getattr(cred, "instagram_account_id", None):
            return PortalResultado(sucesso=False, erro="Conta do Instagram Business não vinculada à página.")
        return PortalResultado(sucesso=True)

    def _legenda(self, payload: PayloadAnuncio) -> str:
        linhas = [payload.titulo]
        if payload.preco:
            from lib_formatacao import formatar_moeda
            linhas.append(formatar_moeda(payload.preco))
        if payload.km:
            linhas.append(f"{payload.km:,} km".replace(",", "."))
        if payload.descricao:
            linhas.append("")
            linhas.append(payload.descricao)
        return "\n".join(linhas)

    async def publicar(self, payload: PayloadAnuncio, cred) -> PortalResultado:
        from routers.marketing_social import _publicar_na_rede

        foto = payload.fotos[0] if payload.fotos else None
        r = await _publicar_na_rede(self.rede, self._legenda(payload), foto, cred)
        if r.get("sucesso"):
            return PortalResultado(sucesso=True)
        return PortalResultado(sucesso=False, erro=r.get("erro", "Falha ao publicar."))

    async def atualizar(self, payload: PayloadAnuncio, cred, anuncio_externo_id: str) -> PortalResultado:
        # Post de rede social não se edita como anúncio de classificado:
        # a atualização é uma nova publicação.
        return await self.publicar(payload, cred)

    async def despublicar(self, cred, anuncio_externo_id: Optional[str]) -> PortalResultado:
        return PortalResultado(
            sucesso=False,
            erro="Post de rede social não é removido automaticamente — apague a publicação manualmente.",
        )


class FacebookAdapter(_MetaBase):
    nome = "facebook"
    rotulo = "Facebook"
    rede = "facebook"


class InstagramAdapter(_MetaBase):
    nome = "instagram"
    rotulo = "Instagram"
    rede = "instagram"
