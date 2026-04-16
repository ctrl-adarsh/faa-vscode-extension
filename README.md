<div align="center">

# 🔊 Terminal Error Sound

**Never miss a failed terminal command again.**

Plays an audible _FAAAH_ meme sound whenever a command in your integrated terminal exits with a non-zero exit code.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ Features

|     |                                                                                       |
| --- | ------------------------------------------------------------------------------------- |
| 🎵  | **Faaah sound** — the classic meme error audio                                        |
| 🔍  | **Exit-code detection** — uses VS Code's Shell Integration API (zero false-positives) |
| 🔍  | **Output pattern scanning** — catches errors from terminal text as a fallback         |
| 🔇  | **Toggle on/off** — one command in the Command Palette                                |
| 🛡️  | **Ignore specific exit codes** — `Ctrl+C` (exit 130) is skipped by default            |
| ⏱️  | **Smart debouncing** — prevents sound spam when multiple errors fire rapidly          |
| 🖥️  | **macOS & Windows** — works out of the box, zero dependencies                         |

---

## 🚀 Getting Started (Installation)

Since this extension is not published on the VS Code Marketplace, you will need to install it manually using the provided `.vsix` file.

### Option 1: Install via VS Code UI
1. Download the latest `.vsix` file from this repository.
2. Open VS Code and navigate to the **Extensions** view (`Ctrl+Shift+X` on Windows/Linux, `Cmd+Shift+X` on macOS).
3. Click the `...` (Views and More Actions) menu at the top right of the Extensions panel.
4. Select **Install from VSIX...** from the dropdown menu.
5. Locate and select the `.vsix` file you downloaded.
6. Open any terminal (`Ctrl+` `` ` ``) and run a command that fails (e.g., `exit 1`) to hear the 🔊 **FAAAH**.

### Option 2: Install via Command Line
If you have the `code` CLI installed, you can install the extension directly from your terminal:
```bash
code --install-extension path/to/terminal-error-sound.vsix