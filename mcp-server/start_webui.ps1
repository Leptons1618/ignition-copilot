# Ignition MCP Demo - Complete Startup Script

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "IGNITION MCP DEMO - WEB UI LAUNCHER" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (!(Test-Path "config.json")) {
    Write-Host "ERROR: Must run from mcp-server directory" -ForegroundColor Red
    Write-Host "Run: cd D:\Sandbox\ignition-copilot\mcp-server" -ForegroundColor Yellow
    exit 1
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "..\venv\Scripts\Activate.ps1"

# Install Flask if needed
Write-Host "Checking dependencies..." -ForegroundColor Yellow
pip install flask --quiet

# Start web UI
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Green
Write-Host "WEB UI STARTING" -ForegroundColor Green
Write-Host "=" * 70 -ForegroundColor Green
Write-Host ""
Write-Host "Open your browser to: " -NoNewline
Write-Host "http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

python web_ui.py
