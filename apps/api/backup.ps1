# Script de Backup — SocialVeiculos
# Executa cópia de segurança do banco SQLite local e dos arquivos de mídia.

$DateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupDir = Join-Path $PSScriptRoot "backups"
$DbFile = Join-Path $PSScriptRoot "socialveiculos.db"
$StaticDir = Join-Path $PSScriptRoot "static"

# Garantir diretório de backups
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "[INFO] Diretorio de backups criado em: $BackupDir" -ForegroundColor Cyan
}

# 1. Backup do Banco SQLite
if (Test-Path $DbFile) {
    $DbBackupName = "socialveiculos_backup_$DateStr.db"
    $DbBackupPath = Join-Path $BackupDir $DbBackupName
    Copy-Item -Path $DbFile -Destination $DbBackupPath
    Write-Host "[OK] Backup do banco de dados concluido: $DbBackupName" -ForegroundColor Green
} else {
    Write-Host "[AVISO] Arquivo de banco de dados 'socialveiculos.db' nao encontrado em $DbFile" -ForegroundColor Yellow
}

# 2. Backup da Pasta de Mídias (Static)
if (Test-Path $StaticDir) {
    $StaticBackupName = "static_backup_$DateStr"
    $StaticBackupPath = Join-Path $BackupDir $StaticBackupName
    Copy-Item -Path $StaticDir -Destination $StaticBackupPath -Recurse
    Write-Host "[OK] Backup da pasta static concluido: $StaticBackupName" -ForegroundColor Green
} else {
    Write-Host "[INFO] Pasta 'static' nao encontrada ou vazia." -ForegroundColor Gray
}

Write-Host "[FIM] Backup concluido com sucesso!" -ForegroundColor Green
