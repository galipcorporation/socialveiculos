"""Falha o CI se o pytest passou "verde" só porque os testes pularam (skip).

Contexto: as fixtures de auth (admin_token/gestor_token, ver apps/api/tests/conftest.py)
fazem pytest.skip() quando o login falha em vez de dar erro — pensado para permitir
rodar a suíte localmente sem banco seedado. Só que isso faz `pytest` sair com
código 0 mesmo se 100% dos testes forem pulados, mascarando a ausência de
cobertura real no CI (já aconteceu: CI "passava" sem testar nada).

Lê o relatório JUnit XML e falha (exit 1) se houver qualquer teste "skipped".
No CI o banco é seedado antes do pytest rodar (ver ci.yml), então skip aqui
sempre indica regressão no seed ou no login, nunca comportamento esperado.
"""
import sys
import xml.etree.ElementTree as ET


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: check_pytest_skips.py <relatorio-junit.xml>")
        return 1

    caminho = sys.argv[1]
    tree = ET.parse(caminho)
    root = tree.getroot()

    testsuites = [root] if root.tag == "testsuite" else root.findall("testsuite")

    skipped_nomes = []
    for suite in testsuites:
        for testcase in suite.findall("testcase"):
            skip_el = testcase.find("skipped")
            if skip_el is not None:
                nome = f"{testcase.get('classname')}::{testcase.get('name')}"
                motivo = skip_el.get("message", "sem mensagem")
                skipped_nomes.append(f"{nome} — {motivo}")

    if skipped_nomes:
        print(f"[CI] {len(skipped_nomes)} teste(s) pulado(s) — no CI isso é sempre bug, não comportamento esperado:")
        for nome in skipped_nomes:
            print(f"  - {nome}")
        print("\nProvável causa: seed.py não rodou/falhou antes do pytest, ou login de teste quebrou.")
        return 1

    print("[CI] Nenhum teste pulado — suíte rodou de ponta a ponta.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
