"""
Portais sem integração ativa hoje (M079 §2).

Existem para aparecer na grade com status honesto e, principalmente, para gerar
`baixa_pendente` quando o veículo é vendido — o lojista anunciou lá na mão, e
precisa ser lembrado de tirar de lá na mão.

Quando a pendência do fundador (TDD §10) for resolvida, cada um destes vira um
adapter real. A troca é local: o worker e o router não mudam.
"""

from .base import AdapterIndisponivel


class OlxAdapter(AdapterIndisponivel):
    nome = "olx"
    rotulo = "OLX"
    tipo_auth = "api_key"
    motivo = (
        "A OLX tem API de integrador, mas exige contrato comercial e token emitido por eles. "
        "Publique manualmente no site da OLX."
    )


class WebmotorsAdapter(AdapterIndisponivel):
    nome = "webmotors"
    rotulo = "Webmotors"
    motivo = (
        "A Webmotors não oferece API pública — a integração exige homologação como integrador. "
        "Publique manualmente no site da Webmotors."
    )


class ICarrosAdapter(AdapterIndisponivel):
    nome = "icarros"
    rotulo = "iCarros"
    motivo = (
        "O iCarros não oferece API pública — a integração exige homologação como integrador. "
        "Publique manualmente no site do iCarros."
    )
