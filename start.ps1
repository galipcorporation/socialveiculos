# ═══════════════════════════════════════════════════════════════
#  Social Veículos — Start Dev Environment
#  Sobe API (FastAPI) + Gestor (Vite) + Vitrine (Vite) com 1 clique
# ═══════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║       Social Veículos — Dev Server       ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── 1. Verificar dependências ──────────────────────────────────
Write-Host "[1/4] Verificando dependências..." -ForegroundColor Yellow

$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "  [X] Node.js não encontrado. Instale em https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] Node.js $nodeVersion" -ForegroundColor Green

$pythonVersion = python --version 2>$null
if (-not $pythonVersion) {
    Write-Host "  [X] Python não encontrado. Instale em https://python.org" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] $pythonVersion" -ForegroundColor Green

$pnpmVersion = pnpm --version 2>$null
if (-not $pnpmVersion) {
    Write-Host "  [!] pnpm não encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g pnpm
    $pnpmVersion = pnpm --version
}
Write-Host "  [OK] pnpm $pnpmVersion" -ForegroundColor Green

# ── 2. Instalar dependências Node ──────────────────────────────
Write-Host ""
Write-Host "[2/4] Instalando dependências Node (pnpm install)..." -ForegroundColor Yellow
Push-Location $ROOT
pnpm install
Pop-Location
Write-Host "  [OK] Dependências Node instaladas" -ForegroundColor Green

# ── 3. Instalar dependências Python ───────────────────────────
Write-Host ""
Write-Host "[3/4] Instalando dependências Python (pip)..." -ForegroundColor Yellow

$apiDir = Join-Path $ROOT "apps\api"

# Criar .env a partir do .env.example se não existir
$envFile = Join-Path $apiDir ".env"
$envExample = Join-Path $apiDir ".env.example"
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile
        Write-Host "  -> .env criado a partir do .env.example" -ForegroundColor DarkYellow
    }
}

pip install -r (Join-Path $apiDir "requirements.txt") --quiet
Write-Host "  [OK] Dependências Python instaladas" -ForegroundColor Green

# ── 3.5. Limpar Processos Zumbis ──────────────────────────────
Write-Host ""
Write-Host "[3.5/4] Identificando e finalizando processos zumbis..." -ForegroundColor Yellow

# Limpar processos python zumbis do uvicorn (incluindo filhos spawnados de multiprocessing)
$pyProcs = Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" -ErrorAction SilentlyContinue
if ($pyProcs) {
    foreach ($p in $pyProcs) {
        if ($p.CommandLine -like "*uvicorn*" -or $p.CommandLine -like "*main:app*" -or $p.CommandLine -like "*multiprocessing.spawn*") {
            Write-Host "  -> Finalizando processo python zumbi (PID $($p.ProcessId))..." -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}
# Limpar processos node zumbis (vite, expo, metro, whatsapp-worker)
$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
if ($nodeProcs) {
    foreach ($p in $nodeProcs) {
        if ($p.CommandLine -like "*vite*" -or $p.CommandLine -like "*expo*" -or $p.CommandLine -like "*metro*" -or $p.CommandLine -like "*whatsapp-worker*" -or $p.CommandLine -like "*baileys*") {
            Write-Host "  -> Finalizando processo node zumbi (PID $($p.ProcessId))..." -ForegroundColor Yellow
            Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        }
    }
}

$targetPorts = @(8000, 5173, 5174, 5175, 8090, 8081)
foreach ($port in $targetPorts) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            if ($processId -and $processId -ne 0 -and $processId -ne $PID) {
                $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  -> Finalizando processo zumbi '$($proc.Name)' (PID $processId) na porta $port..." -ForegroundColor Yellow
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    }
}
Write-Host "  [OK] Portas liberadas." -ForegroundColor Green

# ── 4. Iniciar servidores ──────────────────────────────────────
Write-Host ""
Write-Host "[4/4] Iniciando servidores..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  [API]      → http://localhost:8000/v1/docs" -ForegroundColor White
Write-Host "  [GESTOR]   → http://localhost:5173" -ForegroundColor White
Write-Host "  [VITRINE]  → http://localhost:5174" -ForegroundColor White
Write-Host "  [ADMIN]    → http://localhost:5175" -ForegroundColor White
Write-Host "  [WHATSAPP] → http://localhost:8090" -ForegroundColor White
Write-Host "  [MOBILE]   → Expo Go (Porta 8081)" -ForegroundColor White
Write-Host ""
Write-Host "  Pressione Ctrl+C para parar todos os servidores." -ForegroundColor DarkGray
Write-Host ""

# Iniciar API em background
$apiJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $apiDir

# Iniciar Gestor em background
$gestorJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm --filter @sv/gestor run dev
} -ArgumentList $ROOT

# Iniciar Vitrine em background
$vitrineJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm --filter @sv/vitrine run dev
} -ArgumentList $ROOT

# Iniciar Admin em background
$adminJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm --filter @sv/admin run dev
} -ArgumentList $ROOT

# Iniciar WhatsApp Worker em background
$whatsappJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    pnpm --filter @sv/whatsapp-worker run dev
} -ArgumentList $ROOT

# Iniciar Mobile em um novo terminal interativo (para exibir o QR Code e interagir com 'a', 'i', 'r')
$mobileProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ROOT'; pnpm --filter @sv/mobile run dev" -PassThru -NoNewWindow:$false

Write-Host "  Servidores iniciados! Abrindo no navegador em 4 segundos..." -ForegroundColor Green
Write-Host ""

Start-Sleep -Seconds 4
Start-Process "http://localhost:5174"
Start-Process "http://localhost:5173"
Start-Process "http://localhost:5175"

# Manter o script rodando e mostrar logs
try {
    while ($true) {
        Receive-Job -Job $apiJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[API] $_" -ForegroundColor DarkCyan }
        Receive-Job -Job $gestorJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[GESTOR] $_" -ForegroundColor DarkBlue }
        Receive-Job -Job $vitrineJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[VITRINE] $_" -ForegroundColor DarkGreen }
        Receive-Job -Job $adminJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[ADMIN] $_" -ForegroundColor Magenta }
        Receive-Job -Job $whatsappJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "[WHATSAPP] $_" -ForegroundColor DarkYellow }
        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "  Parando servidores..." -ForegroundColor Yellow
    Stop-Job -Job $apiJob, $gestorJob, $vitrineJob, $adminJob, $whatsappJob -ErrorAction SilentlyContinue
    Remove-Job -Job $apiJob, $gestorJob, $vitrineJob, $adminJob, $whatsappJob -Force -ErrorAction SilentlyContinue
    if ($mobileProcess) {
        Stop-Process -Id $mobileProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "  [OK] Todos os servidores parados." -ForegroundColor Green
}
