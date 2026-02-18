#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Start all Ignition Copilot services in a single terminal with visible log output.
.DESCRIPTION
  Runs demo backend, optional Vite dev server, and MCP server as background jobs.
  All logs stream to the current terminal. Ctrl+C stops everything.
  Cross-platform: works on Windows, macOS, and Linux.
#>
param(
  [switch]$UseViteClient,
  [switch]$RebuildFrontend,
  [switch]$SkipSmoke
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$demo = Join-Path $root "demo-app"
$mcp  = Join-Path $root "mcp-server"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"

# ── Cross-platform helpers ──
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)
$npmCmd = if ($runningOnWindows) { "npm.cmd" } else { "npm" }

function Find-Python {
  if ($runningOnWindows) {
    $venvPy = Join-Path $mcp ".venv\Scripts\python.exe"
  } else {
    $venvPy = Join-Path $mcp ".venv/bin/python"
  }
  if (Test-Path $venvPy) { return $venvPy }
  # Fallback to system python
  $candidates = @("python3", "python")
  foreach ($c in $candidates) {
    try { $null = & $c --version 2>$null; return $c } catch {}
  }
  return $null
}

function Wait-Port {
  param([int]$Port, [int]$TimeoutSec = 50)
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri "http://localhost:$Port" -TimeoutSec 2 -ErrorAction Stop
      if ($resp.StatusCode -ge 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# ── Validate prerequisites ──
$distDir = Join-Path $demo "client" "dist"
Push-Location $demo
if ($RebuildFrontend) {
  Write-Host "[1/4] Building frontend..." -ForegroundColor Cyan
  & $npmCmd run build
  if ($LASTEXITCODE -ne 0 -and -not (Test-Path $distDir)) {
    Pop-Location
    Write-Host "Frontend build failed and no dist exists." -ForegroundColor Red
    exit 1
  }
} elseif (-not (Test-Path $distDir)) {
  Write-Host "No frontend dist found. Run with -RebuildFrontend or: npm --prefix demo-app run build" -ForegroundColor Red
  Pop-Location
  exit 1
}
Pop-Location

$pythonExe = Find-Python
if (-not $pythonExe) {
  Write-Host "Python not found. MCP server will be skipped." -ForegroundColor Yellow
}

# ── Start services as background jobs ──
Write-Host ""
Write-Host "Starting services..." -ForegroundColor Cyan
Write-Host "─────────────────────────────────────" -ForegroundColor DarkGray

$jobs = @()
$pids = @{}

# Job 1: Demo backend (Express server)
Write-Host "[Backend] Starting Express server on :3001..." -ForegroundColor Green
$backendJob = Start-Job -Name "DemoBackend" -ScriptBlock {
  param($dir, $npm)
  Set-Location $dir
  & $npm run server 2>&1
} -ArgumentList $demo, $npmCmd
$jobs += $backendJob
$pids.demoServerJobId = $backendJob.Id

# Job 2: Vite dev server (optional)
if ($UseViteClient) {
  Write-Host "[Frontend] Starting Vite dev server on :3000..." -ForegroundColor Green
  $clientJob = Start-Job -Name "ViteClient" -ScriptBlock {
    param($dir, $npm)
    Set-Location $dir
    & $npm run client 2>&1
  } -ArgumentList $demo, $npmCmd
  $jobs += $clientJob
  $pids.demoClientJobId = $clientJob.Id
}

# Job 3: MCP server (Python)
if ($pythonExe) {
  Write-Host "[MCP] Starting MCP server..." -ForegroundColor Green
  $mcpJob = Start-Job -Name "MCPServer" -ScriptBlock {
    param($dir, $py)
    Set-Location $dir
    & $py ignition_mcp_server.py 2>&1
  } -ArgumentList $mcp, $pythonExe
  $jobs += $mcpJob
  $pids.mcpServerJobId = $mcpJob.Id
}

# Save job info
$pids.updatedAt = (Get-Date).ToString("s")
$pids | ConvertTo-Json | Set-Content -Path $pidsFile -NoNewline

# ── Wait for backend health ──
Write-Host ""
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
$ok = Wait-Port -Port 3001 -TimeoutSec 50
if (-not $ok) {
  Write-Host "Backend did not become healthy on :3001" -ForegroundColor Red
  Write-Host "Recent logs:" -ForegroundColor Yellow
  Receive-Job -Job $backendJob -ErrorAction SilentlyContinue | Select-Object -Last 20
  Get-Job | Where-Object { $_.Name -match "Demo|Vite|MCP" } | Stop-Job -PassThru | Remove-Job -Force
  exit 1
}

# ── Smoke tests ──
if (-not $SkipSmoke) {
  Write-Host ""
  Write-Host "Running smoke checks..." -ForegroundColor Cyan
  $smokeScript = Join-Path $PSScriptRoot "smoke.ps1"
  if (Test-Path $smokeScript) {
    try { & $smokeScript } catch {
      Write-Host "Smoke checks had failures, but services are running." -ForegroundColor Yellow
    }
  }
}

# ── Stream logs ──
Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host " All services running. Streaming logs below." -ForegroundColor Green
Write-Host " UI:  http://localhost:3001" -ForegroundColor White
if ($UseViteClient) { Write-Host " Dev: http://localhost:3000" -ForegroundColor White }
Write-Host " Press Ctrl+C to stop all services." -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════" -ForegroundColor DarkGray
Write-Host ""

try {
  $reportedExits = @{}
  while ($true) {
    $hasOutput = $false
    foreach ($job in $jobs) {
      $output = Receive-Job -Job $job -ErrorAction SilentlyContinue
      if ($output) {
        $hasOutput = $true
        if ($job.Name -eq "DemoBackend") { $prefix = "[Backend]"; $color = "Green" }
        elseif ($job.Name -eq "ViteClient") { $prefix = "[Vite]   "; $color = "Cyan" }
        elseif ($job.Name -eq "MCPServer") { $prefix = "[MCP]    "; $color = "Magenta" }
        else { $prefix = "[???]    "; $color = "Gray" }
        foreach ($line in $output) {
          Write-Host "$prefix $line" -ForegroundColor $color
        }
      }

      # Check for crashed jobs (report each exit only once)
      if (($job.State -eq 'Failed' -or $job.State -eq 'Completed') -and -not $reportedExits[$job.Id]) {
        $reportedExits[$job.Id] = $true
        Write-Host "$($job.Name) exited unexpectedly (state: $($job.State))" -ForegroundColor Red
        $remaining = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($remaining) { $remaining | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkRed } }
      }
    }
    if (-not $hasOutput) { Start-Sleep -Milliseconds 300 }
  }
} finally {
  Write-Host ""
  Write-Host "Stopping all services..." -ForegroundColor Yellow
  foreach ($job in $jobs) {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    Write-Host "Stopped $($job.Name)" -ForegroundColor Green
  }
  Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
  Write-Host "All services stopped." -ForegroundColor Green
}
