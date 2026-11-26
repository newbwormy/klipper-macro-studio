# Klipper Macro Studio

Cross-platform desktop application (Windows, Linux, macOS) to visually build Klipper G-code macros using Klipper's real Python `jinja2` engine and simulate toolhead motion in 3D.

## Quick Start on Windows

### Prerequisites
1. **Node.js 20+** (`https://nodejs.org/`)
2. **Python 3.10+** (`https://www.python.org/`)
3. **Rust + MSVC Build Tools** (`https://rustup.rs/` and Visual Studio C++ Build Tools)

### Run Immediately (Dev Mode)
```powershell
powershell -ExecutionPolicy Bypass -File .\dev-windows.ps1
```

### Build Windows `.msi` and `.exe` Installers
```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```
