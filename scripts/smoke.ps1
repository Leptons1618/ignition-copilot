$ErrorActionPreference = "Stop"

function Assert-Status {
  param(
    [string]$Url
  )
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 10
    if ($resp.StatusCode -ne 200) {
      throw "Unexpected HTTP status $($resp.StatusCode) for $Url"
    }
    Write-Host "[OK] $Url" -ForegroundColor Green
  } catch {
    Write-Host "[FAIL] $Url => $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
}

Write-Host "Running demo smoke checks..." -ForegroundColor Cyan
Assert-Status "http://localhost:3001/api/health"
Assert-Status "http://localhost:3001/api/chat/tools"
Assert-Status "http://localhost:3001/api/scenarios"
Assert-Status "http://localhost:3001/api/rag/stats"
Assert-Status "http://localhost:3001/api/insights/asset-health"
Assert-Status "http://localhost:3001/api/insights/alarm-summary"

Write-Host "Smoke checks passed." -ForegroundColor Green
