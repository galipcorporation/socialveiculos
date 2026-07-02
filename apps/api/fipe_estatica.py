"""
Social Veículos — Tabela FIPE Estática (MVP)
Top 50 veículos mais comuns do mercado brasileiro com valores de referência.
Dados aproximados para MVP — será substituído por API real futuramente.
"""

from typing import Optional


# Chave: (marca_lower, modelo_lower, ano) → valor_fipe em BRL
# Fonte: valores médios de mercado, apenas para referência visual.
TABELA_FIPE: dict[tuple[str, str, int], float] = {
    # ── Chevrolet ──
    ("chevrolet", "onix", 2024): 82_990,
    ("chevrolet", "onix", 2023): 74_500,
    ("chevrolet", "onix", 2022): 67_200,
    ("chevrolet", "onix", 2021): 60_800,
    ("chevrolet", "onix plus", 2024): 90_500,
    ("chevrolet", "onix plus", 2023): 82_000,
    ("chevrolet", "tracker", 2024): 119_900,
    ("chevrolet", "tracker", 2023): 105_000,
    ("chevrolet", "tracker", 2022): 95_500,
    ("chevrolet", "s10", 2024): 215_000,
    ("chevrolet", "s10", 2023): 195_000,
    ("chevrolet", "spin", 2024): 95_500,
    ("chevrolet", "spin", 2023): 86_000,
    # ── Fiat ──
    ("fiat", "argo", 2024): 77_500,
    ("fiat", "argo", 2023): 70_200,
    ("fiat", "argo", 2022): 63_800,
    ("fiat", "mobi", 2024): 62_900,
    ("fiat", "mobi", 2023): 56_500,
    ("fiat", "pulse", 2024): 99_900,
    ("fiat", "pulse", 2023): 89_500,
    ("fiat", "fastback", 2024): 115_900,
    ("fiat", "fastback", 2023): 105_000,
    ("fiat", "toro", 2024): 145_000,
    ("fiat", "toro", 2023): 128_000,
    ("fiat", "strada", 2024): 88_900,
    ("fiat", "strada", 2023): 79_500,
    ("fiat", "cronos", 2024): 82_900,
    ("fiat", "cronos", 2023): 74_500,
    # ── Volkswagen ──
    ("volkswagen", "polo", 2024): 87_990,
    ("volkswagen", "polo", 2023): 79_500,
    ("volkswagen", "virtus", 2024): 98_500,
    ("volkswagen", "virtus", 2023): 88_000,
    ("volkswagen", "t-cross", 2024): 119_500,
    ("volkswagen", "t-cross", 2023): 108_000,
    ("volkswagen", "nivus", 2024): 111_000,
    ("volkswagen", "nivus", 2023): 99_500,
    ("volkswagen", "saveiro", 2024): 82_500,
    ("volkswagen", "saveiro", 2023): 74_000,
    # ── Hyundai ──
    ("hyundai", "hb20", 2024): 78_900,
    ("hyundai", "hb20", 2023): 70_500,
    ("hyundai", "hb20", 2022): 64_000,
    ("hyundai", "hb20s", 2024): 89_900,
    ("hyundai", "hb20s", 2023): 80_500,
    ("hyundai", "creta", 2024): 119_900,
    ("hyundai", "creta", 2023): 108_000,
    ("hyundai", "tucson", 2024): 195_000,
    ("hyundai", "tucson", 2023): 175_000,
    # ── Toyota ──
    ("toyota", "corolla", 2024): 155_000,
    ("toyota", "corolla", 2023): 140_000,
    ("toyota", "corolla", 2022): 128_000,
    ("toyota", "corolla cross", 2024): 165_000,
    ("toyota", "corolla cross", 2023): 150_000,
    ("toyota", "yaris", 2023): 89_000,
    ("toyota", "yaris", 2022): 80_000,
    ("toyota", "hilux", 2024): 255_000,
    ("toyota", "hilux", 2023): 235_000,
    # ── Honda ──
    ("honda", "city", 2024): 105_000,
    ("honda", "city", 2023): 95_000,
    ("honda", "civic", 2024): 175_000,
    ("honda", "civic", 2023): 158_000,
    ("honda", "hr-v", 2024): 135_000,
    ("honda", "hr-v", 2023): 122_000,
    # ── Jeep ──
    ("jeep", "renegade", 2024): 115_000,
    ("jeep", "renegade", 2023): 103_000,
    ("jeep", "compass", 2024): 165_000,
    ("jeep", "compass", 2023): 148_000,
    # ── Renault ──
    ("renault", "kwid", 2024): 62_500,
    ("renault", "kwid", 2023): 55_500,
    ("renault", "sandero", 2024): 79_900,
    ("renault", "duster", 2024): 105_000,
    ("renault", "duster", 2023): 95_000,
    # ── Nissan ──
    ("nissan", "kicks", 2024): 109_900,
    ("nissan", "kicks", 2023): 99_000,
    # ── Caoa Chery ──
    ("caoa chery", "tiggo 5x", 2024): 99_900,
    ("caoa chery", "tiggo 7", 2024): 135_000,
}


def consultar_fipe(marca: str, modelo: str, ano: int) -> Optional[float]:
    """
    Consulta o valor FIPE estático para um veículo.
    Busca exata e depois tenta match parcial pelo modelo (ex: 'Onix Plus LTZ' → 'onix plus').
    """
    marca_l = marca.strip().lower()
    modelo_l = modelo.strip().lower()

    # Match exato
    valor = TABELA_FIPE.get((marca_l, modelo_l, ano))
    if valor:
        return valor

    # Match parcial — tenta encontrar se o modelo digitado contém alguma chave
    for (m, mod, a), val in TABELA_FIPE.items():
        if m == marca_l and a == ano:
            # "onix plus ltz" startswith "onix plus"
            if modelo_l.startswith(mod) or mod.startswith(modelo_l):
                return val

    return None
