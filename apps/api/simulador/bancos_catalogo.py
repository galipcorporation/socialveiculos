"""Catálogo único dos bancos suportados na tela de Credenciais Bancárias (login).

Fonte da verdade para front e back — evita duplicar a lista em Configuracoes.tsx.
"""

BANCOS_SUPORTADOS = [
    {"codigo": "bv", "nome": "Banco BV"},
    {"codigo": "c6", "nome": "C6 Bank"},
    {"codigo": "itau", "nome": "Itaú"},
    {"codigo": "santander", "nome": "Santander"},
]
