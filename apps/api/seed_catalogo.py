"""
Social Veículos — Seed do Catálogo Canônico (Marcas e Modelos)
Popula as tabelas catalogo_marca e catalogo_modelo com dados realistas.
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from database import async_session, create_all_tables
from models import CatalogoMarca, CatalogoModelo
from sqlalchemy.future import select

# ── Top 30 marcas brasileiras + modelos populares ──
CATALOGO = {
    "Chevrolet": ["Onix", "Onix Plus", "Tracker", "S10", "Spin", "Montana", "Cruze", "Equinox", "Trailblazer", "Prisma", "Cobalt", "Celta"],
    "Fiat": ["Argo", "Cronos", "Mobi", "Strada", "Toro", "Pulse", "Fastback", "Uno", "Palio", "Siena", "Punto", "Fiorino", "Ducato"],
    "Volkswagen": ["Gol", "Polo", "T-Cross", "Virtus", "Nivus", "Saveiro", "Amarok", "Tiguan", "Jetta", "Voyage", "Fox", "Up!", "Taos"],
    "Toyota": ["Corolla", "Corolla Cross", "Hilux", "SW4", "Yaris", "RAV4", "Camry", "Prius", "Etios"],
    "Hyundai": ["HB20", "HB20S", "Creta", "Tucson", "ix35", "Santa Fe", "Azera", "Elantra", "Kona"],
    "Honda": ["Civic", "HR-V", "City", "Fit", "CR-V", "WR-V", "Accord", "ZR-V"],
    "Nissan": ["Kicks", "Versa", "Frontier", "March", "Sentra", "X-Trail", "Leaf"],
    "Renault": ["Kwid", "Sandero", "Logan", "Duster", "Captur", "Oroch", "Stepway", "Master"],
    "Jeep": ["Renegade", "Compass", "Commander", "Gladiator", "Wrangler", "Cherokee"],
    "Ford": ["Ranger", "Territory", "Bronco", "Maverick", "Ka", "EcoSport", "Fusion", "Focus"],
    "BMW": ["320i", "X1", "X3", "X5", "X6", "M3", "M4", "118i", "330i", "520i"],
    "Mercedes-Benz": ["C 200", "C 300", "GLA 200", "GLC 300", "E 300", "A 200", "CLA 200", "GLE 400", "Classe A"],
    "Audi": ["A3", "A4", "A5", "Q3", "Q5", "Q7", "Q8", "e-tron", "RS3", "TT"],
    "Kia": ["Sportage", "Cerato", "Seltos", "Sorento", "Carnival", "Picanto", "Rio", "Stinger"],
    "Peugeot": ["208", "2008", "3008", "5008", "Partner", "Expert", "e-208"],
    "Citroën": ["C3", "C4 Cactus", "Jumpy", "Berlingo", "C3 Aircross", "C5 Aircross"],
    "Mitsubishi": ["L200 Triton", "Eclipse Cross", "Outlander", "ASX", "Pajero Sport", "Lancer"],
    "Volvo": ["XC40", "XC60", "XC90", "S60", "V60", "C40"],
    "Subaru": ["Forester", "Outback", "XV", "Impreza", "WRX", "BRZ"],
    "Land Rover": ["Defender", "Discovery Sport", "Evoque", "Velar", "Range Rover Sport", "Discovery"],
    "Porsche": ["Cayenne", "Macan", "911", "Panamera", "Taycan", "Boxster", "Cayman"],
    "JAC": ["T40", "T50", "T60", "T80", "iEV40", "iEV60"],
    "BYD": ["Dolphin", "Song Plus", "Yuan Plus", "Han", "Seal", "Tang", "Dolphin Mini"],
    "Caoa Chery": ["Tiggo 3X", "Tiggo 5X", "Tiggo 7", "Tiggo 8", "Arrizo 6"],
    "RAM": ["1500", "2500", "3500", "Rampage"],
    "Suzuki": ["Jimny", "Vitara", "Swift", "S-Cross", "Ignis"],
    "Dodge": ["Challenger", "Charger", "Durango", "Journey"],
    "Mini": ["Cooper", "Cooper S", "Countryman", "Clubman"],
    "Jaguar": ["E-Pace", "F-Pace", "XE", "XF", "F-Type", "I-Pace"],
    "Lexus": ["UX", "NX", "RX", "ES", "IS", "LC", "LS"],
}


async def seed_catalogo():
    """Insere as marcas e modelos canônicos se não existirem."""
    await create_all_tables()

    async with async_session() as session:
        # Verificar se já tem dados
        result = await session.execute(select(CatalogoMarca))
        existing = result.scalars().all()
        if existing:
            print(f"[SKIP] Catálogo já contém {len(existing)} marcas. Seed cancelado.")
            return

        total_marcas = 0
        total_modelos = 0

        for marca_nome, modelos in CATALOGO.items():
            marca = CatalogoMarca(nome=marca_nome)
            session.add(marca)
            await session.flush()  # Gera o ID

            for modelo_nome in modelos:
                modelo = CatalogoModelo(marca_id=marca.id, nome=modelo_nome)
                session.add(modelo)
                total_modelos += 1

            total_marcas += 1

        await session.commit()
        print(f"[OK] Seed concluído: {total_marcas} marcas e {total_modelos} modelos inseridos.")


if __name__ == "__main__":
    asyncio.run(seed_catalogo())
