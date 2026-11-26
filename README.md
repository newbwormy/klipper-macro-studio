# Klipper Macro Studio

Cross-platform desktop application (Windows, Linux, macOS) to visually build Klipper G-code macros using Klipper's real Python `jinja2` engine and simulate toolhead motion in 3D.

## Browser demo

Try the visual builder, download a `.cfg` file, and play the bundled prime-and-wipe simulation. Playback uses the sample G-code. The desktop app evaluates edited macros and connects to Moonraker.

To preview locally, run `npm ci` and `npm run dev`, then open the URL printed by Vite. To publish the [browser demo](https://newbwormy.github.io/klipper-macro-studio/), set **Settings → Pages → Source** to **GitHub Actions**, then run **Deploy browser demo** from the Actions tab.

---

## Compiling on Linux

### 1. Prerequisites
Install **Node.js 20+**, **Python 3.10+** (with `venv`), **Rust** (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`), and the Tauri v2 system libraries for your distro:

* **Ubuntu / Debian:**
  ```bash
  sudo apt update
  sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
    libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf \
    python3-venv
  ```
* **Fedora:**
  ```bash
  sudo dnf group install "c-development"
  sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file \
    libappindicator-gtk3-devel librsvg2-devel patchelf python3-devel
  ```
* **Arch Linux:**
  ```bash
  sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
    appmenu-gtk-module libappindicator-gtk3 librsvg patchelf
  ```

### 2. Build the Python Jinja2 Sidecar
```bash
ARCH="$(uname -m)"
if [ "$ARCH" = "aarch64" ]; then
  TARGET="aarch64-unknown-linux-gnu"
else
  TARGET="x86_64-unknown-linux-gnu"
fi

python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/pip install -r sidecar/requirements.txt
./.venv/bin/pyinstaller --onefile \
  --name "macro-engine-${TARGET}" \
  --distpath src-tauri/binaries \
  sidecar/macro_engine.py
chmod +x "src-tauri/binaries/macro-engine-${TARGET}"
```

### 3. Run or Build the Linux App
```bash
npm install

# Run in dev mode:
npm run tauri dev

# Or build release packages (.AppImage, .deb, .rpm):
npm run tauri build
```
Compiled installers are output to:
* `src-tauri/target/release/bundle/appimage/`
* `src-tauri/target/release/bundle/deb/`
* `src-tauri/target/release/bundle/rpm/`

---

## Compiling on macOS (Apple Silicon & Intel)

### 1. Prerequisites
1. **Xcode Command Line Tools:** `xcode-select --install`
2. **Node.js 20+:** `brew install node` (or [nodejs.org](https://nodejs.org/))
3. **Python 3.10+:** `brew install python` (or [python.org](https://www.python.org/))
4. **Rust:** `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`

### 2. Quick Build (Using Included Scripts)
```bash
chmod +x dev-macos.sh build-macos.sh

# Run in dev mode:
./dev-macos.sh

# Or build .app and .dmg installers:
./build-macos.sh
```

### 3. Manual Build Steps
```bash
ARCH="$(uname -m)"
if [ "$ARCH" = "arm64" ]; then
  TARGET="aarch64-apple-darwin"
else
  TARGET="x86_64-apple-darwin"
fi

python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/pip install -r sidecar/requirements.txt
./.venv/bin/pyinstaller --onefile \
  --name "macro-engine-${TARGET}" \
  --distpath src-tauri/binaries \
  sidecar/macro_engine.py
chmod +x "src-tauri/binaries/macro-engine-${TARGET}"

npm install
npm run tauri build -- --target "$TARGET"
```
Compiled artifacts are output to:
* `src-tauri/target/<arch>-apple-darwin/release/bundle/dmg/`
* `src-tauri/target/<arch>-apple-darwin/release/bundle/macos/`

> **Gatekeeper Note (unsigned local builds):** Right-click `Klipper Macro Studio.app` and select **Open**, or run `xattr -cr "/Applications/Klipper Macro Studio.app"` if macOS flags it as from an unidentified developer.

---

## Compiling on Windows

### Prerequisites
1. **Node.js 20+** ([nodejs.org](https://nodejs.org/))
2. **Python 3.10+** ([python.org](https://www.python.org/))
3. **Rust + MSVC Build Tools** ([rustup.rs](https://rustup.rs/) and Visual Studio C++ Build Tools)

### Run Immediately (Dev Mode)
```powershell
powershell -ExecutionPolicy Bypass -File .\dev-windows.ps1
```

### Build Windows `.msi` and `.exe` Installers
```powershell
powershell -ExecutionPolicy Bypass -File .\build-windows.ps1
```
Installers are output to `src-tauri\target\release\bundle\msi\` and `src-tauri\target\release\bundle\nsis\`.

---
