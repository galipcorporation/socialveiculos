"""
Social Veículos — Seed Script
Popula o banco com:
  1. Catálogo FIPE (marcas + modelos brasileiros)
  2. 1 loja demo
  3. 1 gestor + 1 vendedor
  4. Veículos de teste variados
  5. 1 plano de assinatura
"""

import asyncio
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.future import select

from database import async_session, create_all_tables
from models import (
    CatalogoMarca,
    CatalogoModelo,
    Loja,
    Usuario,
    MembroLoja,
    Veiculo,
    Plano,
    Assinatura,
    ModuloHabilitado,
    PapelUsuario,
    StatusVeiculo,
    StatusAssinatura,
    TipoCambio,
    TipoCombustivel,
)


def _uuid() -> str:
    return str(uuid4())


# ═══════════════════════════════════════════════════════════════
# CATÁLOGO FIPE — Marcas e modelos do mercado brasileiro
# ═══════════════════════════════════════════════════════════════
CATALOGO_FIPE: dict[str, list[str]] = {
    "Chevrolet": [
        "Onix", "Onix Plus", "Tracker", "S10", "Spin", "Cruze",
        "Montana", "Equinox", "Trailblazer", "Bolt EV",
    ],
    "Volkswagen": [
        "Gol", "Polo", "Virtus", "T-Cross", "Nivus", "Taos",
        "Saveiro", "Amarok", "Tiguan", "Jetta",
    ],
    "Fiat": [
        "Argo", "Cronos", "Mobi", "Strada", "Toro", "Pulse",
        "Fastback", "Uno", "Fiorino", "Ducato",
    ],
    "Toyota": [
        "Corolla", "Corolla Cross", "Hilux", "SW4", "Yaris",
        "RAV4", "Camry", "Land Cruiser", "Prius",
    ],
    "Honda": [
        "Civic", "HR-V", "City", "Fit", "CR-V", "ZR-V",
        "Accord", "WR-V",
    ],
    "Hyundai": [
        "HB20", "HB20S", "Creta", "Tucson", "Santa Fe",
        "HB20X", "ix35", "Azera", "IONIQ 5",
    ],
    "Jeep": [
        "Renegade", "Compass", "Commander", "Wrangler",
        "Grand Cherokee", "Gladiator",
    ],
    "Renault": [
        "Kwid", "Sandero", "Logan", "Duster", "Oroch",
        "Captur", "Kardian", "Master",
    ],
    "Ford": [
        "Ranger", "Territory", "Bronco Sport", "Bronco",
        "Maverick", "Mustang", "Edge",
    ],
    "Nissan": [
        "Kicks", "Versa", "Sentra", "Frontier", "X-Trail",
        "Leaf",
    ],
    "BMW": [
        "Série 1", "Série 3", "Série 5", "X1", "X3", "X5",
        "320i", "330i", "520i", "iX",
    ],
    "Mercedes-Benz": [
        "Classe A", "Classe C", "Classe E", "GLA", "GLB",
        "GLC", "GLE", "EQA", "EQC",
    ],
    "Audi": [
        "A3", "A4", "A5", "Q3", "Q5", "Q7", "Q8",
        "e-tron", "RS3", "RS5",
    ],
    "Peugeot": [
        "208", "2008", "3008", "5008", "Partner", "Expert",
    ],
    "Citroën": [
        "C3", "C4 Cactus", "C5 Aircross", "Berlingo", "Jumpy",
    ],
    "Mitsubishi": [
        "L200 Triton", "Outlander", "Eclipse Cross", "ASX",
        "Pajero Sport", "Pajero Full",
    ],
    "Kia": [
        "Sportage", "Seltos", "Cerato", "Carnival", "Stonic",
        "EV6", "Sorento",
    ],
    "Caoa Chery": [
        "Tiggo 2", "Tiggo 3X", "Tiggo 5X", "Tiggo 7",
        "Tiggo 8", "Arrizo 6",
    ],
    "Ram": [
        "Rampage", "1500", "2500", "3500", "Classic",
    ],
    "Volvo": [
        "XC40", "XC60", "XC90", "C40", "S60", "V60",
    ],
    "Land Rover": [
        "Discovery Sport", "Range Rover Evoque",
        "Range Rover Sport", "Defender", "Range Rover Velar",
    ],
    "Porsche": [
        "Cayenne", "Macan", "911 Carrera", "Taycan",
        "Panamera", "718 Cayman",
    ],
    "BYD": [
        "Dolphin", "Seal", "Yuan Plus", "Song Plus", "Tan",
        "Han", "King",
    ],
    "GWM": [
        "Haval H6", "Haval Jolion", "Ora 03", "Tank 300",
    ],
}


