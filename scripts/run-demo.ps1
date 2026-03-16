param(
  [switch]$UseViteClient,
  [switch]$RebuildFrontend
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$demo = Join-Path $root "demo-app"
$logsDir = Join-Path $PSScriptRoot ".logs"
$pidsFile = Join-Path $PSScriptRoot ".pids.json"
$runningOnWindows = $IsWindows -or ($PSVersionTable.PSVersion.Major -le 5)
$npmCmd = if ($runningOnWindows) { "npm.cmd" } else { "npm" }

New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSec = 40
  )
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $resp = Invoke-WebRequest -UseBasicParsing -Uri ("http://localhost:{0}" -f $Port) -TimeoutSec 2
      if ($resp.StatusCode -ge 200) { return $true }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Get-PortOwnerPid {
  param([int]$Port)
  try {
    if ($runningOnWindows) {
      $line = netstat -ano | Select-String (":{0}\s+.*LISTENING\s+(\d+)$" -f $Port) | Select-Object -First 1
      if (-not $line) { return $null }
      $m = [regex]::Match($line.ToString(), "LISTENING\s+(\d+)$")
      if ($m.Success) { return [int]$m.Groups[1].Value }
    } else {
      $pid = (lsof -ti :$Port 2>$null | Select-Object -First 1)
      if ($pid) { return [int]$pid }
    }
  } catch {}
  return $null
}

$pids = @{}
if (Test-Path $pidsFile) {
  try { $pids = (Get-Content -Raw $pidsFile | ConvertFrom-Json -AsHashtable) } catch { $pids = @{} }
}

Push-Location $demo
$distDir = Join-Path $demo "client/dist"
if ($RebuildFrontend) {
  Write-Host "Building frontend for static serving..." -ForegroundColor Cyan
  npm run build
  $buildExit = $LASTEXITCODE
  if ($buildExit -ne 0) {
    if (Test-Path $distDir) {
      Write-Host "Frontend build failed, but existing dist was found. Continuing with existing build." -ForegroundColor Yellow
    } else {
      Pop-Location
      Write-Host "Frontend build failed and no dist exists." -ForegroundColor Red
      exit 1
    }
  }
} elseif (-not (Test-Path $distDir)) {
  Write-Host "No frontend dist found. Run: npm --prefix demo-app run build" -ForegroundColor Red
  Pop-Location
  exit 1
}
Pop-Location

if (Get-PortOwnerPid -Port 3001) {
  $owner = Get-PortOwnerPid -Port 3001
  Write-Host ("Port 3001 is already in use by PID {0}. Stop that process or run scripts/stop-all.ps1 first." -f $owner) -ForegroundColor Red
  exit 1
}

Write-Host "Starting demo backend (serves built frontend)..." -ForegroundColor Cyan
$serverOut = Join-Path $logsDir "demo-server.out.log"
$serverErr = Join-Path $logsDir "demo-server.err.log"
$server = Start-Process -FilePath $npmCmd -ArgumentList "run","server" -WorkingDirectory $demo -PassThru `
  -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
$pids.demoServerPid = $server.Id

if ($UseViteClient) {
  Write-Host "Starting Vite client dev server..." -ForegroundColor Cyan
  $clientOut = Join-Path $logsDir "demo-client.out.log"
  $clientErr = Join-Path $logsDir "demo-client.err.log"
  $client = Start-Process -FilePath $npmCmd -ArgumentList "run","client" -WorkingDirectory $demo -PassThru `
    -RedirectStandardOutput $clientOut -RedirectStandardError $clientErr
  $pids.demoClientPid = $client.Id
}

$ok3001 = Wait-Port -Port 3001 -TimeoutSec 50
if (-not $ok3001) {
  Write-Host "Demo backend did not become healthy." -ForegroundColor Red
  if (Test-Path $serverErr) { Get-Content $serverErr -Tail 40 }
  exit 1
}

if ($UseViteClient) {
  $ok3000 = Wait-Port -Port 3000 -TimeoutSec 40
  if (-not $ok3000) {
    Write-Host "Vite dev server failed to become healthy. Continuing with backend-only UI at :3001." -ForegroundColor Yellow
  }
}

$pids.updatedAt = (Get-Date).ToString("s")
$pids | ConvertTo-Json | Set-Content -Path $pidsFile -NoNewline

Write-Host "Demo started." -ForegroundColor Green
Write-Host "UI/API: http://localhost:3001"
if ($UseViteClient) { Write-Host "Vite UI: http://localhost:3000" }
