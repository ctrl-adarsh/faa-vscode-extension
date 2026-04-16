import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Config {
  enabled: boolean;
  volume: number;
  ignoredExitCodes: number[];
  detectOutputErrors: boolean;
  errorPatterns: string[];
  debounceInterval: number;
}

// ─── Sound Player ─────────────────────────────────────────────────────────────

class SoundPlayer {
  private readonly soundPath: string;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Prefer the real .mp3 if bundled, fall back to generated .wav
    const mp3 = context.asAbsolutePath(path.join('sounds', 'faaah.mp3'));
    const wav = context.asAbsolutePath(path.join('sounds', 'faaah.wav'));
    this.soundPath = fs.existsSync(mp3) ? mp3 : wav;
  }

  async play(): Promise<void> {
    if (!fs.existsSync(this.soundPath)) {
      vscode.window.showErrorMessage(
        `Terminal Error Sound: Sound file not found at "${this.soundPath}"`
      );
      return;
    }

    const cfg = getConfig();
    const volume = Math.max(0, Math.min(1, cfg.volume));
    const platform = os.platform();

    try {
      if (platform === 'darwin') {
        await this.playMac(volume);
      } else if (platform === 'win32') {
        await this.playWindows(volume);
      } else {
        await this.playLinux();
      }
    } catch (err) {
      // Never crash the editor over a sound error
      console.error('[TerminalErrorSound] Playback error:', err);
    }
  }

  // ── macOS ──────────────────────────────────────────────────────────────────
  // afplay ships with macOS and supports both MP3 and WAV natively.
  // -v accepts 0–255 (maps cleanly from our 0.0–1.0 scale × 255).
  private playMac(volume: number): Promise<void> {
    return new Promise((resolve) => {
      const proc = child_process.spawn('afplay', [
        '-v', (volume * 255).toFixed(0),
        this.soundPath,
      ]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve()); // afplay missing — skip silently
    });
  }

  // ── Windows ────────────────────────────────────────────────────────────────
  // Windows Media Player COM object (WMPlayer.OCX.7) ships with every modern
  // Windows install and supports MP3 + WAV with volume control.
  // We fall back to System.Media.SoundPlayer (WAV-only, no volume) if WMP
  // is somehow unavailable.
  private playWindows(volume: number): Promise<void> {
    return new Promise((resolve) => {
      // Escape backslashes and single-quotes for embedding in PS string literal
      const escaped = this.soundPath
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "''");

      const wmpVolume = Math.round(volume * 100);
      const isWav = this.soundPath.toLowerCase().endsWith('.wav');

      // PowerShell script: try WMP first (supports MP3 + volume), then fallback
      const script = [
        `$ErrorActionPreference = 'SilentlyContinue'`,
        `$wmp = New-Object -ComObject WMPlayer.OCX.7`,
        `if ($wmp) {`,
        `  $wmp.settings.volume = ${wmpVolume}`,
        `  $wmp.settings.mute   = $false`,
        `  $wmp.URL = '${escaped}'`,
        `  $wmp.controls.play()`,
        `  $start = Get-Date`,
        // Wait until playback finishes or 10 s timeout
        `  while ($wmp.playState -ne 1 -and ((Get-Date) - $start).TotalSeconds -lt 10) {`,
        `    Start-Sleep -Milliseconds 50`,
        `  }`,
        `  $wmp.close()`,
        `} elseif (${isWav ? '$true' : '$false'}) {`,
        `  Add-Type -AssemblyName System.Windows.Forms`,
        `  $sp = New-Object System.Media.SoundPlayer '${escaped}'`,
        `  $sp.PlaySync()`,
        `}`,
      ].join('; ');

      const proc = child_process.spawn('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle', 'Hidden',
        '-Command', script,
      ]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }

  // ── Linux fallback (not in scope but harmless to keep) ────────────────────
  private playLinux(): Promise<void> {
    return new Promise((resolve) => {
      const isWav = this.soundPath.toLowerCase().endsWith('.wav');
      // Try players in preference order; first found wins
      const candidates = isWav
        ? ['aplay', 'paplay', 'ffplay', 'mpg123']
        : ['mpg123', 'ffplay', 'paplay'];
      const player = candidates.find((p) => {
        try { child_process.execSync(`which ${p}`, { stdio: 'ignore' }); return true; }
        catch { return false; }
      });
      if (!player) { resolve(); return; }
      const proc = child_process.spawn(player, [this.soundPath]);
      proc.on('close', () => resolve());
      proc.on('error', () => resolve());
    });
  }
}

