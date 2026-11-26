$ErrorActionPreference = "Stop"

Write-Host "=== Klipper Macro Studio - Windows Build ===" -ForegroundColor Cyan

foreach ($cmd in @("node", "npm", "cargo", "python")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        Write-Error "Missing prerequisite: '$cmd'. Please install it and re-run this script."
        exit 1
    }
}

Write-Host "[1/3] Building Python Jinja2 sidecar..." -ForegroundColor Yellow
if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\pip.exe install -r sidecar\requirements.txt
& .\.venv\Scripts\pyinstaller.exe --onefile --name macro-engine-x86_64-pc-windows-msvc --distpath src-tauri\binaries sidecar\macro_engine.py

Write-Host "[2/3] Installing Node dependencies..." -ForegroundColor Yellow
npm install

Write-Host "[3/3] Building Windows Tauri installer (.msi / .exe)..." -ForegroundColor Yellow
npm run tauri build

Write-Host ""
Write-Host "Build complete! Installers are in:" -ForegroundColor Green
Write-Host "  src-tauri\target\release\bundle\msi\"
Write-Host "  src-tauri\target\release\bundle\nsis\"
