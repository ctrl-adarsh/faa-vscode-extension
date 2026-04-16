import * as vscode from "vscode";
import * as child_process from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  enabled: boolean;
  volume: number;
  ignoredExitCodes: number[];
  debounceInterval: number;
}

// ─── Config helper ────────────────────────────────────────────────────────────

function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration("terminalErrorSound");
  return {
    enabled: cfg.get<boolean>("enabled", true),
    volume: cfg.get<number>("volume", 1.0),
    ignoredExitCodes: cfg.get<number[]>("ignoredExitCodes", [130]),
    debounceInterval: cfg.get<number>("debounceInterval", 2000),
  };
}

// ─── Sound Player ─────────────────────────────────────────────────────────────

class SoundPlayer {
  private readonly soundPath: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.soundPath = context.asAbsolutePath(path.join("sounds", "faaah.mp3"));
  }

  async play(): Promise<void> {
    try {
      if (!fs.existsSync(this.soundPath)) {
        vscode.window.showErrorMessage(
          `Terminal Error Sound: Sound file not found at "${this.soundPath}"`
        );
        return;
      }

      const cfg = getConfig();
      const volume = Math.max(0, Math.min(1, cfg.volume));
      const platform = os.platform();

      if (platform === "darwin") {
        await this.playMac(volume);
      } else if (platform === "win32") {
        await this.playWindows(volume);
      } else {
        await this.playLinux();
      }
    } catch (err) {
      console.error("[TerminalErrorSound] Playback error:", err);
    }
  }

  // ── macOS ──────────────────────────────────────────────────────────────────
  // afplay -v: 1.0 = normal volume. Pass our 0.0–1.0 value directly.
  private playMac(volume: number): Promise<void> {
    return new Promise((resolve) => {
      const proc = child_process.spawn("afplay", [
        "-v",
        volume.toFixed(2),
        this.soundPath,
      ]);
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  }

  // ── Windows ────────────────────────────────────────────────────────────────
  // Uses .NET PresentationCore MediaPlayer — handles MP3 natively with volume.
  private playWindows(volume: number): Promise<void> {
    return new Promise((resolve) => {
      const escapedPath = this.soundPath.replace(/'/g, "''");
      const script = `
        $ErrorActionPreference = 'SilentlyContinue';
        $player = New-Object System.Windows.Media.MediaPlayer;
        $player.Open('${escapedPath}');
        $player.Volume = ${volume};
        $player.Play();
        Start-Sleep -Seconds 5;
        $player.Stop();
        $player.Close();
      `;
      const proc = child_process.spawn("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle",
        "Hidden",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `Add-Type -AssemblyName PresentationCore; ${script}`,
      ]);
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  }

  // ── Linux fallback ─────────────────────────────────────────────────────────
  private playLinux(): Promise<void> {
    return new Promise((resolve) => {
      const candidates = ["mpg123", "ffplay", "paplay"];
      const player = candidates.find((p) => {
        try {
          child_process.execSync(`which ${p}`, { stdio: "ignore" });
          return true;
        } catch {
          return false;
        }
      });
      if (!player) {
        resolve();
        return;
      }
      const args =
        player === "ffplay"
          ? ["-nodisp", "-autoexit", this.soundPath]
          : [this.soundPath];
      const proc = child_process.spawn(player, args);
      proc.on("close", () => resolve());
      proc.on("error", () => resolve());
    });
  }
}

// ─── Error Detector ───────────────────────────────────────────────────────────

class TerminalErrorDetector {
  private lastSoundAt = 0;

  constructor(private readonly player: SoundPlayer) {}

  onShellExecutionEnd(event: vscode.TerminalShellExecutionEndEvent): void {
    const cfg = getConfig();
    if (!cfg.enabled) {
      return;
    }
    const code = event.exitCode;
    if (code === undefined || code === 0) {
      return;
    }
    if (cfg.ignoredExitCodes.includes(code)) {
      return;
    }
    this.triggerSound();
  }

  toggle(): void {
    const section = vscode.workspace.getConfiguration("terminalErrorSound");
    const current = section.get<boolean>("enabled", true);
    section.update("enabled", !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `Terminal Error Sound: ${!current ? "🔊 Enabled" : "🔇 Disabled"}`
    );
  }

  private triggerSound(): void {
    const now = Date.now();
    if (now - this.lastSoundAt < getConfig().debounceInterval) {
      return;
    }
    this.lastSoundAt = now;
    this.player.play();
  }
}

// ─── Activation ───────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  const player = new SoundPlayer(context);
  const detector = new TerminalErrorDetector(player);

  // Shell Integration exit-code API (VS Code ≥ 1.93)
  if (typeof vscode.window.onDidEndTerminalShellExecution === "function") {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((event) => {
        detector.onShellExecutionEnd(event);
      })
    );
  } else {
    vscode.window.showWarningMessage(
      "Terminal Error Sound: Shell Integration API unavailable. " +
        "Upgrade to VS Code ≥ 1.93 for exit-code detection."
    );
  }

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("terminalErrorSound.toggle", () =>
      detector.toggle()
    ),
    vscode.commands.registerCommand("terminalErrorSound.playTest", () =>
      player.play()
    )
  );

  console.log("[TerminalErrorSound] Activated ✅");
}

export function deactivate(): void {}
