$ErrorActionPreference = "Stop"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"

if (-not (Test-Path $pidsFile)) {
  Write-Host "No PID file found. Nothing to stop." -ForegroundColor Yellow
  exit 0
}

$pids = Get-Content -Raw $pidsFile | ConvertFrom-Json -AsHashtable

function Stop-Pid {
  param([string]$Name, [int]$ProcessId)
  if (-not $ProcessId) { return }
  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $Name (PID $ProcessId)" -ForegroundColor Green
  } else {
    Write-Host "$Name already stopped (PID $ProcessId not found)" -ForegroundColor Yellow
  }
}

Stop-Pid "Demo Server" $pids.demoServerPid
Stop-Pid "Demo Client" $pids.demoClientPid
Stop-Pid "MCP Server" $pids.mcpServerPid

Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
Write-Host "All known services stopped." -ForegroundColor Green
