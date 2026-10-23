$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot 'frontend')
pnpm run dev -- --host 127.0.0.1 --port 5173 --strictPort
