$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)

$env:PYTHONIOENCODING = "utf-8"

Write-Host "Test suite started..." -ForegroundColor Cyan

Push-Location (Join-Path $root "demo-app")
npm run build
if ($LASTEXITCODE -ne 0) {
  Pop-Location
  throw "Frontend build failed."
}
Pop-Location

Write-Host "Checking running API services..." -ForegroundColor Yellow
try {
  & (Join-Path $PSScriptRoot "smoke.ps1")
} catch {
  Write-Host "Services not healthy. Attempting startup..." -ForegroundColor Yellow
  pwsh -NoProfile -File (Join-Path $PSScriptRoot "run-all.ps1")
  Start-Sleep -Seconds 3
  & (Join-Path $PSScriptRoot "smoke.ps1")
}

$mcp = Join-Path $root "mcp-server"
$venvPy = if ($runningOnWindows) { (Join-Path $mcp ".venv\Scripts\python.exe") } else { (Join-Path $mcp ".venv/bin/python") }
if (Test-Path $venvPy) {
  Write-Host "Running MCP basic tests..." -ForegroundColor Yellow
  Push-Location $mcp
  & $venvPy test_basic.py
  if ($LASTEXITCODE -ne 0) {
    Pop-Location
    throw "MCP basic tests failed."
  }
  Pop-Location
} else {
  Write-Host "Skipping MCP tests (.venv not found)." -ForegroundColor DarkYellow
}

Write-Host "All tests completed." -ForegroundColor Green
