param(
  [switch]$UseViteClient
)

$ErrorActionPreference = "Stop"

Write-Host "Starting all local services..." -ForegroundColor Cyan
if ($UseViteClient) {
  pwsh -NoProfile -File (Join-Path $PSScriptRoot "run-demo.ps1") -UseViteClient
} else {
  pwsh -NoProfile -File (Join-Path $PSScriptRoot "run-demo.ps1")
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pwsh -NoProfile -File (Join-Path $PSScriptRoot "run-mcp.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pwsh -NoProfile -File (Join-Path $PSScriptRoot "smoke.ps1")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "All services started." -ForegroundColor Green
Write-Host "Check status: pwsh ./scripts/status.ps1" -ForegroundColor Yellow
Write-Host "Stop services: pwsh ./scripts/stop-all.ps1" -ForegroundColor Yellow