# ═══════════════════════════════════════════════════════════════
# VEÍCULOS DEMO
# ═══════════════════════════════════════════════════════════════
VEICULOS_DEMO = [
    {
        "marca": "Porsche", "modelo": "911 Carrera S", "versao": "3.0 H6 Turbo",
        "ano_fabricacao": 2024, "ano_modelo": 2025, "km": 1200, "cor": "Branco",
        "cambio": TipoCambio.AUTOMATICO, "combustivel": TipoCombustivel.GASOLINA,
        "tipo": "esportivo", "portas": 2, "preco_venda": 1250000.00, "preco_custo": 1100000.00,
        "status": StatusVeiculo.DISPONIVEL, "publicado_marketplace": True,
        "descricao": "Porsche 911 Carrera S impecável, único dono, revisões na concessionária.",
        "imagem_url": "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=800&auto=format&fit=crop",
    },
    {
        "marca": "Toyota", "modelo": "Hilux SRX Plus", "versao": "2.8 4×4 CD Diesel Aut.",
        "ano_fabricacao": 2023, "ano_modelo": 2024, "km": 15400, "cor": "Cinza",
        "cambio": TipoCambio.AUTOMATICO, "combustivel": TipoCombustivel.DIESEL,
        "tipo": "pickup", "portas": 4, "preco_venda": 335900.00, "preco_custo": 295000.00,
        "status": StatusVeiculo.RESERVADO, "publicado_marketplace": True,
        "descricao": "Hilux SRX Plus completa, bancos em couro, rodas 18\".",
        "imagem_url": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop",
    },
    {
        "marca": "BMW", "modelo": "320i M Sport", "versao": "2.0 TwinPower Turbo",
        "ano_fabricacao": 2022, "ano_modelo": 2023, "km": 28000, "cor": "Preto",
        "cambio": TipoCambio.AUTOMATICO, "combustivel": TipoCombustivel.GASOLINA,
        "tipo": "sedan", "portas": 4, "preco_venda": 305000.00, "preco_custo": 270000.00,
        "status": StatusVeiculo.VENDIDO, "publicado_marketplace": False,
        "descricao": "BMW 320i M Sport, teto solar panorâmico, interior caramelo.",
        "imagem_url": "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&auto=format&fit=crop",
    },
    {
        "marca": "Jeep", "modelo": "Compass Longitude", "versao": "1.3 T270 Turbo Flex Aut.",
        "ano_fabricacao": 2023, "ano_modelo": 2023, "km": 8500, "cor": "Vermelho",
        "cambio": TipoCambio.AUTOMATICO, "combustivel": TipoCombustivel.FLEX,
        "tipo": "suv", "portas": 4, "preco_venda": 165900.00, "preco_custo": 145000.00,
        "status": StatusVeiculo.DISPONIVEL, "publicado_marketplace": True,
        "descricao": "Jeep Compass Longitude T270, multimídia 10\", câmera 360°.",
        "imagem_url": "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=800&auto=format&fit=crop",
    },
    {
        "marca": "Honda", "modelo": "Civic Touring", "versao": "1.5 Turbo CVT",
        "ano_fabricacao": 2021, "ano_modelo": 2022, "km": 25000, "cor": "Azul Cósmico",
        "cambio": TipoCambio.CVT, "combustivel": TipoCombustivel.GASOLINA,
        "tipo": "sedan", "portas": 4, "preco_venda": 175900.00, "preco_custo": 155000.00,
        "status": StatusVeiculo.DISPONIVEL, "publicado_marketplace": True,
        "descricao": "Honda Civic Touring 1.5 Turbo, apenas 25 mil km, IPVA pago.",
        "imagem_url": "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=800&auto=format&fit=crop",
    },
    {
        "marca": "Volkswagen", "modelo": "T-Cross Highline", "versao": "1.4 TSI Flex Aut.",
        "ano_fabricacao": 2023, "ano_modelo": 2024, "km": 12000, "cor": "Branco",
        "cambio": TipoCambio.AUTOMATICO, "combustivel": TipoCombustivel.FLEX,
        "tipo": "suv", "portas": 4, "preco_venda": 149900.00, "preco_custo": 130000.00,
        "status": StatusVeiculo.DISPONIVEL, "publicado_marketplace": True,
        "descricao": "T-Cross Highline 1.4 TSI, teto solar, ACC, assistente de faixa.",
        "imagem_url": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800&auto=format&fit=crop",
    },
]


# ═══════════════════════════════════════════════════════════════
# SEED
# ═══════════════════════════════════════════════════════════════

