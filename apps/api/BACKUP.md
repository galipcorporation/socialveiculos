# Guia de Backup e Recuperação (Restore) — SocialVeiculos

Este documento explica os procedimentos para realizar cópias de segurança (backup) e a respectiva restauração (restore) em ambientes locais ou de homologação que utilizam SQLite e armazenamento local de mídias.

## Como Executar o Backup

### 1. Manualmente (PowerShell)
Execute o script fornecido na pasta da API:
```powershell
cd apps/api
.\backup.ps1
```
Este script gerará um backup com data/hora nos diretórios correspondentes:
- Banco de dados: `apps/api/backups/socialveiculos_backup_YYYYMMDD_HHMMSS.db`
- Mídias (Static): `apps/api/backups/static_backup_YYYYMMDD_HHMMSS/`

---

## Procedimento de Recuperação (Restore)

Em caso de falha física, corrupção ou necessidade de rollback:

### Passo 1: Parar o Serviço da API
Para evitar gravações concorrentes ou bloqueio de arquivos (lock) no SQLite, certifique-se de que a API (Uvicorn) está desligada.

### Passo 2: Localizar a Cópia de Segurança
Vá até a pasta `apps/api/backups/` e identifique a versão desejada.
Exemplo:
- Arquivo do banco: `socialveiculos_backup_20260622_224500.db`
- Diretório static: `static_backup_20260622_224500`

### Passo 3: Substituir os Arquivos Atuais
1. Renomeie o arquivo de banco corrompido/antigo `socialveiculos.db` para `socialveiculos.db.old` (para segurança).
2. Copie o arquivo de backup selecionado para o diretório raiz da API renomeando-o para `socialveiculos.db`:
   ```powershell
   Copy-Item -Path .\backups\socialveiculos_backup_20260622_224500.db -Destination .\socialveiculos.db -Force
   ```
3. Restaure a pasta `static` (uploads de mídia):
   ```powershell
   # Remover pasta antiga para evitar arquivos misturados
   Remove-Item -Path .\static -Recurse -Force -ErrorAction SilentlyContinue
   # Copiar pasta de backup
   Copy-Item -Path .\backups\static_backup_20260622_224500 -Destination .\static -Recurse
   ```

### Passo 4: Reiniciar a API
Inicie novamente a API:
```powershell
python -m uvicorn main:app --reload --port 8000
```
Verifique nos logs e no painel do Gestor se os veículos e mídias foram devidamente restabelecidos.
