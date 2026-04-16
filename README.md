<div align="center">

# 🔊 Terminal Error Sound

**Never miss a failed terminal command again.**

Plays an audible _FAAAH_ meme sound whenever a command in your integrated terminal exits with a non-zero exit code.

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/ctrl-adarsh.terminal-error-sound?color=%235C6BC0&label=VS%20Code%20Marketplace&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=ctrl-adarsh.terminal-error-sound)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ Features

| | |
|---|---|
| 🎵 | **Faaah sound** — the classic meme error audio |
| 🔍 | **Exit-code detection** — uses VS Code's Shell Integration API (zero false-positives) |
| 🔍 | **Output pattern scanning** — catches errors from terminal text as a fallback |
| 🔇 | **Toggle on/off** — one command in the Command Palette |
| 🛡️ | **Ignore specific exit codes** — `Ctrl+C` (exit 130) is skipped by default |
| ⏱️ | **Smart debouncing** — prevents sound spam when multiple errors fire rapidly |
| 🖥️ | **macOS & Windows** — works out of the box, zero dependencies |

---

## 🚀 Getting Started

1. Install the extension from the VS Code Marketplace
2. Open any terminal (`Ctrl+` `` ` ``)
3. Run a command that fails — e.g. `exit 1`
4. 🔊 **FAAAH**

---

## 📋 Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Description |
|---|---|
| `Terminal Error Sound: Toggle On/Off` | 🔇 Enable or disable the sound |
| `Terminal Error Sound: Play Test Sound` | 🔊 Preview the faaah sound immediately |

---

## ⚙️ Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `terminalErrorSound.enabled` | boolean | `true` | Enable or disable the sound |
| `terminalErrorSound.volume` | number | `1.0` | Volume level (`0.0`–`1.0`) |
| `terminalErrorSound.ignoredExitCodes` | number[] | `[130]` | Exit codes to ignore (`130` = Ctrl+C) |
| `terminalErrorSound.detectOutputErrors` | boolean | `true` | Scan output for error text patterns |
| `terminalErrorSound.errorPatterns` | string[] | *(see below)* | Patterns that trigger the sound |
| `terminalErrorSound.debounceInterval` | number | `2000` | Min ms between sounds |

### Default Error Patterns

```json
[
  "Error:", "TypeError", "ReferenceError", "SyntaxError",
  "FATAL", "FAILED", "panic:", "Traceback", "Exception",
  "ENOENT", "EACCES", "ERR!", "error[", "error:", "fatal:"
]
```

---

## 📋 Requirements

- VS Code **v1.93.0** or higher (required for Shell Integration API)
- Shell integration enabled in your terminal — it is on by default in bash, zsh, fish, and PowerShell
- **macOS**: Uses built-in `afplay` — no extra installs
- **Windows**: Uses built-in PowerShell + Windows Media Player — no extra installs

---

## 📄 License

MIT — Made with ❤️ by Adarsh
