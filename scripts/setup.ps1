param(
  [switch]$SkipDemo,
  [switch]$SkipMcp
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot

Write-Host "Setup started in $root" -ForegroundColor Cyan

if (-not $SkipDemo) {
  Write-Host "Installing demo-app dependencies..." -ForegroundColor Yellow
  Push-Location (Join-Path $root "demo-app")
  npm install
  Push-Location "client"
  npm install
  Pop-Location
  Push-Location "server"
  npm install
  Pop-Location
  Pop-Location
}

if (-not $SkipMcp) {
  Write-Host "Installing mcp-server Python dependencies..." -ForegroundColor Yellow
  Push-Location (Join-Path $root "mcp-server")
  if (-not (Test-Path ".venv")) {
    python -m venv .venv
  }
  & ".\.venv\Scripts\python.exe" -m pip install --upgrade pip
  & ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt
  Pop-Location
}

Write-Host "Setup complete." -ForegroundColor Green
