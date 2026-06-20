import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO  = 2,
  WARN  = 3,
  ERROR = 4,
}

// ── File-sink configuration ──────────────────────────────────────────────────
// Logs are written to <userData>/logs/app.log
// When the file exceeds MAX_LOG_BYTES it is rotated to app.log.1 (keeping one backup).
const MAX_LOG_BYTES  = 10 * 1024 * 1024;  // 10 MB per file
const MAX_BACKUPS    = 3;                  // app.log.1 … app.log.3

let logDir: string | null = null;
let logPath: string | null = null;
let logStream: fs.WriteStream | null = null;
let logBytesWritten = 0;

function getLogsDir(): string {
  if (logDir) return logDir;
  // In packaged app: userData (e.g. C:\Users\…\AppData\Roaming\sftp-manager)
  // In dev: process.cwd()/logs (keeps logs next to the project)
  try {
    const base = app.isPackaged ? app.getPath('userData') : process.cwd();
    logDir = path.join(base, 'logs');
  } catch {
    logDir = path.join(process.cwd(), 'logs');
  }
  return logDir;
}

function getLogPath(): string {
  if (logPath) return logPath;
  logPath = path.join(getLogsDir(), 'app.log');
  return logPath;
}

function ensureLogDir(): void {
  const dir = getLogsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function rotateIfNeeded(): void {
  const p = getLogPath();
  try {
    const stat = fs.statSync(p);
    if (stat.size < MAX_LOG_BYTES) return;
  } catch {
    return; // file doesn't exist yet — no rotation needed
  }

  // Close current stream before rotating
  if (logStream) {
    logStream.end();
    logStream = null;
  }

  // Shift existing backups: app.log.2 → app.log.3, app.log.1 → app.log.2 …
  for (let i = MAX_BACKUPS - 1; i >= 1; i--) {
    const from = `${p}.${i}`;
    const to   = `${p}.${i + 1}`;
    if (fs.existsSync(from)) {
      try { fs.renameSync(from, to); } catch { /* ignore */ }
    }
  }

  // Rotate current log → app.log.1
  try { fs.renameSync(p, `${p}.1`); } catch { /* ignore */ }
  logBytesWritten = 0;
}

function getStream(): fs.WriteStream {
  if (logStream) return logStream;

  ensureLogDir();
  rotateIfNeeded();

  const p = getLogPath();
  logStream = fs.createWriteStream(p, { flags: 'a', encoding: 'utf8' });
  logStream.on('error', (err) => {
    logStream = null;
  });

  // Capture current file size so rotation logic is accurate across restarts
  try { logBytesWritten = fs.statSync(p).size; } catch { logBytesWritten = 0; }

  return logStream;
}

function writeToFile(line: string): void {
  try {
    const stream = getStream();
    const bytes = Buffer.byteLength(line + '\n', 'utf8');
    stream.write(line + '\n');
    logBytesWritten += bytes;

    // Lazy rotation: schedule next rotation check after threshold crossed
    if (logBytesWritten >= MAX_LOG_BYTES) {
      // Reset so the next write triggers ensureLogDir/rotateIfNeeded
      logStream?.end();
      logStream = null;
      logBytesWritten = 0;
    }
  } catch {
    // Never let logging failures crash the app
  }
}

// ── Logger class ─────────────────────────────────────────────────────────────

export class Logger {
  private context: string;
  private static minLevel: LogLevel = LogLevel.DEBUG;

  constructor(context: string) {
    this.context = context;
  }

  static getLogger(context: string): Logger {
    return new Logger(context);
  }

  static setLogLevel(level: LogLevel): void {
    Logger.minLevel = level;
  }

  /** Flush and close the log stream on app exit. */
  static close(): void {
    if (logStream) {
      logStream.end();
      logStream = null;
    }
  }

  private format(levelStr: string, message: string, ...args: unknown[]): string {
    const now = new Date();
    const ts =
      now.toISOString().replace('T', ' ').substring(0, 19) +
      '.' + String(now.getMilliseconds()).padStart(3, '0');

    let msg = message;
    for (const arg of args) {
      if (!msg.includes('{}')) break;
      msg = msg.replace('{}', String(arg));
    }

    return `[${ts}] [${levelStr.padEnd(5)}] [${this.context}] ${msg}`;
  }

  trace(message: string, ...args: unknown[]): void {
    if (Logger.minLevel > LogLevel.TRACE) return;
    const line = this.format('TRACE', message, ...args);
    writeToFile(line);
  }

  debug(message: string, ...args: unknown[]): void {
    if (Logger.minLevel > LogLevel.DEBUG) return;
    const line = this.format('DEBUG', message, ...args);
    writeToFile(line);
  }

  info(message: string, ...args: unknown[]): void {
    if (Logger.minLevel > LogLevel.INFO) return;
    const line = this.format('INFO', message, ...args);
    writeToFile(line);
  }

  warn(message: string, ...args: unknown[]): void {
    if (Logger.minLevel > LogLevel.WARN) return;
    const line = this.format('WARN', message, ...args);
    writeToFile(line);
  }

  error(message: string, error?: unknown, ...args: unknown[]): void {
    if (Logger.minLevel > LogLevel.ERROR) return;
    let msg = message;
    if (error && (error as Error).message) {
      msg += ` — ${(error as Error).message}`;
    } else if (error) {
      msg += ` — ${String(error)}`;
    }
    const line = this.format('ERROR', msg, ...args);
    writeToFile(line);
    if (error && typeof error === 'object' && 'stack' in error) {
      const stack = String((error as { stack: unknown }).stack);
      writeToFile(stack);
    }
  }
}

export default Logger;
