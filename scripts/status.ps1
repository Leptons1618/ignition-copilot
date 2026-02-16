$ErrorActionPreference = "Stop"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"

if (-not (Test-Path $pidsFile)) {
  Write-Host "No PID file found. Services may not be started via scripts." -ForegroundColor Yellow
  exit 0
}

$pids = Get-Content -Raw $pidsFile | ConvertFrom-Json -AsHashtable

function Show-State {
  param([string]$Name, [int]$ProcessId)
  if (-not $ProcessId) { Write-Host "${Name}: not set"; return }
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Host "${Name}: running (PID $ProcessId)" -ForegroundColor Green
  } else {
    Write-Host "${Name}: stopped (PID $ProcessId not found)" -ForegroundColor Red
  }
}

Show-State "Demo Server" $pids.demoServerPid
Show-State "Demo Client" $pids.demoClientPid
Show-State "MCP Server" $pids.mcpServerPid

try {
  $h = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:3001/api/health" -TimeoutSec 3
  Write-Host "API Health: OK ($($h.StatusCode))" -ForegroundColor Green
} catch {
  Write-Host "API Health: unavailable" -ForegroundColor Red
}
