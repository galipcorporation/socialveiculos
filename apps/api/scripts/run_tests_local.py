#!/usr/bin/env python3
"""
Roda os testes do backend localmente com o MESMO banco descartavel do CI
(SQLite ci_test.db), garantindo que ele nunca acumula entre execucoes:

  1. Remove qualquer ci_test.db (e sidecars -shm/-wal) residual de uma rodada anterior.
  2. Seta as mesmas env vars do CI (.github/workflows/ci.yml).
  3. Roda seed.py para popular o banco do zero.
  4. Roda pytest.
  5. Remove o ci_test.db de novo ao terminar (sucesso OU falha) — nao deixa lixo na maquina do dev.

Uso:
    python apps/api/scripts/run_tests_local.py
    (ou, de dentro de apps/api: python scripts/run_tests_local.py)
"""

import os
import subprocess
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent.parent

DB_FILES = ["ci_test.db", "ci_test.db-shm", "ci_test.db-wal"]

# Mesmas env vars usadas em .github/workflows/ci.yml (steps "Seed test database"
# e "Run Backend Tests"), para que a rodada local reproduza fielmente o CI.
CI_ENV = {
    "API_DEBUG": "true",
    "JWT_SECRET": "ci-test-secret-nao-usar-em-producao-32bytes-min",
    "WEBHOOK_SECRET": "ci-test-webhook-secret-nao-usar-em-producao",
    "DATABASE_URL": "sqlite:///./ci_test.db",
}


def remove_db_files():
    for name in DB_FILES:
        path = API_DIR / name
        if path.exists():
            path.unlink()
            print(f"[LIMPEZA] Removido residual: {path}")


def run(cmd: list[str], env: dict) -> int:
    print(f"[RUN] {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=str(API_DIR), env=env)
    return result.returncode


def main() -> int:
    env = {**os.environ, **CI_ENV}

    print("[INICIO] Limpando ci_test.db residual antes de rodar...")
    remove_db_files()

    exit_code = 1
    try:
        seed_code = run([sys.executable, "seed.py"], env)
        if seed_code != 0:
            print(f"[ERRO] seed.py falhou (exit {seed_code}). Abortando antes do pytest.")
            return seed_code

        exit_code = run([sys.executable, "-m", "pytest", "-v"], env)
        return exit_code
    finally:
        # Roda sempre — sucesso ou falha — para nao deixar lixo na maquina do dev.
        print("[FIM] Removendo ci_test.db para nao acumular entre rodadas...")
        remove_db_files()


if __name__ == "__main__":
    sys.exit(main())
