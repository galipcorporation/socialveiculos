import sys
import os

# Adiciona o diretório pai (apps/api) no PYTHONPATH para conseguir importar main.py
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