async def seed():
    """Popula o banco com dados iniciais."""
    print("\n[SEED] Iniciando seed do banco de dados...\n")

    await create_all_tables()
    print("  [OK] Tabelas criadas")

    async with async_session() as session:
        # ── 1. Catálogo FIPE ───────────────────────────────────
        total_marcas = 0
        total_modelos = 0

        for marca_nome, modelos in CATALOGO_FIPE.items():
            marca = CatalogoMarca(nome=marca_nome)
            session.add(marca)
            await session.flush()  # gerar o ID
            total_marcas += 1

            for modelo_nome in modelos:
                session.add(CatalogoModelo(marca_id=marca.id, nome=modelo_nome))
                total_modelos += 1

        await session.commit()
        print(f"  [OK] Catalogo FIPE: {total_marcas} marcas, {total_modelos} modelos")

        # ── 2. Loja demo ──────────────────────────────────────
        loja_id = _uuid()
        loja = Loja(
            id=loja_id,
            nome="Auto Premium",
            slug="auto-premium",
            cnpj="12.345.678/0001-90",
            telefone="(11) 99999-0001",
            whatsapp="5511999990001",
            email="contato@autopremium.com.br",
            endereco="Av. Brasil, 1000",
            cidade="São Paulo",
            estado="SP",
            cep="01000-000",
            verificada=True,
        )
        session.add(loja)
        print("  [OK] Loja demo: Auto Premium")

        # ── 3. Usuários ───────────────────────────────────────
        from auth import hash_password
        senha_hash = hash_password("demo123")

        # Owner / admin_plataforma (idempotente)
        res_owner = await session.execute(
            select(Usuario).where(Usuario.email == "victorbelocorreia@gmail.com")
        )
        if not res_owner.scalar_one_or_none():
            import os
            owner_senha = os.environ.get("OWNER_SENHA", "admin123")
            session.add(Usuario(
                id=_uuid(),
                nome="Victor Belo",
                email="victorbelocorreia@gmail.com",
                senha_hash=hash_password(owner_senha),
                papel=PapelUsuario.ADMIN_PLATAFORMA,
                ativo=True,
            ))
            print("  [OK] Owner admin_plataforma criado (victorbelocorreia@gmail.com)")
        else:
            print("  [--] Owner ja existe, pulando")

        gestor_id = _uuid()
        gestor = Usuario(
            id=gestor_id,
            nome="Victor Hugo",
            email="gestor@autopremium.com.br",
            telefone="(11) 99999-0001",
            senha_hash=senha_hash,
            papel=PapelUsuario.GESTOR,
        )
        session.add(gestor)

        vendedor_id = _uuid()
        vendedor = Usuario(
            id=vendedor_id,
            nome="Carlos Silva",
            email="carlos@autopremium.com.br",
            telefone="(11) 99999-0002",
            senha_hash=senha_hash,
            papel=PapelUsuario.VENDEDOR,
        )
        session.add(vendedor)

        # Vínculos loja↔usuario
        session.add(MembroLoja(usuario_id=gestor_id, loja_id=loja_id, papel=PapelUsuario.GESTOR))
        session.add(MembroLoja(
            usuario_id=vendedor_id,
            loja_id=loja_id,
            papel=PapelUsuario.VENDEDOR,
            modulos='["estoque","clientes","negociacoes"]',
        ))
        print("  [OK] Usuarios: gestor + vendedor")

        # ── 4. Veículos demo ──────────────────────────────────
        from models import Midia, TipoMidia
        for v_orig in VEICULOS_DEMO:
            v = v_orig.copy()
            img_url = v.pop("imagem_url", None)
            veiculo = Veiculo(loja_id=loja_id, **v)
            session.add(veiculo)
            await session.flush()
            if img_url:
                session.add(Midia(
                    veiculo_id=veiculo.id,
                    tipo=TipoMidia.FOTO,
                    url=img_url,
                    ordem=0
                ))

        print(f"  [OK] Veiculos: {len(VEICULOS_DEMO)} veiculos de teste")

        # ── 5. Planos + Assinatura ────────────────────────────
        session.add(Plano(
            id=_uuid(),
            nome="Básico",
            descricao="Gestão de estoque e CRM, sem módulos premium",
            preco_mensal=99.90,
            modulos_incluidos='[]',
        ))
        plano_id = _uuid()
        session.add(Plano(
            id=plano_id,
            nome="Profissional",
            descricao="Gestão completa + todos os módulos premium",
            preco_mensal=299.90,
            modulos_incluidos='["contratos","simulador","marketing","assistente_ia"]',
        ))

        session.add(Assinatura(
            loja_id=loja_id,
            plano_id=plano_id,
            status=StatusAssinatura.ATIVA,
        ))

        for modulo in ["contratos", "simulador", "marketing", "assistente_ia"]:
            session.add(ModuloHabilitado(loja_id=loja_id, nome_modulo=modulo))

        print("  [OK] Plano Profissional + assinatura ativa")

        await session.commit()

    print("\n[DONE] Seed concluido com sucesso!\n")


# ── Entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    asyncio.run(seed())
