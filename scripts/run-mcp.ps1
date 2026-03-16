$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$mcp = Join-Path $root "mcp-server"
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)
$venvPy = if ($runningOnWindows) { (Join-Path $mcp ".venv\Scripts\python.exe") } else { (Join-Path $mcp ".venv/bin/python") }
$logsDir = Join-Path $PSScriptRoot ".logs"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"

if (-not (Test-Path $venvPy)) {
  Write-Host "Python venv not found. Run scripts/setup.ps1 first." -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

Write-Host "Starting MCP server..." -ForegroundColor Cyan
$mcpOut = Join-Path $logsDir "mcp-server.out.log"
$mcpErr = Join-Path $logsDir "mcp-server.err.log"
$proc = Start-Process -FilePath $venvPy -ArgumentList "ignition_mcp_server.py" -WorkingDirectory $mcp -PassThru `
  -RedirectStandardOutput $mcpOut -RedirectStandardError $mcpErr

Start-Sleep -Seconds 2
if ($proc.HasExited) {
  Write-Host "MCP server exited immediately." -ForegroundColor Red
  if (Test-Path $mcpErr) { Get-Content $mcpErr -Tail 40 }
  exit 1
}

$pids = @{}
if (Test-Path $pidsFile) {
  try { $pids = (Get-Content -Raw $pidsFile | ConvertFrom-Json -AsHashtable) } catch { $pids = @{} }
}
$pids.mcpServerPid = $proc.Id
$pids.updatedAt = (Get-Date).ToString("s")
$pids | ConvertTo-Json | Set-Content -Path $pidsFile -NoNewline

Write-Host "MCP server launched (PID: $($proc.Id))." -ForegroundColor Green
