$ErrorActionPreference = "Stop"

Write-Host "=== Klipper Macro Studio - Windows Dev Launch ===" -ForegroundColor Cyan

if (-not (Test-Path "src-tauri\binaries\macro-engine-x86_64-pc-windows-msvc.exe")) {
    Write-Host "Building Python Jinja2 sidecar first..." -ForegroundColor Yellow
    if (-not (Test-Path ".venv")) {
        python -m venv .venv
    }
    & .\.venv\Scripts\pip.exe install -r sidecar\requirements.txt
    & .\.venv\Scripts\pyinstaller.exe --onefile --name macro-engine-x86_64-pc-windows-msvc --distpath src-tauri\binaries sidecar\macro_engine.py
}

if (-not (Test-Path "node_modules")) {
    npm install
}

npm run tauri dev
