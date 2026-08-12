#!/usr/bin/env python3
"""Gera os assets de splash e de icone do app mobile a partir de assets/logo.png.

Saidas (apps/mobile/assets/):
  splash-icon.png             lockup colorido, fundo transparente -> splash tema claro
  splash-icon-dark.png        lockup em branco/vermelho           -> splash tema escuro
  icon.png                    tile navy full-bleed, sem alfa      -> icone iOS/geral
  android-icon-foreground.png marca em branco/vermelho            -> adaptive icon
  android-icon-background.png tile navy chapado                   -> adaptive icon
  favicon.png                 tile navy 48px                      -> web

O fundo branco vira transparencia por uma rampa suave de cobertura, o que
preserva o antialiasing original do desenho. A origem e logo.png (marca sobre
papel branco) e nao splash-icon.png: as versoes anteriores foram recortadas em
cima de uma arte que ja tinha uma placa clara embutida, e o que sobrava era o
halo dessa placa - o "quadrado" que aparecia atras da marca.

Os icones sao full-bleed no navy da marca em vez de logo sobre chapa branca,
que era o que fazia o app aparecer como um quadrado branco flutuando sobre a
interface escura.

Uso: python3 scripts/gerar-splash-assets.py
"""

from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[1]
ASSETS = RAIZ / "apps" / "mobile" / "assets"
ORIGEM = ASSETS / "logo.png"

# Marca + assinatura "SOCIAL VEICULOS"; o slogan miudo fica de fora porque na
# largura da splash (~240dp) ele virava um borrao.
RECORTE = (215, 296, 1066, 950)  # left, top, right, bottom
# So o simbolo do carro: em tamanho de icone a assinatura vira ilegivel.
RECORTE_MARCA = (239, 296, 1066, 702)
MARGEM = 0.04  # respiro proporcional ao redor da marca
LADO = 1024

# Navy da propria marca (mediana dos azuis do logo ~ #0b1f47), com um degrade
# vertical discreto para o tile nao ficar chapado demais.
NAVY_TOPO = (0x14, 0x30, 0x60)
NAVY_BASE = (0x08, 0x16, 0x33)
# O icone do Android e mascarado em circulo e ainda sofre parallax: so os ~66%
# centrais sao garantidos, entao a marca ocupa bem menos que no tile do iOS.
OCUPACAO_IOS = 0.68
OCUPACAO_ANDROID = 0.52
# O "branco" de logo.png nao e puro: tem ruido de compressao por volta de #fdfdfc.
# Sem o piso esse ruido virava alfa residual e reaparecia como uma placa
# retangular atras da marca - o quadrado que se via na abertura do app.
PISO = 0.06  # abaixo disso e fundo: transparencia total
RAMPA = 0.22  # acima disso e tinta: opacidade total


def _recortar_fundo(rgb: Image.Image) -> np.ndarray:
    """RGBA float 0..1 com o fundo branco removido e as bordas suavizadas.

    A arte vem composta sobre branco, entao a cobertura de cada pixel e
    estimada pela distancia ate o branco e a mistura e revertida em seguida.
    Isso preserva o antialiasing do desenho e evita halo claro no tema escuro.
    Como o criterio nao depende de conectividade, os vazados fechados (o miolo
    dos "O" de SOCIAL e VEICULOS) tambem ficam transparentes.
    """
    cor = np.array(rgb).astype(np.float64) / 255.0
    distancia = 1.0 - cor.min(axis=2)
    alfa = np.clip((distancia - PISO) / (RAMPA - PISO), 0.0, 1.0)

    seguro = np.maximum(alfa, 1e-6)[..., None]
    cor = np.clip((cor - (1.0 - seguro)) / seguro, 0.0, 1.0)
    cor = np.where(alfa[..., None] > 0, cor, 0.0)
    return np.dstack([cor, alfa])


