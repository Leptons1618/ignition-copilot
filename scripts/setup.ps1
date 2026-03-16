param(
  [switch]$SkipDemo,
  [switch]$SkipMcp
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)

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
  if ($runningOnWindows) {
    $pythonCmd = "python"
  } else {
    $pythonCmd = if (Get-Command python3 -ErrorAction SilentlyContinue) { "python3" } else { "python" }
  }
  if (-not (Test-Path ".venv")) {
    & $pythonCmd -m venv .venv
  }
  $venvPy = if ($runningOnWindows) { ".\.venv\Scripts\python.exe" } else { "./.venv/bin/python" }
  & $venvPy -m pip install --upgrade pip
  & $venvPy -m pip install -r requirements.txt
  Pop-Location
}

Write-Host "Setup complete." -ForegroundColor Green