// ─── Config helper ────────────────────────────────────────────────────────────

function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration('terminalErrorSound');
  return {
    enabled:            cfg.get<boolean>('enabled', true),
    volume:             cfg.get<number>('volume', 1.0),
    ignoredExitCodes:   cfg.get<number[]>('ignoredExitCodes', [130]),
    detectOutputErrors: cfg.get<boolean>('detectOutputErrors', true),
    errorPatterns:      cfg.get<string[]>('errorPatterns', []),
    debounceInterval:   cfg.get<number>('debounceInterval', 2000),
  };
}

// ─── Error Detector ───────────────────────────────────────────────────────────

class TerminalErrorDetector {
  private lastSoundAt  = 0;
  private outputBuffer = '';
  private bufferFlushTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly player: SoundPlayer) {}

  /** Called by the Shell Integration API when a command finishes. */
  onShellExecutionEnd(event: vscode.TerminalShellExecutionEndEvent): void {
    const cfg = getConfig();
    if (!cfg.enabled) { return; }
    const code = event.exitCode;
    if (code === undefined || code === 0)          { return; }
    if (cfg.ignoredExitCodes.includes(code))       { return; }
    this.triggerSound();
  }

  /** Called for every chunk written to any terminal. */
  onTerminalData(data: string): void {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.detectOutputErrors)   { return; }

    this.outputBuffer += data;
    // Keep a rolling 4 KB window — we only care about recent output
    if (this.outputBuffer.length > 4096) {
      this.outputBuffer = this.outputBuffer.slice(-4096);
    }

    // Debounce the regex scan so tiny chunks don't thrash
    if (this.bufferFlushTimer) { clearTimeout(this.bufferFlushTimer); }
    this.bufferFlushTimer = setTimeout(() => this.checkBuffer(cfg), 120);
  }

  private checkBuffer(cfg: Config): void {
    if (!cfg.errorPatterns.length) { return; }
    const matched = cfg.errorPatterns.some((p) => this.outputBuffer.includes(p));
    if (matched) {
      this.triggerSound();
      this.outputBuffer = '';   // Reset so the same error doesn't re-fire
    }
  }

  /** Toggle enabled state and show a status-bar notification. */
  toggle(): void {
    const section = vscode.workspace.getConfiguration('terminalErrorSound');
    const current = section.get<boolean>('enabled', true);
    section.update('enabled', !current, vscode.ConfigurationTarget.Global);
    vscode.window.showInformationMessage(
      `Terminal Error Sound: ${!current ? '🔊 Enabled' : '🔇 Disabled'}`
    );
  }

  private triggerSound(): void {
    const now = Date.now();
    if (now - this.lastSoundAt < getConfig().debounceInterval) { return; }
    this.lastSoundAt = now;
    this.player.play();
  }
}

// ─── Activation ───────────────────────────────────────────────────────────────

export function activate(context: vscode.ExtensionContext): void {
  const player   = new SoundPlayer(context);
  const detector = new TerminalErrorDetector(player);

  // ── Shell Integration exit-code API (VS Code ≥ 1.93) ────────────────────
  if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
    context.subscriptions.push(
      vscode.window.onDidEndTerminalShellExecution((event) => {
        detector.onShellExecutionEnd(event);
      })
    );
  } else {
    vscode.window.showWarningMessage(
      'Terminal Error Sound: Shell Integration API is unavailable. ' +
      'Upgrade to VS Code ≥ 1.93 for exit-code detection. ' +
      'Pattern-based detection is still active.'
    );
  }

  // ── Terminal output pattern listener ─────────────────────────────────────
  // onDidWriteTerminalData is a proposed API in older VS Code builds;
  // access via cast to avoid compile errors on strict @types/vscode.
  const windowAny = vscode.window as unknown as {
    onDidWriteTerminalData?: (
      cb: (e: { terminal: vscode.Terminal; data: string }) => void
    ) => vscode.Disposable;
  };
  if (typeof windowAny.onDidWriteTerminalData === 'function') {
    context.subscriptions.push(
      windowAny.onDidWriteTerminalData((event) => {
        detector.onTerminalData(event.data);
      })
    );
  }

  // ── Commands ─────────────────────────────────────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('terminalErrorSound.toggle',   () => detector.toggle()),
    vscode.commands.registerCommand('terminalErrorSound.playTest', () => player.play()),
  );

  console.log('[TerminalErrorSound] Activated ✅  Sound file:', (player as unknown as { soundPath: string }).soundPath);
}

export function deactivate(): void {
  // VS Code disposes subscriptions automatically via context.subscriptions
}