def _versao_escura(rgba: np.ndarray) -> np.ndarray:
    """Azul-marinho vira branco; o vermelho da marca continua vermelho.

    Sobre #121315 o azul original tem contraste perto de 1:1 - era por isso que
    a marca so aparecia quando havia uma placa clara atras dela.
    """
    cor = rgba[..., :3].copy()
    r, g, b = cor[..., 0], cor[..., 1], cor[..., 2]
    maximo = cor.max(axis=2)
    minimo = cor.min(axis=2)
    saturacao = np.where(maximo > 0, (maximo - minimo) / np.maximum(maximo, 1e-6), 0.0)

    vermelho = (r >= g) & (r >= b) & (r - b > 0.10) & (saturacao > 0.25)
    # Mantem o gradiente do desenho, so reposiciona a faixa de luminancia.
    claro = 0.72 + 0.28 * maximo
    novo = np.dstack([claro, claro, claro])
    realce = np.dstack([np.clip(r * 1.25 + 0.20, 0, 1), g * 0.75, b * 0.75])
    saida = np.where(vermelho[..., None], realce, novo)
    return np.dstack([saida, rgba[..., 3]])


def _para_imagem(rgba: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), "RGBA")


def _enquadrar(rgba: np.ndarray, lado: int = LADO, ocupacao: float = 1 - 2 * MARGEM) -> Image.Image:
    """Encaixa a marca num quadrado de `lado` px preservando a proporcao."""
    imagem = _para_imagem(rgba)
    caixa = imagem.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    imagem = imagem.crop(caixa)

    util = int(lado * ocupacao)
    escala = min(util / imagem.width, util / imagem.height)
    destino = (max(1, round(imagem.width * escala)), max(1, round(imagem.height * escala)))

    # Reducao em alfa pre-multiplicado; sem isso o RGB dos pixels transparentes
    # vaza para dentro da borda e cria contorno claro no tema escuro.
    origem = np.array(imagem).astype(np.float64) / 255.0
    origem[..., :3] *= origem[..., 3:4]
    reduzida = np.array(
        Image.fromarray((origem * 255).round().astype(np.uint8), "RGBA").resize(destino, Image.LANCZOS)
    ).astype(np.float64) / 255.0
    alfa = np.maximum(reduzida[..., 3:4], 1e-6)
    reduzida[..., :3] = np.clip(reduzida[..., :3] / alfa, 0.0, 1.0)

    tela = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    tela.paste(_para_imagem(reduzida), ((lado - destino[0]) // 2, (lado - destino[1]) // 2))
    return tela


def _tile_navy(lado: int, chapado: bool = False) -> Image.Image:
    """Fundo navy full-bleed do icone."""
    if chapado:
        # O adaptive icon do Android desloca o fundo no parallax, entao ali o
        # degrade denunciaria o movimento: usa o tom medio do mesmo navy.
        medio = tuple((NAVY_TOPO[i] + NAVY_BASE[i]) // 2 for i in range(3))
        return Image.new("RGBA", (lado, lado), medio + (255,))
    rampa = np.linspace(0.0, 1.0, lado)[:, None]
    canais = [NAVY_TOPO[i] + (NAVY_BASE[i] - NAVY_TOPO[i]) * rampa for i in range(3)]
    coluna = np.dstack(canais + [np.full_like(rampa, 255.0)])
    return Image.fromarray(np.repeat(coluna, lado, axis=1).round().astype(np.uint8), "RGBA")


def _icone(marca: np.ndarray, lado: int, ocupacao: float) -> Image.Image:
    """Marca clara sobre o tile navy, sem alfa (a App Store recusa icone com alfa)."""
    tile = _tile_navy(lado)
    tile.alpha_composite(_enquadrar(marca, lado, ocupacao))
    return tile.convert("RGB")


def main() -> None:
    origem = Image.open(ORIGEM).convert("RGB")

    lockup = _recortar_fundo(origem.crop(RECORTE))
    marca_clara = _versao_escura(_recortar_fundo(origem.crop(RECORTE_MARCA)))

    saidas = {
        "splash-icon.png": _enquadrar(lockup),
        "splash-icon-dark.png": _enquadrar(_versao_escura(lockup)),
        "icon.png": _icone(marca_clara, LADO, OCUPACAO_IOS),
        "android-icon-foreground.png": _enquadrar(marca_clara, 512, OCUPACAO_ANDROID),
        "android-icon-background.png": _tile_navy(512, chapado=True),
        # O favicon antigo tinha 48px e o desenho do carro sumia na reducao;
        # sai maior e mais preenchido para o browser ter o que reamostrar.
        "favicon.png": _icone(marca_clara, 192, 0.80),
    }
    for nome, imagem in saidas.items():
        imagem.save(ASSETS / nome)
        print(f"gerado: {ASSETS / nome}")


if __name__ == "__main__":
    main()
