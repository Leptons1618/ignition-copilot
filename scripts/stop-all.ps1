#!/usr/bin/env pwsh
<#
.SYNOPSIS
  Stop all Ignition Copilot services.
.DESCRIPTION
  Stops background jobs tracked by run-all.ps1. Also kills processes on
  known ports (3001, 3000) as a fallback. Cross-platform compatible.
#>
$ErrorActionPreference = "Stop"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)

function Stop-PortProcess {
  param([int]$Port, [string]$Label)
  try {
    if ($runningOnWindows) {
      $line = netstat -ano | Select-String (":{0}\s+.*LISTENING\s+(\d+)$" -f $Port) | Select-Object -First 1
      if ($line) {
        $m = [regex]::Match($line.ToString(), "LISTENING\s+(\d+)$")
        if ($m.Success) {
          $pid = [int]$m.Groups[1].Value
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          Write-Host "Stopped $Label on port $Port (PID $pid)" -ForegroundColor Green
          return
        }
      }
    } else {
      # macOS / Linux
      $pid = (lsof -ti :$Port 2>$null | Select-Object -First 1)
      if ($pid) {
        kill -9 $pid 2>$null
        Write-Host "Stopped $Label on port $Port (PID $pid)" -ForegroundColor Green
        return
      }
    }
    Write-Host "No process found on port $Port ($Label)" -ForegroundColor DarkGray
  } catch {
    Write-Host "Could not check port $Port`: $_" -ForegroundColor Yellow
  }
}

# 1. Try stopping background PowerShell jobs (from run-all.ps1)
$stoppedJobs = $false
Get-Job | Where-Object { $_.Name -match "DemoBackend|ViteClient|MCPServer" } | ForEach-Object {
  Stop-Job -Job $_ -ErrorAction SilentlyContinue
  Remove-Job -Job $_ -Force -ErrorAction SilentlyContinue
  Write-Host "Stopped job: $($_.Name)" -ForegroundColor Green
  $stoppedJobs = $true
}

# 2. Try stopping by PID file (legacy support)
if (Test-Path $pidsFile) {
  try {
    $pids = Get-Content -Raw $pidsFile | ConvertFrom-Json
    foreach ($prop in @('demoServerPid', 'demoClientPid', 'mcpServerPid')) {
      $pid = $pids.$prop
      if ($pid) {
        $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($proc) {
          Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
          Write-Host "Stopped PID $pid ($prop)" -ForegroundColor Green
        }
      }
    }
  } catch {}
  Remove-Item $pidsFile -Force -ErrorAction SilentlyContinue
}

# 3. Fallback: kill anything on known ports
Write-Host ""
Write-Host "Checking known ports..." -ForegroundColor Cyan
Stop-PortProcess -Port 3001 -Label "Demo Backend"
Stop-PortProcess -Port 3000 -Label "Vite Dev Server"

Write-Host ""
Write-Host "All services stopped." -ForegroundColor Green
