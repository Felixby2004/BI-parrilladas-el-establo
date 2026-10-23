param([switch]$Instalar, [switch]$DatosDemo)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Confirmar-Comando([string]$Paso) {
    if ($LASTEXITCODE -ne 0) { throw "Falló: $Paso (código $LASTEXITCODE)" }
}

docker compose up -d --wait
Confirmar-Comando 'Docker / PostgreSQL'
$python = Join-Path $PSScriptRoot 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $python)) {
    python -m venv backend\.venv
    Confirmar-Comando 'Crear entorno Python'
    $Instalar = $true
}
if ($Instalar) {
    & $python -m pip install -r backend\requirements.lock.txt
    Confirmar-Comando 'Instalar backend'
    Push-Location frontend
    try { pnpm install --frozen-lockfile; Confirmar-Comando 'Instalar frontend' } finally { Pop-Location }
}
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
Push-Location backend
try {
    & $python -m alembic upgrade head
    Confirmar-Comando 'Aplicar migraciones'
    if ($DatosDemo) { & $python seeds\seed_leads.py; Confirmar-Comando 'Cargar datos demo' }
} finally { Pop-Location }

Start-Process powershell.exe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSScriptRoot\ejecutar-backend.ps1`""
Start-Process powershell.exe -ArgumentList '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSScriptRoot\ejecutar-frontend.ps1`""
Write-Host 'Frontend: http://localhost:5173 | API: http://localhost:8000/docs'
